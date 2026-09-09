import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { checkRequirementAccess } from "../middlewares/checkRequirementAccess";
import {
  createUserStory,
  listUserStories,
  updateUserStory,
  deleteUserStory,
  pushToGithub,

  // generateCode,
} from "../controllers/userStoryController";

const router = Router({ mergeParams: true });

router.post("/", authenticate, checkRequirementAccess, createUserStory);
router.get("/", authenticate, checkRequirementAccess, listUserStories);
router.put(
  "/:userStoryId",
  authenticate,
  checkRequirementAccess,
  updateUserStory,
);
router.delete(
  "/:userStoryId",
  authenticate,
  checkRequirementAccess,
  deleteUserStory,
);
router.post("/push-to-github", authenticate, checkRequirementAccess, pushToGithub);

// router.post("/:userStoryId/generate-code", authenticate,checkRequirementAccess,generateCode);

export default router;
