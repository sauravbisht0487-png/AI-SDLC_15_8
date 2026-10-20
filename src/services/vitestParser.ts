import type { SandboxResult } from "./sandboxRunner";
import type { IFailedTest, TestRunStatus } from "../models/TestRun";

export interface ParsedRun {
  status: TestRunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures: IFailedTest[];
  output: string;
  error: string;
}

const MAX_OUTPUT_CHARS = 20_000;
const MAX_FAILURES = 20;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_STACK_CHARS = 3_000;

// Keep the END of long output: the useful part (the summary and the error) is last.
const tail = (text: string, max: number): string =>
  text.length <= max ? text : `...[truncated]...\n${text.slice(text.length - max)}`;

const head = (text: string, max: number): string => text.slice(0, max);

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

// Removes the in-container path so users and the AI see "backend/tests/x.test.ts".
const relativePath = (p: string): string => {
  const normalized = p.replace(/\\/g, "/");
  const index = normalized.indexOf("/work/");
  return index >= 0 ? normalized.slice(index + "/work/".length) : normalized;
};

const extractFailures = (report: Record<string, unknown>): IFailedTest[] => {
  const failures: IFailedTest[] = [];
  const suites = Array.isArray(report["testResults"]) ? report["testResults"] : [];

  for (const suite of suites) {
    const s = asRecord(suite);
    if (!s) continue;
    const file = relativePath(str(s["name"]));
    const suiteFailed = str(s["status"]) === "failed";

    const assertions = Array.isArray(s["assertionResults"]) ? s["assertionResults"] : [];
    let foundFailedAssertion = false;

    for (const a of assertions) {
      const r = asRecord(a);
      if (!r || str(r["status"]) !== "failed") continue;
      foundFailedAssertion = true;
      const messages = Array.isArray(r["failureMessages"]) ? r["failureMessages"] : [];
      const first = str(messages[0]);
      failures.push({
        file,
        name: str(r["fullName"]) || str(r["title"]),
        message: head(first.split("\n")[0] ?? "", MAX_MESSAGE_CHARS),
        stack: head(messages.map(str).join("\n"), MAX_STACK_CHARS),
      });
    }

    // The whole file failed before any test ran (syntax error, missing module, ...).
    if (suiteFailed && !foundFailedAssertion) {
      const message = str(s["message"]);
      failures.push({
        file,
        name: "(test file failed to load)",
        message: head(message.split("\n")[0] ?? "", MAX_MESSAGE_CHARS),
        stack: head(message, MAX_STACK_CHARS),
      });
    }
  }
  return failures.slice(0, MAX_FAILURES);
};

export const parseVitestResult = (result: SandboxResult): ParsedRun => {
  const output = tail(result.stdout, MAX_OUTPUT_CHARS);
  const stderr = tail(result.stderr, MAX_OUTPUT_CHARS);

  if (result.timedOut) {
    return {
      status: "timeout",
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      failures: [],
      output,
      error: "Tests exceeded the time limit and were stopped",
    };
  }

  let report: Record<string, unknown> | null = null;
  if (result.resultJson) {
    try {
      report = asRecord(JSON.parse(result.resultJson));
    } catch {
      report = null;
    }
  }

  // No report means vitest never produced results: config error, crash, bad import.
  if (!report) {
    return {
      status: "error",
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      failures: [],
      output,
      error: stderr || "Vitest produced no result report",
    };
  }

  const totalTests = num(report["numTotalTests"]);
  const passedTests = num(report["numPassedTests"]);
  const failedTests = num(report["numFailedTests"]);
  const failures = extractFailures(report);
  const failedSuites = num(report["numFailedTestSuites"]);

  let status: TestRunStatus;
  if (failedTests > 0) status = "failed";
  else if (failedSuites > 0 || totalTests === 0) status = "error"; // files failed to load, or nothing ran
  else status = "passed";

  return { status, totalTests, passedTests, failedTests, failures, output, error: stderr };
};