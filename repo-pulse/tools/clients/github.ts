import { Octokit } from "@octokit/rest";

/** Deployment-scoped GitHub token from `.env` / deploy secrets. */
export function githubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT;
  return token?.trim() || undefined;
}

export function octokitFromEnv(): Octokit | { error: string } {
  const auth = githubToken();
  if (!auth) {
    return {
      error:
        "No GitHub token configured. Set GITHUB_TOKEN (or GITHUB_PAT) in the deployment environment.",
    };
  }
  return new Octokit({ auth });
}

export function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Parse `owner/repo` (optional `https://github.com/` prefix). */
export function parseRepoSlug(input: string): { owner: string; repo: string } | { error: string } {
  const trimmed = input.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(trimmed);
  if (!match) {
    return {
      error: `Invalid repository slug "${input}". Expected owner/repo.`,
    };
  }
  return { owner: match[1], repo: match[2] };
}
