import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as userStoryService from "../services/userStoryService";
import * as projectRepository from "../repositories/projectRepository";
import logger from "../utils/logger";
import { sendAIError } from "../utils/aiErrorResponse";

import * as generatedCodeRepository from "../repositories/generatedCodeRepository";

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
  } catch (error: any) {
    logger.error("Failed to create user story", { error: error.message, stack: error.stack, requirementId: req.params.requirementId });
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
  } catch (error: any) {
    logger.error("Failed to fetch user stories", { error: error.message, stack: error.stack, requirementId: req.params.requirementId });
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
  } catch (error: any) {
    logger.error("Failed to update user story", { error: error.message, stack: error.stack, userStoryId: req.params.userStoryId });
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
  } catch (error: any) {
    logger.error("Failed to delete user story", { error: error.message, stack: error.stack, userStoryId: req.params.userStoryId });
    res.status(500).json({ message: "Failed to delete user story" });
  }
};
export const generateCode = async (
  req: Request<UserStoryParams>,
  res: Response,
) => {
  const { userStoryId, requirementId } = req.params;
  const userId = req.userId!;
  try {
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
    logger.error("Failed to generate code", {
      error: error.message,
      stack: error.stack,
      userStoryId,
      requirementId,
      userId,
      code: error?.code,
    });
    if (sendAIError(res, error)) return;
    res.status(500).json({ message: "Failed to generate code" });
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

    const owned = await generatedCodeRepository.findByIdForProject(generatedCodeId, projectId);
    if (!owned) {
      res.status(404).json({ message: "Generated code not found" });
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
  } catch (error: any) {
    logger.error("Failed to push code to GitHub", { error: error.message, stack: error.stack, projectId: req.params.projectId });
    res.status(500).json({ message: "Failed to push code to GitHub" });
  }
};