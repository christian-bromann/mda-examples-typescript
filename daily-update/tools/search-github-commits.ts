import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv } from "./github-client.js";

/**
 * Commits authored by the authenticated user on/after a calendar date.
 * Best-effort — some private orgs may be missing from search.
 */
export const searchGithubCommits = tool(
  async ({ committerSince, limit }) => {
    const client = octokitFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const day = committerSince.slice(0, 10);
    const q = `author:@me committer-date:>=${day}`;
    const { data } = await client.rest.search.commits({
      q,
      per_page: Math.min(limit ?? 50, 50),
      sort: "committer-date",
      order: "desc",
    });

    return jsonResult(
      data.items.map((item) => ({
        sha: item.sha.slice(0, 7),
        message: item.commit.message.split("\n")[0],
        repository: item.repository.full_name,
        url: item.html_url,
        date: item.commit.committer?.date ?? item.commit.author?.date,
      }))
    );
  },
  {
    name: "search_github_commits",
    description:
      "Search commits authored by the authenticated user on or after a date (best-effort).",
    schema: z.object({
      committerSince: z
        .string()
        .min(10)
        .describe("ISO date or datetime; the YYYY-MM-DD portion is used."),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  }
);
