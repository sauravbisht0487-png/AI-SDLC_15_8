import { getAIProvider } from "../ai/aiFactory";
import { aiError } from "../ai/errors";
import type { JsonSchema } from "../ai/AIProvider";
import { normalizePath, validateGeneratedFiles } from "../ai/validateFiles";
import type { IFailedTest } from "../models/TestRun";
import { fixTestImports } from "./importFixer";
import { MOCKING_RULES } from "./promptRules";
export interface RepairFile {
  filename: string;
  code: string;
}

export interface RepairInput {
  storyTitle: string;
  acceptanceCriteria: string[];
  runStatus: "failed" | "error"; // "timeout" is not repaired automatically
  failures: IFailedTest[];
  output: string;
  error: string;
  sourceFiles: RepairFile[]; // backend/src/** from the current GeneratedCode
  testFiles: RepairFile[]; // backend/tests/** from the current TestSuite
    previousAttempts: string[]; // explanations of earlier repair attempts that did NOT fix it
}

export interface ProposedFix {
  target: "code" | "test" | "both";
  explanation: string;
  files: { filename: string; language: string; code: string }[];
}

const MAX_CHARS_PER_FILE = 6000;
const MAX_TOTAL_CHARS = 30000;
const MAX_FAILURES_IN_PROMPT = 8;
const MAX_FIX_FILES = 6;
const SANDBOX_PACKAGES = "vitest, express, mongoose, jsonwebtoken, bcryptjs, cors, zod, supertest";

const fixSchema: JsonSchema = {
  type: "object",
  properties: {
    target: { type: "string", enum: ["code", "test", "both"] },
    explanation: { type: "string", description: "1-3 sentences: what was wrong and what you changed" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          language: { type: "string" },
          code: { type: "string", description: "the COMPLETE new content of the file" },
        },
        required: ["filename", "language", "code"],
        additionalProperties: false,
      },
    },
  },
  required: ["target", "explanation", "files"],
  additionalProperties: false,
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

// ---------- choosing the relevant files ----------

const dirOf = (p: string): string => p.split("/").slice(0, -1).join("/");

// Resolves "../src/controllers/x" (relative to the test file) to "backend/src/controllers/x".
const resolveRelative = (fromFile: string, spec: string): string => {
  const parts = dirOf(fromFile).split("/");
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
};

const importedSources = (testFile: RepairFile, sources: RepairFile[]): RepairFile[] => {
  const found = new Set<string>();
  const re = /(?:from|import|require)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
  for (const match of testFile.code.matchAll(re)) {
    const spec = match[1];
    if (!spec) continue;
    const base = resolveRelative(testFile.filename, spec).toLowerCase();
    for (const source of sources) {
      const name = source.filename.toLowerCase();
      if (name === base || name.startsWith(`${base}.`) || name.startsWith(`${base}/index.`)) {
        found.add(source.filename);
      }
    }
  }
  return sources.filter((s) => found.has(s.filename));
};

const pickRelevantSources = (input: RepairInput): RepairFile[] => {
  const failingFiles = new Set(input.failures.map((f) => f.file));
  const failingTests = input.testFiles.filter((t) => failingFiles.has(t.filename));
  const testsToScan = failingTests.length > 0 ? failingTests : input.testFiles;

  const picked = new Map<string, RepairFile>();
  for (const test of testsToScan) {
    for (const source of importedSources(test, input.sourceFiles)) picked.set(source.filename, source);
  }
  // Fallback: nothing matched (e.g. the import could not be resolved).
  if (picked.size === 0) {
    for (const source of input.sourceFiles.slice(0, 3)) picked.set(source.filename, source);
  }
  return [...picked.values()];
};

const renderFiles = (files: RepairFile[], budget: { left: number }): string => {
  const parts: string[] = [];
  for (const f of files) {
    const snippet = f.code.slice(0, MAX_CHARS_PER_FILE);
    if (snippet.length > budget.left) break;
    budget.left -= snippet.length;
    parts.push(`--- ${f.filename} ---\n${snippet}`);
  }
  return parts.join("\n\n");
};

// ---------- the AI call ----------

