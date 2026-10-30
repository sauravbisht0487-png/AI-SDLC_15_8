import * as generatedCodeRepository from "../repositories/generatedCodeRepository";
import * as testSuiteRepository from "../repositories/testSuiteRepository";
import * as testRunRepository from "../repositories/testRunRepository";
import { proposeFixes, type ProposedFix } from "./repairService";
import { runTestsInSandbox } from "./sandboxRunner";
import { parseVitestResult, type ParsedRun } from "./vitestParser";
import logger from "../utils/logger";
import { fixTestImports } from "./importFixer";

export const MAX_REPAIR_ATTEMPTS = 3;
const LOAD_FAILURE_NAME = "(test file failed to load)";

interface CodeFile {
  filename: string;
  language: string;
  code: string;
}

export interface HealingContext {
  workflowId: string;
  userStoryId: string;
  storyTitle: string;
  acceptanceCriteria: string[];
  generatedCodeId: string;
  testSuiteId: string;
  createdBy: string;
}

export interface HealingOutcome {
  status: "passed" | "failed" | "error" | "timeout";
  summary: string;
  testRunId: string; // the BEST run
  generatedCodeId: string; // the best versions
  testSuiteId: string;
  attempts: number; // number of test runs executed
  repairs: string[]; // what the AI tried, one entry per attempt
}

// One saved state of the code and tests, with the result of running it.
interface Snapshot {
  parsed: ParsedRun;
  score: number; // lower is better, 0 = all passed
  runId: string;
  generatedCodeId: string;
  testSuiteId: string;
  codeFiles: CodeFile[];
  testFiles: CodeFile[];
}

const scoreOf = (p: ParsedRun): number => {
  if (p.status === "passed") return 0;
  if (p.status === "timeout") return 1000;
  const loadErrors = p.failures.filter((f) => f.name === LOAD_FAILURE_NAME).length;
  const score = p.failedTests + 5 * loadErrors;
  return score > 0 ? score : 10; // an "error" with nothing counted is still bad
};

const summarize = (parsed: ParsedRun): string => {
  const first = parsed.failures[0];
  if (parsed.status === "failed") return `${parsed.failedTests} of ${parsed.totalTests} tests failed`;
  if (parsed.status === "timeout") return "Tests exceeded the time limit and were stopped";
  return `Tests could not run: ${first?.message ?? "see the test run for details"}`;
};

// Replaces files by filename and keeps all the others. Returns whether anything changed.
const mergeFiles = (
  current: CodeFile[],
  fixes: CodeFile[],
): { files: CodeFile[]; changed: boolean } => {
  const byName = new Map(current.map((f) => [f.filename, f]));
  let changed = false;
  for (const fix of fixes) {
    const existing = byName.get(fix.filename);
    if (!existing || existing.code !== fix.code) changed = true;
    byName.set(fix.filename, fix);
  }
  return { files: [...byName.values()], changed };
};

const runAndRecord = async (
  ctx: HealingContext,
  generatedCodeId: string,
  testSuiteId: string,
  codeFiles: CodeFile[],
  testFiles: CodeFile[],
  attempt: number,
) => {
  const raw = await runTestsInSandbox([
    ...codeFiles
      .filter((f) => f.filename.startsWith("backend/"))
      .map((f) => ({ path: f.filename, content: f.code })),
    ...testFiles.map((f) => ({ path: f.filename, content: f.code })),
  ]);
  const parsed = parseVitestResult(raw);

  // Saved before any decision, so every attempt is inspectable later.
  const run = await testRunRepository.create({
    testSuiteId,
    generatedCodeId,
    workflowId: ctx.workflowId,
    attempt,
    status: parsed.status,
    totalTests: parsed.totalTests,
    passedTests: parsed.passedTests,
    failedTests: parsed.failedTests,
    durationMs: raw.durationMs,
    exitCode: raw.exitCode,
    failures: parsed.failures,
    output: parsed.output,
    error: parsed.error,
    createdBy: ctx.createdBy,
  });
  return { parsed, runId: run._id.toString() };
};

