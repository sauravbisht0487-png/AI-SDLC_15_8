import mongoose, { Schema, Document, Types } from "mongoose";

// Only stages that exist today. We add names here as we build each phase.
export const STAGE_NAMES = [
  "DESIGN",
  "CODE_GENERATION",
  "TEST_GENERATION",
  "TEST_EXECUTION",
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_STATUSES = ["pending", "running", "succeeded", "failed", "skipped"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const WORKFLOW_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface IWorkflowError {
  code: string;
  message: string;
}

export interface IStage {
  name: StageName;
  status: StageStatus;
  output: Record<string, string>; // ids of what the stage produced, e.g. { generatedCodeId: "..." }
  error?: IWorkflowError | undefined;
  retryCount: number;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
}

export interface ISDLCWorkflow extends Document {
  project: Types.ObjectId;
  requirement: Types.ObjectId;
  userStory: Types.ObjectId;
  status: WorkflowStatus;
  currentStage?: StageName | undefined;
  stages: IStage[];
  error?: IWorkflowError | undefined;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const errorSchema = new Schema<IWorkflowError>(
  { code: { type: String, required: true }, message: { type: String, required: true } },
  { _id: false },
);

const stageSchema = new Schema<IStage>(
  {
    name: { type: String, enum: STAGE_NAMES, required: true },
    status: { type: String, enum: STAGE_STATUSES, default: "pending" },
    output: { type: Schema.Types.Mixed, default: {} },
    error: { type: errorSchema },
    retryCount: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false },
);

const sdlcWorkflowSchema = new Schema<ISDLCWorkflow>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    requirement: { type: Schema.Types.ObjectId, ref: "Requirement", required: true },
    userStory: { type: Schema.Types.ObjectId, ref: "UserStory", required: true },
    status: { type: String, enum: WORKFLOW_STATUSES, default: "queued" },
    currentStage: { type: String, enum: STAGE_NAMES },
    stages: { type: [stageSchema], required: true },
    error: { type: errorSchema },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Main query: "runs for this user story, newest first".
sdlcWorkflowSchema.index({ userStory: 1, createdAt: -1 });

export default mongoose.model<ISDLCWorkflow>("SDLCWorkflow", sdlcWorkflowSchema);