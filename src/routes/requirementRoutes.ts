import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { checkProjectAccess } from "../middlewares/checkProjectAccess";
import { checkRequirementAccess } from "../middlewares/checkRequirementAccess";
import { generateCode } from "../controllers/userStoryController";
import { generateTests } from "../controllers/testController.js";

import {
  runPipeline,
  listWorkflows,
  getWorkflow,
  getTestRun,
  getTestRunByIdHandler,
  getWorkflowOutputsHandler,
} from "../controllers/workflowController";

import {
  generateArchitecture,
  getLatestArchitecture,
  listArchitectureVersions,
} from "../controllers/architectureController";

import {
  createRequirement,
  listRequirements,
  updateRequirement,
  deleteRequirement,
  generateStories,
} from "../controllers/requirementController";
import userStoryRoutes from "./userStoryRoutes";

const router = Router({ mergeParams: true });

router.post("/", authenticate, checkProjectAccess, createRequirement);
router.get("/", authenticate, checkProjectAccess, listRequirements);

router.put(
  "/:requirementId",
  authenticate,
  checkRequirementAccess,
  updateRequirement,
);
router.post(
  "/:requirementId/userstories/:userStoryId/generate-code",
  authenticate,
  checkRequirementAccess,
  generateCode
);

router.delete(
  "/:requirementId",
  authenticate,
  checkRequirementAccess,
  deleteRequirement,
);

router.post(
  "/:requirementId/userstories/:userStoryId/run-pipeline",
  authenticate,
  checkRequirementAccess,
  runPipeline,
);
router.get(
  "/:requirementId/userstories/:userStoryId/workflows",
  authenticate,
  checkRequirementAccess,
  listWorkflows,
);
router.get(
  "/:requirementId/userstories/:userStoryId/workflows/:workflowId",
  authenticate,
  checkRequirementAccess,
  getWorkflow,
);

router.get(
  "/:requirementId/userstories/:userStoryId/workflows/:workflowId/test-run",
  authenticate,
  checkRequirementAccess,
  getTestRun,
);
router.get(
  "/:requirementId/userstories/:userStoryId/workflows/:workflowId/test-runs/:testRunId",
  authenticate,
  checkRequirementAccess,
  getTestRunByIdHandler,
);
router.get(
  "/:requirementId/userstories/:userStoryId/workflows/:workflowId/outputs",
  authenticate,
  checkRequirementAccess,
  getWorkflowOutputsHandler,
);

router.use("/:requirementId/userstories", userStoryRoutes);

router.post(
  "/:requirementId/userstories/:userStoryId/generated-code/:generatedCodeId/generate-tests",
  authenticate,
  checkRequirementAccess,
  generateTests,
);

router.post(
  "/:requirementId/generate-stories",
  authenticate,
  checkRequirementAccess,
  generateStories,
);
router.post(
  "/:requirementId/architecture/generate",
  authenticate,
  checkRequirementAccess,
  generateArchitecture,
);
router.get(
  "/:requirementId/architecture/versions",
  authenticate,
  checkRequirementAccess,
  listArchitectureVersions,
);
router.get(
  "/:requirementId/architecture",
  authenticate,
  checkRequirementAccess,
  getLatestArchitecture,
);

export default router;