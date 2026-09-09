import { Request, Response, NextFunction } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import Organization from "../models/Organization";
import Project from "../models/Project";
import * as projectRepository from "../repositories/projectRepository";

interface OrgProjectParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
}

export const checkProjectAccess = async (
  req: Request<OrgProjectParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orgId, projectId } = req.params;
    const userId = req.userId!;

    const organization = await Organization.findById(orgId);
    if (!organization) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }
    if (organization.owner.toString() !== userId) {
      res.status(403).json({ message: "Not authorized to access this organization" });
      return;
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    if (project.organization.toString() !== orgId) {
      // The project exists, but not under THIS org — treat as not found,
      // don't leak that a project with this ID exists elsewhere
      res.status(404).json({ message: "Project not found in this organization" });
      return;
    }

    req.project = project;
    req.organization = organization;
    next();
  } catch (error) {
    
    res.status(500).json({ message: "Server error checking project access" });
  }
};