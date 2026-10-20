import * as workflowRepository from "../repositories/sdlcWorkflowRepository";
import type { StageName } from "../models/SDLCWorkflow";

export const createWorkflow = async (
  projectId: string,
  requirementId: string,
  userStoryId: string,
  createdBy: string,
) => workflowRepository.create({ projectId, requirementId, userStoryId, createdBy });

export const getWorkflow = async (id: string) => workflowRepository.findById(id);

export const listWorkflowsForStory = async (userStoryId: string) =>
  workflowRepository.findByUserStory(userStoryId);

// isRetry = true when this stage already failed once and we are running it again.
export const startStage = async (workflowId: string, stage: StageName, isRetry = false) => {
  const now = new Date();
  await workflowRepository.updateStage(workflowId, stage, {
    status: "running",
    startedAt: now,
    clearError: true,
    incrementRetry: isRetry,
  });
  return workflowRepository.updateWorkflow(workflowId, {
    status: "running",
    currentStage: stage,
    clearError: true,
    startedAtIfMissing: now,
  });
};

export const succeedStage = async (
  workflowId: string,
  stage: StageName,
  output: Record<string, string> = {},
) =>
  workflowRepository.updateStage(workflowId, stage, {
    status: "succeeded",
    output,
    completedAt: new Date(),
  });

// Predictable failure code per stage: CODE_GENERATION_FAILED, TEST_EXECUTION_FAILED, ...
export const failStage = async (workflowId: string, stage: StageName, message: string) => {
  const now = new Date();
  const error = { code: `${stage}_FAILED`, message };
  await workflowRepository.updateStage(workflowId, stage, {
    status: "failed",
    error,
    completedAt: now,
  });
  return workflowRepository.updateWorkflow(workflowId, {
    status: "failed",
    error,
    completedAt: now,
  });
};

export const completeWorkflow = async (workflowId: string) =>
  workflowRepository.updateWorkflow(workflowId, {
    status: "succeeded",
    clearCurrentStage: true,
    completedAt: new Date(),
  });
export const skipStage = async (workflowId: string, stage: StageName) =>
  workflowRepository.updateStage(workflowId, stage, {
    status: "skipped",
    completedAt: new Date(),
  });