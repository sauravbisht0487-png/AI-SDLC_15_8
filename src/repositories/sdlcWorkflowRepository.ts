import SDLCWorkflow, {
  STAGE_NAMES,
  type StageName,
  type StageStatus,
  type WorkflowStatus,
  type IWorkflowError,
} from "../models/SDLCWorkflow";

export const create = async (data: {
  projectId: string;
  requirementId: string;
  userStoryId: string;
  createdBy: string;
}) => {
  return SDLCWorkflow.create({
    project: data.projectId,
    requirement: data.requirementId,
    userStory: data.userStoryId,
    status: "queued",
    stages: STAGE_NAMES.map((name) => ({ name, status: "pending", output: {}, retryCount: 0 })),
    createdBy: data.createdBy,
  });
};

export const findById = async (id: string) => SDLCWorkflow.findById(id);

export const findByUserStory = async (userStoryId: string) =>
  SDLCWorkflow.find({ userStory: userStoryId }).sort({ createdAt: -1 });

export interface StagePatch {
  status?: StageStatus;
  output?: Record<string, string>;
  error?: IWorkflowError;
  clearError?: boolean;
  startedAt?: Date;
  completedAt?: Date;
  incrementRetry?: boolean;
}

// Updates one stage inside the stages array. "stages.$" is Mongo's positional
// operator: it means "the array element that matched stages.name in the filter".
export const updateStage = async (workflowId: string, stage: StageName, patch: StagePatch) => {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  if (patch.status) set["stages.$.status"] = patch.status;
  if (patch.output) set["stages.$.output"] = patch.output;
  if (patch.error) set["stages.$.error"] = patch.error;
  if (patch.startedAt) set["stages.$.startedAt"] = patch.startedAt;
  if (patch.completedAt) set["stages.$.completedAt"] = patch.completedAt;
  if (patch.clearError) unset["stages.$.error"] = "";

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update["$set"] = set;
  if (Object.keys(unset).length > 0) update["$unset"] = unset;
  if (patch.incrementRetry) update["$inc"] = { "stages.$.retryCount": 1 };

  return SDLCWorkflow.findOneAndUpdate({ _id: workflowId, "stages.name": stage }, update, {
    new: true,
  });
};

export interface WorkflowPatch {
  status?: WorkflowStatus;
  currentStage?: StageName;
  clearCurrentStage?: boolean;
  error?: IWorkflowError;
  clearError?: boolean;
  startedAtIfMissing?: Date;
  completedAt?: Date;
}

export const updateWorkflow = async (workflowId: string, patch: WorkflowPatch) => {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  if (patch.status) set["status"] = patch.status;
  if (patch.currentStage) set["currentStage"] = patch.currentStage;
  if (patch.error) set["error"] = patch.error;
  if (patch.completedAt) set["completedAt"] = patch.completedAt;
  if (patch.clearCurrentStage) unset["currentStage"] = "";
  if (patch.clearError) unset["error"] = "";

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update["$set"] = set;
  if (Object.keys(unset).length > 0) update["$unset"] = unset;
  // $min on a missing field sets it, so startedAt is written only the first time.
  if (patch.startedAtIfMissing) update["$min"] = { startedAt: patch.startedAtIfMissing };

  return SDLCWorkflow.findByIdAndUpdate(workflowId, update, { new: true });
};
export const findActiveByUserStory = async (userStoryId: string, since: Date) =>
  SDLCWorkflow.findOne({
    userStory: userStoryId,
    status: { $in: ["queued", "running"] },
    updatedAt: { $gte: since },
  });

