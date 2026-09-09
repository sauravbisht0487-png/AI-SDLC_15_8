import * as projectRepository from "../repositories/projectRepository";
import * as githubService from "./githubService";
export const createProject = async (
  name: string,
  description: string | undefined,
  organizationId: string,
  createdBy: string
) => {
  return projectRepository.create(name, description, organizationId, createdBy);
};

export const getProjectsForOrg = async (organizationId: string) => {
  return projectRepository.findByOrganization(organizationId);
};


export const createGithubRepoForProject = async (projectId: string, projectName: string) => {
  // sanitize project name into a valid repo name: lowercase, spaces->hyphens, strip invalid chars
  const repoName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { repoName: actualName, repoUrl } = await githubService.createRepoForProject(repoName);
  return projectRepository.setGithubRepo(projectId, actualName, repoUrl);
};