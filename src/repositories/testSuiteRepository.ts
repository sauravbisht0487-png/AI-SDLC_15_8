import TestSuite, { ITestFile } from "../models/TestSuite";

export const create = async (data: {
  generatedCodeId: string;
  userStoryId: string;
  files: ITestFile[];
  aiProvider: string;
  aiModel: string;
  createdBy: string;
}) => {
  return TestSuite.create({
    generatedCode: data.generatedCodeId,
    userStory: data.userStoryId,
    files: data.files,
    aiProvider: data.aiProvider,
    aiModel: data.aiModel,
    createdBy: data.createdBy,
  });
};

export const findLatestByGeneratedCode = async (generatedCodeId: string) => {
  return TestSuite.findOne({ generatedCode: generatedCodeId }).sort({ createdAt: -1 });
};

export const findById = async (id: string) => TestSuite.findById(id);

