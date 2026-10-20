import * as workflowService from "./sdlcWorkflowService";
import * as projectRepository from "../repositories/projectRepository";
import * as requirementRepository from "../repositories/requirementRepository";
import * as userStoryService from "./userStoryService";
import * as architectureService from "./architectureService";
import * as testService from "./testService";
import { AIServiceError } from "../ai/errors";
import type { IStage, StageName } from "../models/SDLCWorkflow";
import logger from "../utils/logger";

import * as generatedCodeRepository from "../repositories/generatedCodeRepository";
import * as testSuiteRepository from "../repositories/testSuiteRepository";
import * as testRunRepository from "../repositories/testRunRepository";
import { runTestsInSandbox, SandboxError } from "./sandboxRunner";
import { parseVitestResult } from "./vitestParser";

const MAX_STAGE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
// Bad model output or rate limits: a second try can succeed. Everything else will not.
const RETRYABLE_CODES = new Set(["AI_INVALID_SHAPE", "AI_EMPTY_RESPONSE", "AI_RATE_LIMIT"]);

class StageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StageError";
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const errorCode = (err: unknown): string | undefined =>
  typeof err === "object" && err !== null && "code" in err && typeof err.code === "string"
    ? err.code
    : undefined;

// What the user sees. Unknown errors are logged in full but not exposed.
const safeMessage = (err: unknown): string => {
   if (err instanceof AIServiceError || err instanceof StageError || err instanceof SandboxError) {
    return err.message;
  }
  if (err instanceof Error && errorCode(err) === "NO_BACKEND_FILES") return err.message;
  return "Unexpected error. Check the server logs.";
};

type StageOutput = Record<string, string>;

// Runs one stage with bounded retries and records every state change in MongoDB.
// Returns the stage output, or null if the stage failed (the workflow is then failed).
const executeStage = async (
  workflowId: string,
  stage: StageName,
  previous: IStage | undefined,
  work: () => Promise<StageOutput>,
): Promise<StageOutput | null> => {
  // Idempotency: if a restarted job finds this stage already done, reuse its output.
  if (previous?.status === "succeeded") return previous.output;

  let attempt = 1;
  for (;;) {
    await workflowService.startStage(workflowId, stage, attempt > 1);
    try {
      const output = await work();
      await workflowService.succeedStage(workflowId, stage, output);
      logger.info("Stage succeeded", { workflowId, stage, attempt });
      return output;
    } catch (err: unknown) {
      const code = errorCode(err);
      logger.error("Stage attempt failed", {
        workflowId,
        stage,
        attempt,
        code,
        error: err instanceof Error ? err.message : String(err),
      });

      if (attempt < MAX_STAGE_ATTEMPTS && code !== undefined && RETRYABLE_CODES.has(code)) {
        await sleep(RETRY_DELAY_MS * attempt);
        attempt++;
        continue;
      }

      await workflowService.failStage(workflowId, stage, safeMessage(err));
      return null;
    }
  }
};