export const runTestsWithSelfHealing = async (ctx: HealingContext): Promise<HealingOutcome> => {
  const [initialCode, initialSuite] = await Promise.all([
    generatedCodeRepository.findById(ctx.generatedCodeId),
    testSuiteRepository.findById(ctx.testSuiteId),
  ]);
  if (!initialCode || !initialSuite) {
    throw Object.assign(new Error("The generated code or test suite no longer exists"), {
      code: "MISSING_INPUT",
    });
  }

  const toFiles = (files: { filename: string; language: string; code: string }[]): CodeFile[] =>
    files.map((f) => ({ filename: f.filename, language: f.language, code: f.code }));

  const repairs: string[] = [];
  let attempt = 1;

  const firstCode = toFiles(initialCode.files);
   const sourcePaths = firstCode.map((f) => f.filename);
  const firstTests = toFiles(initialSuite.files).map((f) => ({
    ...f,
    code: fixTestImports(f.filename, f.code, sourcePaths),
  }));
  const first = await runAndRecord(ctx, ctx.generatedCodeId, ctx.testSuiteId, firstCode, firstTests, attempt);

  // "best" is the best version seen so far. Every repair starts from it.
  let best: Snapshot = {
    parsed: first.parsed,
    score: scoreOf(first.parsed),
    runId: first.runId,
    generatedCodeId: ctx.generatedCodeId,
    testSuiteId: ctx.testSuiteId,
    codeFiles: firstCode,
    testFiles: firstTests,
  };

  const finish = (snap: Snapshot, summary: string): HealingOutcome => ({
    status: snap.parsed.status,
    summary,
    testRunId: snap.runId,
    generatedCodeId: snap.generatedCodeId,
    testSuiteId: snap.testSuiteId,
    attempts: attempt,
    repairs,
  });

  for (;;) {
    if (best.parsed.status === "passed") return finish(best, "All tests passed");
    // Never repair a timeout: an infinite loop needs a human, not another AI call.
    if (best.parsed.status === "timeout") return finish(best, summarize(best.parsed));
    if (repairs.length >= MAX_REPAIR_ATTEMPTS) {
      return finish(best, `${summarize(best.parsed)} after ${repairs.length} repair attempts`);
    }

    logger.info("Self-healing: asking AI for a fix", {
      workflowId: ctx.workflowId,
      repairAttempt: repairs.length + 1,
      bestScore: best.score,
    });

    let fix: ProposedFix;
    try {
      ({ fix } = await proposeFixes({
        storyTitle: ctx.storyTitle,
        acceptanceCriteria: ctx.acceptanceCriteria,
        runStatus: best.parsed.status === "error" ? "error" : "failed",
        failures: best.parsed.failures,
        output: best.parsed.output,
        error: best.parsed.error,
        sourceFiles: best.codeFiles
          .filter((f) => f.filename.startsWith("backend/src/"))
          .map((f) => ({ filename: f.filename, code: f.code })),
        testFiles: best.testFiles.map((f) => ({ filename: f.filename, code: f.code })),
        previousAttempts: repairs,
      }));
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error("Self-healing: repair request failed", { workflowId: ctx.workflowId, error: reason });
      repairs.push(`Repair attempt ${repairs.length + 1} failed: ${reason}`);
      return finish(best, `${summarize(best.parsed)}. The AI could not produce a valid fix`);
    }

    const mergedTests = mergeFiles(
      best.testFiles,
      fix.files.filter((f) => f.filename.startsWith("backend/tests/")),
    );
    const mergedSource = mergeFiles(
      best.codeFiles,
      fix.files.filter((f) => f.filename.startsWith("backend/src/")),
    );

    if (!mergedTests.changed && !mergedSource.changed) {
      repairs.push(`Repair attempt ${repairs.length + 1}: the AI returned unchanged files`);
      return finish(best, `${summarize(best.parsed)}. The AI returned no real change`);
    }

    // Apply as NEW versions. Old documents stay untouched, so history is kept.
    let nextCodeId = best.generatedCodeId;
    let nextSuiteId = best.testSuiteId;
    if (mergedSource.changed) {
      const created = await generatedCodeRepository.create(ctx.userStoryId, mergedSource.files, ctx.createdBy);
      nextCodeId = created._id.toString();
    }
    if (mergedTests.changed) {
      const created = await testSuiteRepository.create({
        generatedCodeId: nextCodeId,
        userStoryId: ctx.userStoryId,
        files: mergedTests.files,
        aiProvider: "self-healing",
        aiModel: "repair",
        createdBy: ctx.createdBy,
      });
      nextSuiteId = created._id.toString();
    }

    repairs.push(`Repair attempt ${repairs.length + 1} (${fix.target}): ${fix.explanation}`);
    attempt++;
    const result = await runAndRecord(ctx, nextCodeId, nextSuiteId, mergedSource.files, mergedTests.files, attempt);

    const candidate: Snapshot = {
      parsed: result.parsed,
      score: scoreOf(result.parsed),
      runId: result.runId,
      generatedCodeId: nextCodeId,
      testSuiteId: nextSuiteId,
      codeFiles: mergedSource.files,
      testFiles: mergedTests.files,
    };

    if (candidate.score < best.score) {
      best = candidate;
    } else {
      // Not better: keep the previous best, and the next repair starts from it.
      const last = repairs.length - 1;
      repairs[last] = `${repairs[last]} [result was not better, reverted to the previous best version]`;
    }
  }
};