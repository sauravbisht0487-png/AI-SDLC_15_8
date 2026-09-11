import { Router } from "express";
import { authenticate } from "../middlewares/authenticate";
import { checkOrgOwnership } from "../middlewares/checkOrgOwnership";

import {
  createOrganization,
  listOrganizations,
  updateOrganization,
  deleteOrganization,
  createProject,
  listProjects,
  createGithubRepo,
  updateProject,
  deleteProject,
} from "../controllers/organizationController";
import requirementRoutes from "./requirementRoutes";
import { checkProjectAccess } from "../middlewares/checkProjectAccess";

const router = Router();

router.post("/", authenticate, createOrganization);
router.get("/", authenticate, listOrganizations);

router.post("/:orgId/projects", authenticate, checkOrgOwnership, createProject);
router.get("/:orgId/projects", authenticate, checkOrgOwnership, listProjects);
router.put("/:orgId/projects/:projectId", authenticate, checkProjectAccess, updateProject);
router.delete("/:orgId/projects/:projectId", authenticate, checkProjectAccess, deleteProject);

router.put("/:orgId", authenticate, checkOrgOwnership, updateOrganization);
router.delete("/:orgId", authenticate, checkOrgOwnership, deleteOrganization);

router.post("/:orgId/projects/:projectId/github/create-repo", authenticate, checkProjectAccess, createGithubRepo);

router.use("/:orgId/projects/:projectId/requirements", requirementRoutes);

export default router;