export const proposeFixes = async (
  input: RepairInput,
): Promise<{ fix: ProposedFix; provider: string; model: string }> => {
  const failingFiles = new Set(input.failures.map((f) => f.file));
  const failingTests = input.testFiles.filter((t) => failingFiles.has(t.filename));
  const testsToShow = failingTests.length > 0 ? failingTests : input.testFiles;
  const sources = pickRelevantSources(input);

  const budget = { left: MAX_TOTAL_CHARS };
  const testsText = renderFiles(testsToShow, budget);
  const sourcesText = renderFiles(sources, budget);

  const failuresText = input.failures
    .slice(0, MAX_FAILURES_IN_PROMPT)
    .map((f, i) => `${i + 1}. [${f.file}] ${f.name}\n   ${f.message}\n${f.stack.slice(0, 800)}`)
    .join("\n\n");
  const previousText =
    input.previousAttempts.length > 0
      ? `Previous repair attempts ALREADY TRIED. They did NOT fix the problem, so do not repeat them. Find the real cause:\n${input.previousAttempts
          .map((a, i) => `${i + 1}. ${a}`)
          .join("\n")}\n\n`
      : "";
  const prompt = `You are a senior engineer fixing failing automated tests. The tests were run for real inside a sandbox (Vitest, Node 22, no network). Decide whether the TEST or the CODE is wrong and fix it.

User story: ${input.storyTitle}
Acceptance criteria:
${input.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Run result: ${
    input.runStatus === "failed"
      ? "tests ran and some FAILED."
      : "tests could NOT run (a test file failed to load: bad import, syntax error or missing package)."
  }
${previousText}
Failures:
${failuresText || "(no structured failures, see output)"}

${input.error ? `stderr:\n${input.error.slice(-1500)}\n` : ""}Test output (tail):
${input.output.slice(-1500)}

Failing test files:
${testsText}

Related source files:
${sourcesText}

All source files that exist (tests may import only these; count the ../ segments from the test file's own folder):
${input.sourceFiles.map((f) => f.filename).join("\n")}

Rules:
- Return the COMPLETE new content of every file you change. Never return partial files or diffs.
- Fix the root cause. If the test asserts an invented value or shape that the acceptance criteria do not require, fix the TEST. If the code is genuinely wrong or incomplete against the acceptance criteria, fix the CODE. Never delete or weaken a test just to make it pass.
- Change only what is needed, in at most ${MAX_FIX_FILES} files. Paths stay as shown (backend/src/... or backend/tests/...).
- Do not create or edit package.json, .env files or config files.
- Only these packages exist in the sandbox: ${SANDBOX_PACKAGES}. Do not import anything else.
- Tests must not use a real database or network: keep mocking with vi.mock.
- Set target to "code", "test" or "both" to say what you changed.${MOCKING_RULES}`;

  const provider = getAIProvider();
  const raw = await provider.generateJson({
    prompt,
    schemaName: "repair_fix",
    schema: fixSchema,
  });

  const root = asRecord(raw);
  const target = root?.["target"];
  const explanation = root?.["explanation"];
  const items = root?.["files"];
  if (target !== "code" && target !== "test" && target !== "both") {
    throw aiError("AI_INVALID_SHAPE", "Repair response has an invalid target");
  }
  if (typeof explanation !== "string" || !explanation.trim()) {
    throw aiError("AI_INVALID_SHAPE", "Repair response has no explanation");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw aiError("AI_EMPTY_RESPONSE", "AI returned no fixed files");
  }
  if (items.length > MAX_FIX_FILES) {
    throw aiError("AI_INVALID_SHAPE", `AI changed ${items.length} files, maximum is ${MAX_FIX_FILES}`);
  }

  const parsed = items.map((item, index) => {
    const r = asRecord(item);
    const { filename, language, code } = r ?? {};
    if (
      typeof filename !== "string" ||
      typeof language !== "string" ||
      typeof code !== "string" ||
      !code.trim()
    ) {
      throw aiError("AI_INVALID_SHAPE", `Fixed file at index ${index} has invalid shape`);
    }
    return { filename, language, code };
  });

  // Same guard as every other AI file output (traversal, .env, package.json, size, duplicates).
  const files = validateGeneratedFiles(parsed);

  // A fix may only touch backend source or backend tests, and must edit files that exist
  // or add new ones in those two places.
  for (const f of files) {
    const inTests = f.filename.startsWith("backend/tests/") && f.filename.endsWith(".test.ts");
    const inSrc = f.filename.startsWith("backend/src/");
    if (!inTests && !inSrc) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `Fixes may only change backend/src/** or backend/tests/*.test.ts, got: ${f.filename}`,
      );
    }
  }
  // Fix wrong relative imports in test files without asking the AI again.
  const sourcePaths = new Set(input.sourceFiles.map((s) => s.filename));
  for (const f of files) if (f.filename.startsWith("backend/src/")) sourcePaths.add(f.filename);
  const fixedFiles = files.map((f) =>
    f.filename.startsWith("backend/tests/")
      ? { ...f, code: fixTestImports(f.filename, f.code, [...sourcePaths]) }
      : f,
  );

  // Keep "target" honest: it must match what was actually changed.
  const touchesTests = fixedFiles.some((f) => f.filename.startsWith("backend/tests/"));
  const touchesSrc = fixedFiles.some((f) => f.filename.startsWith("backend/src/"));
  const actualTarget: ProposedFix["target"] =
    touchesTests && touchesSrc ? "both" : touchesTests ? "test" : "code";

  return {
    fix: { target: actualTarget, explanation: explanation.trim(), files: fixedFiles },
    provider: provider.name,
    model: provider.model,
  };
};
 
// Re-exported so 11b can use the same path normalisation when merging files.
export { normalizePath };