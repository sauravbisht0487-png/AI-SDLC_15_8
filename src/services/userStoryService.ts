import * as userStoryRepository from "../repositories/userStoryRepository";

import * as githubService from "./githubService";

import * as generatedCodeRepository from "../repositories/generatedCodeRepository";
import * as aiService from "./aiService";




export const createUserStory = async (
  title: string,
  description: string,
  acceptanceCriteria: string[],
  requirementId: string,
  createdBy: string
) => {
  return userStoryRepository.create(title, description, acceptanceCriteria, requirementId, createdBy);
};

export const getUserStoriesForRequirement = async (requirementId: string) => {
  return userStoryRepository.findByRequirement(requirementId);
};
export const updateUserStory = async (
  id: string,
  updates: { title?: string; description?: string; acceptanceCriteria?: string[] }
) => {
  return userStoryRepository.updateById(id, updates);
};

export const deleteUserStory = async (id: string) => {
  return userStoryRepository.deleteById(id);
};


export const generateCodeForUserStory = async (
  storyId: string,
  storyTitle: string,
  storyDescription: string,
  acceptanceCriteria: string[],
  createdBy: string
) => {
  const files = await aiService.generateCodeForStory(storyTitle, storyDescription, acceptanceCriteria);
  return generatedCodeRepository.create(storyId, files, createdBy);
};
export const pushGeneratedCodeToGithub = async (
  generatedCodeId: string,
  repoName: string
) => {
  const generatedCode = await generatedCodeRepository.findById(generatedCodeId);
  if (!generatedCode) {
    throw new Error("Generated code not found");
  }

  for (const file of generatedCode.files) {
    await githubService.pushFileToRepo(
      repoName,
      file.filename,
      file.code,
      `Add ${file.filename} (AI-generated)`
    );
  }

  return generatedCode;
};