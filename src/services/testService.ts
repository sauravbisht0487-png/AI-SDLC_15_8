import * as userStoryService from "./userStoryService";
import * as generatedCodeRepository from "../repositories/generatedCodeRepository";
import * as testSuiteRepository from "../repositories/testSuiteRepository";
import { generateTests } from "./testAiService";

// Returns null when the story or generated code doesn't belong together.
export const generateTestsForGeneratedCode = async (
  requirementId: string,
  userStoryId: string,
  generatedCodeId: string,
  createdBy: string,
) => {
  const story = await userStoryService.getUserStoryById(userStoryId);
  if (!story || story.requirement.toString() !== requirementId) return null;

  const generatedCode = await generatedCodeRepository.findById(generatedCodeId);
  if (!generatedCode || generatedCode.userStory.toString() !== userStoryId)
    return null;

  const backendFiles = generatedCode.files.filter((f) =>
    f.filename.startsWith("backend/"),
  );
  if (backendFiles.length === 0) {
    throw Object.assign(
      new Error("This generated code has no backend files to test"),
      {
        code: "NO_BACKEND_FILES",
      },
    );
  }

  const { files, provider, model } = await generateTests({
    storyTitle: story.title,
    acceptanceCriteria: story.acceptanceCriteria,
    backendFiles,
  });

  return testSuiteRepository.create({
    generatedCodeId,
    userStoryId,
    files,
    aiProvider: provider,
    aiModel: model,
    createdBy,
  });
};
