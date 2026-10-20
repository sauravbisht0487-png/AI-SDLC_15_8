import { Request, Response, NextFunction } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import Project from "../models/Project";
import Requirement from "../models/Requirement";
import { verifyOrgOwnership } from "../utils/ownership";
import * as projectRepository from "../repositories/projectRepository";
import * as requirementRepository from "../repositories/requirementRepository";
import logger from "../utils/logger";

interface FullChainParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
}

export const checkRequirementAccess = async (
  req: Request<FullChainParams>,
  res: Response,
  next: NextFunction
) => {
  const { orgId, projectId, requirementId } = req.params;
  try {
    const userId = req.userId!;

    const orgResult = await verifyOrgOwnership(orgId, userId);
    if ("error" in orgResult) {
      res.status(orgResult.error.status).json({ message: orgResult.error.message });
      return;
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    if (project.organization.toString() !== orgId) {
      res.status(404).json({ message: "Project not found in this organization" });
      return;
    }

    const requirement = await requirementRepository.findById(requirementId);
    if (!requirement) {
      res.status(404).json({ message: "Requirement not found" });
      return;
    }
    if (requirement.project.toString() !== projectId) {
      res.status(404).json({ message: "Requirement not found in this project" });
      return;
    }

    req.organization = orgResult.organization;
    req.project = project;
    req.requirement = requirement;
    next();
  } catch (error: any) {
    logger.error("checkRequirementAccess failed", { error: error.message, stack: error.stack, orgId, projectId, requirementId });
    res.status(500).json({ message: "Server error checking requirement access" });
  }
};