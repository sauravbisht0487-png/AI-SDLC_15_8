import * as architectureRepository from "../repositories/architectureRepository";
import type { IDesign } from "../models/Architecture";

import * as userStoryService from "./userStoryService";

import { generateDesign } from "./designAiService";

export const saveArchitecture = async (
  requirementId: string,
  projectId: string,
  design: IDesign,
  ai: { provider: string; model: string },
  createdBy: string,
) => {
  return architectureRepository.create({
    requirementId,
    projectId,
    design,
    aiProvider: ai.provider,
    aiModel: ai.model,
    createdBy,
  });
};

export const getLatestArchitecture = async (requirementId: string) => {
  return architectureRepository.findLatestByRequirement(requirementId);
};

export const listArchitectureVersions = async (requirementId: string) => {
  return architectureRepository.listVersions(requirementId);
};

export const generateArchitecture = async (
  requirement: { _id: { toString(): string }; title: string; description: string },
  project: { _id: { toString(): string }; name: string; description?: string | undefined },
  createdBy: string,
) => {
  const requirementId = requirement._id.toString();
  const stories = await userStoryService.getUserStoriesForRequirement(requirementId);

  const { design, provider, model } = await generateDesign({
    project: { name: project.name, description: project.description },
    requirement: { title: requirement.title, description: requirement.description },
    stories: stories.map((s) => ({
      title: s.title,
      description: s.description,
      acceptanceCriteria: s.acceptanceCriteria,
    })),
  });

  return saveArchitecture(
    requirementId,
    project._id.toString(),
    design,
    { provider, model },
    createdBy,
  );
};