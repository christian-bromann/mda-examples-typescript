import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv, parseRepoSlug } from "./clients/github.js";

/** High-level repository metadata for the target slug. */
export const fetchRepoOverview = tool(
  async ({ repository }) => {
    const client = octokitFromEnv();
    if ("error" in client) return jsonResult({ error: client.error });

    const parsed = parseRepoSlug(repository);
    if ("error" in parsed) return jsonResult({ error: parsed.error });

    const { data } = await client.rest.repos.get({
      owner: parsed.owner,
      repo: parsed.repo,
    });

    return jsonResult({
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      visibility: data.private ? "private" : "public",
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      watchers: data.subscribers_count,
      language: data.language,
      createdAt: data.created_at,
      pushedAt: data.pushed_at,
      url: data.html_url,
    });
  },
  {
    name: "fetch_repo_overview",
    description:
      "Fetch high-level metadata for a GitHub repository (stars, forks, language, last push).",
    schema: z.object({
      repository: z
        .string()
        .min(3)
        .describe("Repository slug as owner/repo (e.g. langchain-ai/langchain)."),
    }),
  }
);
