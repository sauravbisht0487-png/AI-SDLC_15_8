import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import * as requirementService from "../services/requirementService";
import * as aiService from "../services/aiService";
import * as userStoryService from "../services/userStoryService";

interface OrgProjectParams extends ParamsDictionary {
  orgId: string;
  projectId: string;
  requirementId: string;
}

interface FullChainParams extends OrgProjectParams {
  requirementId: string;
}

export const createRequirement = async (
  req: Request<OrgProjectParams>,
  res: Response
) => {
  try {
    const { title, description } = req.body;
    const { projectId } = req.params;
    const userId = req.userId!;

    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ message: "Requirement title is required" });
      return;
    }
    if (typeof description !== "string" || !description.trim()) {
      res.status(400).json({ message: "Requirement description is required" });
      return;
    }

    const requirement = await requirementService.createRequirement(
      title.trim(),
      description.trim(),
      projectId,
      userId
    );
    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ message: "Failed to create requirement" });
  }
};

export const listRequirements = async (
  req: Request<OrgProjectParams>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const requirements = await requirementService.getRequirementsForProject(projectId);
    res.status(200).json(requirements);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch requirements" });
  }
};



export const updateRequirement = async (req: Request<FullChainParams>, res: Response) => {
  try {
    const { requirementId } = req.params;
    const { title, description, status } = req.body;

    const updates: { title?: string; description?: string; status?: "draft" | "approved" | "in_progress" | "done" } = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof description === "string" && description.trim()) updates.description = description.trim();
    if (typeof status === "string") updates.status = status as any; // validated by Mongoose enum + runValidators

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields provided to update" });
      return;
    }

    const updated = await requirementService.updateRequirement(requirementId, updates);
    if (!updated) {
      res.status(404).json({ message: "Requirement not found" });
      return;
    }
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update requirement" });
  }
};

export const deleteRequirement = async (req: Request<FullChainParams>, res: Response) => {
  try {
    const { requirementId } = req.params;
    const deleted = await requirementService.deleteRequirement(requirementId);
    if (!deleted) {
      res.status(404).json({ message: "Requirement not found" });
      return;
    }
    res.status(200).json({ message: "Requirement deleted", requirement: deleted });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete requirement" });
  }
};

export const generateStories = async (req: Request<FullChainParams>, res: Response) => {
  try {
    const userId = req.userId!;
    const requirement = req.requirement; // attached by checkRequirementAccess

    if (!requirement) {
      // defensive — should never happen if middleware ran correctly
      res.status(500).json({ message: "Requirement not found on request" });
      return;
    }

    const generated = await aiService.generateUserStories(
      requirement.title,
      requirement.description
    );

    const created = await Promise.all(
      generated.map((story) =>
        userStoryService.createUserStory(
          story.title,
          story.description,
          story.acceptanceCriteria,
          requirement._id.toString(),
          userId
        )
      )
    );

    res.status(201).json({
      message: `Generated ${created.length} user stories`,
      userStories: created,
    });
  } catch (error) {
    console.error("generateStories error:", error);
    res.status(500).json({ message: "Failed to generate user stories" });
  }
};