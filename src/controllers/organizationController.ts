import { Request, Response } from "express";
import * as organizationService from "../services/organizationService";
import * as projectService from "../services/projectService";
import { ParamsDictionary } from "express-serve-static-core";

interface OrgParams extends  ParamsDictionary {
  orgId: string;
}

interface OrgProjectParams extends ParamsDictionary {
  projectId: string;
}

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ message: "Organization name is required" });
      return;
    }
    const org = await organizationService.createOrganization(name, req.userId!);
    res.status(201).json(org);
  } catch (error) {
    res.status(500).json({ message: "Failed to create organization" });
  }
};

export const listOrganizations = async (req: Request, res: Response) => {
  try {
    const orgs = await organizationService.getUserOrganizations(req.userId!);
    res.status(200).json(orgs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
};

// Note: Request<OrgParams> — this is what fixes the error
export const createProject = async (req: Request<OrgParams>, res: Response) => {
  try {
    const { name, description } = req.body;
    const { orgId } = req.params; // now guaranteed to be `string`, not `string | string[]`
    const userId = req.userId!;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Project name is required" });
      return;
    }

    const project = await projectService.createProject(
      name.trim(),
      description,
      orgId,
      userId
    );
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to create project" });
  }
};

export const listProjects = async (req: Request<OrgParams>, res: Response) => {
  try {
    const { orgId } = req.params;
    const projects = await projectService.getProjectsForOrg(orgId);
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};
export const updateOrganization = async (req: Request<OrgParams>, res: Response) => {
  try {
    const { orgId } = req.params;
    const { name } = req.body;

    const updates: { name?: string } = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields provided to update" });
      return;
    }

    const updated = await organizationService.updateOrganization(orgId, updates);
    if (!updated) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization" });
  }
};

export const deleteOrganization = async (req: Request<OrgParams>, res: Response) => {
  try {
    const { orgId } = req.params;
    const deleted = await organizationService.deleteOrganization(orgId);
    if (!deleted) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }
    res.status(200).json({ message: "Organization deleted", organization: deleted });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete organization" });
  }
};

export const createGithubRepo = async (req: Request<OrgProjectParams>, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = req.project; // attached by checkProjectAccess

    if (!project) {
      res.status(500).json({ message: "Project not found on request" });
      return;
    }
    if (project.githubRepoUrl) {
      res.status(400).json({ message: "This project already has a GitHub repo", repoUrl: project.githubRepoUrl });
      return;
    }

    const updated = await projectService.createGithubRepoForProject(projectId, project.name);
    res.status(201).json(updated);
  } catch (error) {
    console.error("createGithubRepo error:", error);
    res.status(500).json({ message: "Failed to create GitHub repo" });
  }
};
export const updateProject = async (req: Request<OrgProjectParams>, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    const updates: { name?: string; description?: string } = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof description === "string") updates.description = description.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields provided to update" });
      return;
    }

    const updated = await projectService.updateProject(projectId, updates);
    if (!updated) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update project" });
  }
};

export const deleteProject = async (req: Request<OrgProjectParams>, res: Response) => {
  try {
    const { projectId } = req.params;
    const deleted = await projectService.deleteProject(projectId);
    if (!deleted) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    res.status(200).json({ message: "Project deleted", project: deleted });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete project" });
  }
};