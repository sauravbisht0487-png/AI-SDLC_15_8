import Architecture, { IDesign } from "../models/Architecture";

export const create = async (data: {
  requirementId: string;
  projectId: string;
  design: IDesign;
  aiProvider: string;
  aiModel: string;
  createdBy: string;
}) => {
  const latest = await Architecture.findOne({ requirement: data.requirementId })
    .sort({ version: -1 })
    .select("version")
    .lean();

  return Architecture.create({
    requirement: data.requirementId,
    project: data.projectId,
    version: (latest?.version ?? 0) + 1,
    design: data.design,
    aiProvider: data.aiProvider,
    aiModel: data.aiModel,
    createdBy: data.createdBy,
  });
};

export const findLatestByRequirement = async (requirementId: string) => {
  return Architecture.findOne({ requirement: requirementId }).sort({ version: -1 });
};

// Lightweight list (no design body) for a version history view.
export const listVersions = async (requirementId: string) => {
  return Architecture.find({ requirement: requirementId })
    .sort({ version: -1 })
    .select("version status aiProvider aiModel createdAt");
};

export const findById = async (id: string) => {
  return Architecture.findById(id);
};