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
