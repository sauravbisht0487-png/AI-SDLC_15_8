import TestRun, { type IFailedTest, type TestRunStatus } from "../models/TestRun";

export const create = async (data: {
  testSuiteId: string;
  generatedCodeId: string;
  workflowId?: string | undefined;
  attempt: number;
  status: TestRunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  exitCode: number | null;
  failures: IFailedTest[];
  output: string;
  error: string;
  createdBy: string;
}) => {
  return TestRun.create({
    testSuite: data.testSuiteId,
    generatedCode: data.generatedCodeId,
    ...(data.workflowId ? { workflow: data.workflowId } : {}),
    attempt: data.attempt,
    status: data.status,
    totalTests: data.totalTests,
    passedTests: data.passedTests,
    failedTests: data.failedTests,
    durationMs: data.durationMs,
    exitCode: data.exitCode,
    failures: data.failures,
    output: data.output,
    error: data.error,
    createdBy: data.createdBy,
  });
};

export const findById = async (id: string) => TestRun.findById(id);

export const findLatestByTestSuite = async (testSuiteId: string) =>
  TestRun.findOne({ testSuite: testSuiteId }).sort({ createdAt: -1 });

export const listByTestSuite = async (testSuiteId: string) =>
  TestRun.find({ testSuite: testSuiteId }).sort({ createdAt: -1 }).select("-output");

export const findLatestByWorkflow = async (workflowId: string) =>
  TestRun.findOne({ workflow: workflowId }).sort({ createdAt: -1 });