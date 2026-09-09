import Requirement, { IRequirement } from "../models/Requirement";

export const create = async (
  title: string,
  description: string,
  projectId: string,
  createdBy: string
): Promise<IRequirement> => {
  return Requirement.create({ title, description, project: projectId, createdBy });
};

export const findById = async (id: string): Promise<IRequirement | null> => {
  return Requirement.findById(id);
};

export const findByProject = async (projectId: string): Promise<IRequirement[]> => {
  return Requirement.find({ project: projectId });
};
export const updateById = async (
  id: string,
  updates: Partial<Pick<IRequirement, "title" | "description" | "status">>
): Promise<IRequirement | null> => {
  return Requirement.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
};

export const deleteById = async (id: string): Promise<IRequirement | null> => {
  return Requirement.findByIdAndDelete(id);
};