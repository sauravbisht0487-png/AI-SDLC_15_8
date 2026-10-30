import { getAIProvider } from "../ai/aiFactory";
import { aiError } from "../ai/errors";
import type { JsonSchema } from "../ai/AIProvider";
import { validateGeneratedFiles } from "../ai/validateFiles";
import { MOCKING_RULES } from "./promptRules";
interface SourceFile {
  filename: string;
  code: string;
}
export interface GeneratedTestFile {
  filename: string;
  language: string;
  code: string;
}

const testSchema: JsonSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          language: { type: "string" },
          code: { type: "string" },
        },
        required: ["filename", "language", "code"],
        additionalProperties: false,
      },
    },
  },
  required: ["files"],
  additionalProperties: false,
};

const MAX_CHARS_PER_FILE = 6000;
const MAX_TOTAL_CHARS = 30000;

const buildSourceText = (files: SourceFile[]): string => {
  let total = 0;
  const parts: string[] = [];
  for (const f of files) {
    const snippet = f.code.slice(0, MAX_CHARS_PER_FILE);
    if (total + snippet.length > MAX_TOTAL_CHARS) break;
    total += snippet.length;
    parts.push(`--- ${f.filename} ---\n${snippet}`);
  }
  return parts.join("\n\n");
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export const generateTests = async (input: {
  storyTitle: string;
  acceptanceCriteria: string[];
  backendFiles: SourceFile[];
}): Promise<{ files: GeneratedTestFile[]; provider: string; model: string }> => {
  const prompt = `You are a senior test engineer. Write Vitest unit tests for the backend code below.

User story: ${input.storyTitle}
Acceptance criteria:
${input.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

Source files:
${buildSourceText(input.backendFiles)}

Rules:
- Use Vitest only: import { describe, it, expect, vi, beforeEach } from "vitest".
- Every test file path must be backend/tests/<name>.test.ts. Write at most 3 test files.
- Import source code with relative paths from the tests folder, for example "../src/controllers/sortingController".
- NEVER connect to a real database or network. Mock Mongoose models and any other dependency with vi.mock.
- Test controllers and services with mocked req and res objects (res.status and res.json as vi.fn()).
- Cover the acceptance criteria: the success path, validation errors and not-found or error cases.
- Test only behaviour that exists in the source files. Do not invent functions or files.
- Assert exact values ONLY when the acceptance criteria state them or they follow directly from the input (for example the sorted array for a given input).
- NEVER assert exact values for anything the acceptance criteria do not define, such as iteration or step counts, timings, ids or generated text. Assert the type or shape instead, for example: expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sortedArray: [1, 2, 3], iterations: expect.any(Number) })).
- No package installs, no file system access, no environment variables, no process.exit.${MOCKING_RULES}`;


  const provider = getAIProvider();
  const raw = await provider.generateJson({
    prompt,
    schemaName: "generated_tests",
    schema: testSchema,
  });

  const root = asRecord(raw);
  const items = root ? root["files"] : undefined;
  if (!Array.isArray(items) || items.length === 0) {
    throw aiError("AI_EMPTY_RESPONSE", "AI did not return any test files");
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
      throw aiError("AI_INVALID_SHAPE", `AI test file at index ${index} has invalid shape`);
    }
    return { filename, language, code };
  });

  // Reuse the Task 2 validator, then apply the test-specific rule.
  const files = validateGeneratedFiles(parsed);
  for (const f of files) {
    if (!f.filename.startsWith("backend/tests/") || !f.filename.endsWith(".test.ts")) {
      throw aiError(
        "AI_INVALID_SHAPE",
        `Test files must be backend/tests/*.test.ts, got: ${f.filename}`,
      );
    }
  }

  return { files, provider: provider.name, model: provider.model };
};