export const runWorkflow = async (workflowId: string): Promise<void> => {
  const workflow = await workflowService.getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
  // A finished workflow is never re-run. This makes duplicate jobs harmless.
  if (workflow.status !== "queued" && workflow.status !== "running") return;

  const [project, requirement, story] = await Promise.all([
    projectRepository.findById(workflow.project.toString()),
    requirementRepository.findById(workflow.requirement.toString()),
    userStoryService.getUserStoryById(workflow.userStory.toString()),
  ]);
  if (!project || !requirement || !story) {
    await workflowService.failStage(
      workflowId,
      "DESIGN",
      "The project, requirement or user story no longer exists",
    );
    return;
  }

  const createdBy = workflow.createdBy.toString();
  const requirementId = requirement._id.toString();
  const userStoryId = story._id.toString();
  const stageOf = (name: StageName) => workflow.stages.find((s) => s.name === name);

  // ---- DESIGN: reuse the latest architecture, generate only if none exists ----
  const design = await executeStage(workflowId, "DESIGN", stageOf("DESIGN"), async () => {
    const existing = await architectureService.getLatestArchitecture(requirementId);
    if (existing) return { architectureId: existing._id.toString() };
    const created = await architectureService.generateArchitecture(requirement, project, createdBy);
    return { architectureId: created._id.toString() };
  });
  if (!design) return;

  // ---- CODE_GENERATION ----
  const code = await executeStage(
    workflowId,
    "CODE_GENERATION",
    stageOf("CODE_GENERATION"),
    async () => {
      const generated = await userStoryService.generateCodeForUserStory(
        story,
        { name: project.name, description: project.description },
        { title: requirement.title, description: requirement.description },
        createdBy,
      );
      return { generatedCodeId: generated._id.toString() };
    },
  );
  if (!code) return;

  // ---- TEST_GENERATION ----
  const tests = await executeStage(
    workflowId,
    "TEST_GENERATION",
    stageOf("TEST_GENERATION"),
    async () => {
      const generatedCodeId = code["generatedCodeId"];
      if (!generatedCodeId) {
        throw new StageError("MISSING_INPUT", "Code generation produced no generated code id");
      }
      const suite = await testService.generateTestsForGeneratedCode(
        requirementId,
        userStoryId,
        generatedCodeId,
        createdBy,
      );
      if (!suite) {
        throw new StageError("GENERATED_CODE_NOT_FOUND", "Generated code not found for this story");
      }
      return { testSuiteId: suite._id.toString() };
    },
  );
  if (!tests) return;

  // TEST_EXECUTION needs the Docker sandbox (Task 10). Skipped until then.
    // ---- TEST_EXECUTION: run the generated tests inside the Docker sandbox ----
  const execution = await executeStage(
    workflowId,
    "TEST_EXECUTION",
    stageOf("TEST_EXECUTION"),
    async () => {
      const generatedCodeId = code["generatedCodeId"];
      const testSuiteId = tests["testSuiteId"];
      if (!generatedCodeId || !testSuiteId) {
        throw new StageError("MISSING_INPUT", "Earlier stages produced no code or tests to run");
      }

      const [generatedCode, suite] = await Promise.all([
        generatedCodeRepository.findById(generatedCodeId),
        testSuiteRepository.findById(testSuiteId),
      ]);
      if (!generatedCode || !suite) {
        throw new StageError("MISSING_INPUT", "The generated code or test suite no longer exists");
      }

      const files = [
        ...generatedCode.files
          .filter((f) => f.filename.startsWith("backend/"))
          .map((f) => ({ path: f.filename, content: f.code })),
        ...suite.files.map((f) => ({ path: f.filename, content: f.code })),
      ];

      const raw = await runTestsInSandbox(files);
      const parsed = parseVitestResult(raw);

      // Saved BEFORE deciding pass or fail, so failures are always inspectable.
      const run = await testRunRepository.create({
        testSuiteId,
        generatedCodeId,
        workflowId,
        attempt: 1,
        status: parsed.status,
        totalTests: parsed.totalTests,
        passedTests: parsed.passedTests,
        failedTests: parsed.failedTests,
        durationMs: raw.durationMs,
        exitCode: raw.exitCode,
        failures: parsed.failures,
        output: parsed.output,
        error: parsed.error,
        createdBy,
      });

      if (parsed.status === "passed") return { testRunId: run._id.toString() };

      const firstFailure = parsed.failures[0];
      const summary =
        parsed.status === "failed"
          ? `${parsed.failedTests} of ${parsed.totalTests} tests failed`
          : parsed.status === "timeout"
            ? "Tests exceeded the time limit and were stopped"
            : `Tests could not run: ${firstFailure?.message ?? "see the test run for details"}`;
      throw new StageError(`TESTS_${parsed.status.toUpperCase()}`, summary);
    },
  );
  if (!execution) return;

  await workflowService.completeWorkflow(workflowId);
  
  logger.info("Workflow completed", { workflowId });
};
