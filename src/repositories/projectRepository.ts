import Project, { IProject } from "../models/Project";

export const create = async (
  name: string,
  description: string | undefined,
  organizationId: string,
  createdBy: string
): Promise<IProject> => {
  return Project.create({ name, description, organization: organizationId, createdBy });
};

export const findById = async (id: string): Promise<IProject | null> => {
  return Project.findById(id);
};

export const findByOrganization = async (organizationId: string): Promise<IProject[]> => {
  return Project.find({ organization: organizationId });
};
export const updateById = async (
  id: string,
  updates: Partial<Pick<IProject, "name" | "description">>
): Promise<IProject | null> => {
  return Project.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
};

export const deleteById = async (id: string): Promise<IProject | null> => {
  return Project.findByIdAndDelete(id);
};

export const setGithubRepo = async (
  id: string,
  githubRepoName: string,
  githubRepoUrl: string
): Promise<IProject | null> => {
  return Project.findByIdAndUpdate(id, { githubRepoName, githubRepoUrl }, { new: true });
};