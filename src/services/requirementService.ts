import * as requirementRepository from "../repositories/requirementRepository";

export const createRequirement = async (
  title: string,
  description: string,
  projectId: string,
  createdBy: string
) => {
  return requirementRepository.create(title, description, projectId, createdBy);
};

export const getRequirementsForProject = async (projectId: string) => {
  return requirementRepository.findByProject(projectId);
};


export const updateRequirement = async (
  id: string,
  updates: { title?: string; description?: string; status?: "draft" | "approved" | "in_progress" | "done" }
) => {
  return requirementRepository.updateById(id, updates);
};

export const deleteRequirement = async (id: string) => {
  return requirementRepository.deleteById(id);
};