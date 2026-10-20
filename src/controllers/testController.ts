import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as testService from "../services/testService";
import { sendAIError } from "../utils/aiErrorResponse";
import logger from "../utils/logger";

interface TestParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
  userStoryId: string;
  generatedCodeId: string;
}

export const generateTests = async (req: Request<TestParams>, res: Response) => {
  const { requirementId, userStoryId, generatedCodeId } = req.params;
  const userId = req.userId!;
  try {
    const suite = await testService.generateTestsForGeneratedCode(
      requirementId,
      userStoryId,
      generatedCodeId,
      userId,
    );
    if (!suite) {
      res.status(404).json({ message: "Generated code not found for this user story" });
      return;
    }
    res.status(201).json(suite);
  } catch (error: any) {
    logger.error("Failed to generate tests", {
      error: error.message,
      stack: error.stack,
      userStoryId,
      generatedCodeId,
      userId,
      code: error?.code,
    });
    if (sendAIError(res, error)) return;
    if (error?.code === "NO_BACKEND_FILES") {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Failed to generate tests" });
  }
};