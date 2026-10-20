import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import mongoose from "mongoose";
import * as pipelineService from "../services/pipelineService";
import logger from "../utils/logger";

interface PipelineParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
  userStoryId: string;
  workflowId: string;
}

const STATUS_BY_CODE: Record<string, number> = {
  STORY_NOT_FOUND: 404,
  PIPELINE_ALREADY_RUNNING: 409,
  QUEUE_UNAVAILABLE: 503,
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const runPipeline = async (req: Request<PipelineParams>, res: Response) => {
  const { requirementId, userStoryId } = req.params;
  const userId = req.userId!;
  if (!mongoose.isValidObjectId(userStoryId)) {
    res.status(404).json({ message: "User story not found" });
    return;
  }
  try {
    const workflow = await pipelineService.startPipeline(
      requirementId,
      req.project!._id.toString(),
      userStoryId,
      userId,
    );
    res.status(202).json(workflow);
  } catch (error: unknown) {
    if (error instanceof pipelineService.PipelineError) {
      res.status(STATUS_BY_CODE[error.code] ?? 500).json({ message: error.message, code: error.code });
      return;
    }
    logger.error("Failed to start pipeline", { error: message(error), userStoryId, userId });
    res.status(500).json({ message: "Failed to start pipeline" });
  }
};

export const listWorkflows = async (req: Request<PipelineParams>, res: Response) => {
  const { requirementId, userStoryId } = req.params;
  if (!mongoose.isValidObjectId(userStoryId)) {
    res.status(404).json({ message: "User story not found" });
    return;
  }
  try {
    const workflows = await pipelineService.listWorkflows(requirementId, userStoryId);
    if (!workflows) {
      res.status(404).json({ message: "User story not found" });
      return;
    }
    res.status(200).json(workflows);
  } catch (error: unknown) {
    logger.error("Failed to list workflows", { error: message(error), userStoryId });
    res.status(500).json({ message: "Failed to list workflows" });
  }
};

export const getWorkflow = async (req: Request<PipelineParams>, res: Response) => {
  const { requirementId, userStoryId, workflowId } = req.params;
  if (!mongoose.isValidObjectId(userStoryId) || !mongoose.isValidObjectId(workflowId)) {
    res.status(404).json({ message: "Workflow not found" });
    return;
  }
  try {
    const workflow = await pipelineService.getWorkflow(requirementId, userStoryId, workflowId);
    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }
    res.status(200).json(workflow);
  } catch (error: unknown) {
    logger.error("Failed to fetch workflow", { error: message(error), workflowId });
    res.status(500).json({ message: "Failed to fetch workflow" });
  }
};

export const getTestRun = async (req: Request<PipelineParams>, res: Response) => {
  const { requirementId, userStoryId, workflowId } = req.params;
  if (!mongoose.isValidObjectId(userStoryId) || !mongoose.isValidObjectId(workflowId)) {
    res.status(404).json({ message: "Test run not found" });
    return;
  }
  try {
    const run = await pipelineService.getLatestTestRun(requirementId, userStoryId, workflowId);
    if (!run) {
      res.status(404).json({ message: "Test run not found" });
      return;
    }
    res.status(200).json(run);
  } catch (error: unknown) {
    logger.error("Failed to fetch test run", { error: message(error), workflowId });
    res.status(500).json({ message: "Failed to fetch test run" });
  }
};