import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { checkProjectAccess } from "../middlewares/checkProjectAccess";
import { checkRequirementAccess } from "../middlewares/checkRequirementAccess";
import { generateCode } from "../controllers/userStoryController";

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

router.use("/:requirementId/userstories", userStoryRoutes);

router.post(
  "/:requirementId/generate-stories",
  authenticate,
  checkRequirementAccess,
  generateStories,
);

export default router;
