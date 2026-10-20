import * as workflowRepository from "../repositories/sdlcWorkflowRepository";
import * as workflowService from "./sdlcWorkflowService";
import * as userStoryService from "./userStoryService";
import { enqueueWorkflow } from "../queue/sdlcQueue";
import logger from "../utils/logger";

import * as testRunRepository from "../repositories/testRunRepository";

const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

export class PipelineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

// The story must exist AND belong to the requirement already checked by the middleware.
const loadStory = async (requirementId: string, userStoryId: string) => {
  const story = await userStoryService.getUserStoryById(userStoryId);
  if (!story || story.requirement.toString() !== requirementId) return null;
  return story;
};

export const startPipeline = async (
  requirementId: string,
  projectId: string,
  userStoryId: string,
  createdBy: string,
) => {
  const story = await loadStory(requirementId, userStoryId);
  if (!story) throw new PipelineError("STORY_NOT_FOUND", "User story not found");

  const active = await workflowRepository.findActiveByUserStory(
    userStoryId,
    new Date(Date.now() - ACTIVE_WINDOW_MS),
  );
  if (active) {
    throw new PipelineError(
      "PIPELINE_ALREADY_RUNNING",
      "A pipeline is already running for this user story",
    );
  }

  const workflow = await workflowService.createWorkflow(
    projectId,
    requirementId,
    userStoryId,
    createdBy,
  );

  try {
    await enqueueWorkflow(workflow._id.toString());
  } catch (err: unknown) {
    logger.error("Failed to enqueue workflow", {
      workflowId: workflow._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
    await workflowRepository.updateWorkflow(workflow._id.toString(), {
      status: "failed",
      error: { code: "QUEUE_UNAVAILABLE", message: "Could not queue the pipeline" },
      completedAt: new Date(),
    });
    throw new PipelineError("QUEUE_UNAVAILABLE", "Pipeline queue is unavailable, try again shortly");
  }

  return workflow;
};

// Returns null if the story is not under this requirement.
export const listWorkflows = async (requirementId: string, userStoryId: string) => {
  const story = await loadStory(requirementId, userStoryId);
  if (!story) return null;
  return workflowService.listWorkflowsForStory(userStoryId);
};

// Returns null unless the workflow belongs to exactly this requirement and story.
export const getWorkflow = async (
  requirementId: string,
  userStoryId: string,
  workflowId: string,
) => {
  const workflow = await workflowService.getWorkflow(workflowId);
  if (
    !workflow ||
    workflow.requirement.toString() !== requirementId ||
    workflow.userStory.toString() !== userStoryId
  ) {
    return null;
  }
  return workflow;
};

// Null when the workflow isn't under this story, or has no test run yet.
export const getLatestTestRun = async (
  requirementId: string,
  userStoryId: string,
  workflowId: string,
) => {
  const workflow = await getWorkflow(requirementId, userStoryId, workflowId);
  if (!workflow) return null;
  return testRunRepository.findLatestByWorkflow(workflowId);
};