import { Octokit } from "@octokit/rest";

const getClient = (): Octokit => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return new Octokit({ auth: token });
};

export const createRepoForProject = async (
  repoName: string
): Promise<{ repoName: string; repoUrl: string }> => {
  const octokit = getClient();

  const response = await octokit.repos.createForAuthenticatedUser({
    name: repoName,
    private: true,
    auto_init: true, // creates an initial commit with a README, so the repo isn't empty
  });

  return { repoName: response.data.name, repoUrl: response.data.html_url };
};

export const pushFileToRepo = async (
  repoName: string,
  filePath: string,
  content: string,
  commitMessage: string
): Promise<void> => {
  const octokit = getClient();
  const owner = process.env.GITHUB_USERNAME;
  if (!owner) {
    throw new Error("GITHUB_USERNAME is not configured");
  }

  // GitHub's API requires file content to be base64-encoded
  const encodedContent = Buffer.from(content, "utf-8").toString("base64");

  // Check if the file already exists — needed to get its current `sha` for updates
  let existingSha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({ owner, repo: repoName, path: filePath });
    if (!Array.isArray(existing.data) && "sha" in existing.data) {
      existingSha = existing.data.sha;
    }
  } catch (error: any) {
    if (error.status !== 404) throw error; // 404 just means the file doesn't exist yet — fine
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: filePath,
    message: commitMessage,
    content: encodedContent,
    ...(existingSha ? { sha: existingSha } : {}), // required for updates
  });
};