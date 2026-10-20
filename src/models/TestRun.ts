import mongoose, { Schema, Document, Types } from "mongoose";

export const TEST_RUN_STATUSES = ["passed", "failed", "error", "timeout"] as const;
export type TestRunStatus = (typeof TEST_RUN_STATUSES)[number];

export interface IFailedTest {
  file: string;
  name: string;
  message: string;
  stack: string;
}

export interface ITestRun extends Document {
  testSuite: Types.ObjectId;
  generatedCode: Types.ObjectId;
  workflow?: Types.ObjectId | undefined;
  attempt: number; // 1 = first run; self-healing reruns increase it
  status: TestRunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  exitCode: number | null;
  failures: IFailedTest[];
  output: string; // stdout, capped
  error: string; // stderr or a short reason, capped
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const failedTestSchema = new Schema<IFailedTest>(
  {
    file: { type: String, default: "" },
    name: { type: String, default: "" },
    message: { type: String, default: "" },
    stack: { type: String, default: "" },
  },
  { _id: false },
);

const testRunSchema = new Schema<ITestRun>(
  {
    testSuite: { type: Schema.Types.ObjectId, ref: "TestSuite", required: true },
    generatedCode: { type: Schema.Types.ObjectId, ref: "GeneratedCode", required: true },
    workflow: { type: Schema.Types.ObjectId, ref: "SDLCWorkflow" },
    attempt: { type: Number, default: 1 },
    status: { type: String, enum: TEST_RUN_STATUSES, required: true },
    totalTests: { type: Number, default: 0 },
    passedTests: { type: Number, default: 0 },
    failedTests: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    exitCode: { type: Number, default: null },
    failures: { type: [failedTestSchema], default: [] },
    output: { type: String, default: "" },
    error: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// "Runs for this test suite, newest first" and "runs for this workflow".
testRunSchema.index({ testSuite: 1, createdAt: -1 });
testRunSchema.index({ workflow: 1, createdAt: -1 });

export default mongoose.model<ITestRun>("TestRun", testRunSchema);