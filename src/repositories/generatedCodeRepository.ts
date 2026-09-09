import GeneratedCode, { IGeneratedCode } from "../models/GeneratedCode";

export const create = async (
  userStoryId: string,
  files: { filename: string; language: string; code: string }[],
  createdBy: string
): Promise<IGeneratedCode> => {
  return GeneratedCode.create({ userStory: userStoryId, files, createdBy });
};

export const findByUserStory = async (userStoryId: string): Promise<IGeneratedCode[]> => {
  return GeneratedCode.find({ userStory: userStoryId });
};

export const findById = async (id: string): Promise<IGeneratedCode | null> => {
  return GeneratedCode.findById(id);
};