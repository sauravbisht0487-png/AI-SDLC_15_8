import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as userStoryService from "../services/userStoryService";
import * as projectRepository from "../repositories/projectRepository";

interface FullChainParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
}

export const createUserStory = async (
  req: Request<FullChainParams>,
  res: Response,
) => {
  try {
    const { title, description, acceptanceCriteria } = req.body;
    const { requirementId } = req.params;
    const userId = req.userId!;

    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ message: "User story title is required" });
      return;
    }
    if (typeof description !== "string" || !description.trim()) {
      res.status(400).json({ message: "User story description is required" });
      return;
    }

    const criteria = Array.isArray(acceptanceCriteria)
      ? acceptanceCriteria
      : [];

    const userStory = await userStoryService.createUserStory(
      title.trim(),
      description.trim(),
      criteria,
      requirementId,
      userId,
    );
    res.status(201).json(userStory);
  } catch (error) {
    res.status(500).json({ message: "Failed to create user story" });
  }
};

export const listUserStories = async (
  req: Request<FullChainParams>,
  res: Response,
) => {
  try {
    const { requirementId } = req.params;
    const userStories =
      await userStoryService.getUserStoriesForRequirement(requirementId);
    res.status(200).json(userStories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user stories" });
  }
};
interface UserStoryParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
  userStoryId: string;
}

export const updateUserStory = async (
  req: Request<UserStoryParams>,
  res: Response,
) => {
  try {
    const { userStoryId } = req.params;
    const { title, description, acceptanceCriteria } = req.body;

    const updates: {
      title?: string;
      description?: string;
      acceptanceCriteria?: string[];
    } = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof description === "string" && description.trim())
      updates.description = description.trim();
    if (Array.isArray(acceptanceCriteria))
      updates.acceptanceCriteria = acceptanceCriteria;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields provided to update" });
      return;
    }

    const updated = await userStoryService.updateUserStory(
      userStoryId,
      updates,
    );
    if (!updated) {
      res.status(404).json({ message: "User story not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update user story" });
  }
};

export const deleteUserStory = async (
  req: Request<UserStoryParams>,
  res: Response,
) => {
  try {
    const { userStoryId } = req.params;
    const deleted = await userStoryService.deleteUserStory(userStoryId);
    if (!deleted) {
      res.status(404).json({ message: "User story not found" });
      return;
    }
    res.status(200).json({ message: "User story deleted", userStory: deleted });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user story" });
  }
};

export const generateCode = async (
  req: Request<UserStoryParams>,
  res: Response,
) => {
  try {
    const { userStoryId, requirementId } = req.params;
    const userId = req.userId!;

    // checkRequirementAccess already verified org -> project -> requirement ownership
    // and attached req.project / req.requirement. We still need to confirm THIS
    // userStoryId actually belongs to that requirement, not just that it exists.
    const story = await userStoryService.getUserStoryById(userStoryId);
    if (!story || story.requirement.toString() !== requirementId) {
      res.status(404).json({ message: "User story not found" });
      return;
    }

    const project = req.project!;
    const requirement = req.requirement!;

    const generated = await userStoryService.generateCodeForUserStory(
      story,
      { name: project.name, description: project.description },
      { title: requirement.title, description: requirement.description },
      userId,
    );

    res.status(201).json(generated);
  } catch (error: any) {
    console.error("generateCode error:", error);

    switch (error?.code) {
      case "AI_NOT_CONFIGURED":
        res.status(500).json({ message: error.message });
        return;
      case "AI_RATE_LIMIT":
        res.status(429).json({ message: error.message });
        return;
      case "AI_REQUEST_FAILED":
      case "AI_EMPTY_RESPONSE":
      case "AI_INVALID_SHAPE":
        res.status(502).json({ message: error.message });
        return;
      default:
        res.status(500).json({ message: "Failed to generate code" });
    }
  }
};

export const pushToGithub = async (req: Request<UserStoryParams>, res: Response) => {
  try {
    const { projectId } = req.params;
    const { generatedCodeId } = req.body;

    if (typeof generatedCodeId !== "string") {
      res.status(400).json({ message: "generatedCodeId is required" });
      return;
    }

    const project = await projectRepository.findById(projectId);
    if (!project || !project.githubRepoName) {
      res.status(400).json({ message: "This project has no GitHub repo yet. Create one first." });
      return;
    }

    const result = await userStoryService.pushGeneratedCodeToGithub(
      generatedCodeId,
      project.githubRepoName
    );

    res.status(200).json({ message: "Code pushed to GitHub successfully", generatedCode: result });
  } catch (error) {
    console.error("pushToGithub error:", error);
    res.status(500).json({ message: "Failed to push code to GitHub" });
  }
};