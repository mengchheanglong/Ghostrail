/**
 * githubClient.ts — Thin wrapper for the GitHub Issues REST API.
 *
 * createGitHubIssue() accepts an injectable fetchFn for unit testing.
 * At runtime, it uses the global fetch (available in Node 18+).
 *
 * Requires a GitHub Personal Access Token with the `repo` scope
 * (or `public_repo` for public repositories).
 * Set the GITHUB_TOKEN environment variable or pass it in the request body.
 */

export interface GitHubIssueResult {
  /** The HTML URL of the created issue, e.g. https://github.com/owner/repo/issues/42 */
  url: string;
  /** The numeric issue number */
  number: number;
}

interface GitHubApiIssueResponse {
  html_url: string;
  number: number;
}

/**
 * Creates a GitHub issue and returns its URL and number.
 *
 * @param owner     - Repository owner (user or org)
 * @param repo      - Repository name
 * @param title     - Issue title
 * @param body      - Issue body (markdown)
 * @param token     - GitHub Personal Access Token with repo scope
 * @param fetchFn   - Injectable fetch; defaults to globalThis.fetch
 */
export async function createGitHubIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  token: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<GitHubIssueResult> {
  const response = await fetchFn(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title, body }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as GitHubApiIssueResponse;

  if (!data.html_url || typeof data.number !== "number") {
    throw new Error("GitHub API response missing html_url or number");
  }

  return { url: data.html_url, number: data.number };
}
