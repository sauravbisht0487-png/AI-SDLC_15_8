import mongoose from "mongoose";
import GeneratedCode, { IGeneratedCode } from "../models/GeneratedCode";
import UserStory from "../models/UserStory";
import Requirement from "../models/Requirement";

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

// Returns the generated code only if it belongs to the given project.
export const findByIdForProject = async (
  id: string,
  projectId: string
): Promise<IGeneratedCode | null> => {
  if (!mongoose.isValidObjectId(id)) return null;
  const code = await GeneratedCode.findById(id);
  if (!code) return null;
  const story = await UserStory.findById(code.userStory).select("requirement");
  if (!story) return null;
  const requirement = await Requirement.findOne({
    _id: story.requirement,
    project: projectId,
  }).select("_id");
  return requirement ? code : null;
};