import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as architectureService from "../services/architectureService";
import { sendAIError } from "../utils/aiErrorResponse";
import logger from "../utils/logger";

interface FullChainParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
}

export const generateArchitecture = async (
  req: Request<FullChainParams>,
  res: Response,
) => {
  const { requirementId } = req.params;
  const userId = req.userId!;
  try {
    const requirement = req.requirement!;
    const project = req.project!;

    const architecture = await architectureService.generateArchitecture(
      requirement,
      project,
      userId,
    );
    res.status(201).json(architecture);
  } catch (error: any) {
    logger.error("Failed to generate architecture", {
      error: error.message,
      stack: error.stack,
      requirementId,
      userId,
      code: error?.code,
    });
    if (sendAIError(res, error)) return;
    if (error?.code === 11000) {
      res.status(409).json({ message: "Another design was generated at the same time, please retry" });
      return;
    }
    res.status(500).json({ message: "Failed to generate architecture" });
  }
};

export const getLatestArchitecture = async (
  req: Request<FullChainParams>,
  res: Response,
) => {
  const { requirementId } = req.params;
  try {
    const architecture = await architectureService.getLatestArchitecture(requirementId);
    if (!architecture) {
      res.status(404).json({ message: "No architecture generated for this requirement yet" });
      return;
    }
    res.status(200).json(architecture);
  } catch (error: any) {
    logger.error("Failed to fetch architecture", { error: error.message, stack: error.stack, requirementId });
    res.status(500).json({ message: "Failed to fetch architecture" });
  }
};

export const listArchitectureVersions = async (
  req: Request<FullChainParams>,
  res: Response,
) => {
  const { requirementId } = req.params;
  try {
    const versions = await architectureService.listArchitectureVersions(requirementId);
    res.status(200).json(versions);
  } catch (error: any) {
    logger.error("Failed to list architecture versions", { error: error.message, stack: error.stack, requirementId });
    res.status(500).json({ message: "Failed to list architecture versions" });
  }
};