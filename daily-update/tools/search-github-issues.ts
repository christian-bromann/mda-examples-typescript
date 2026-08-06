import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv } from "./github-client.js";

/** Authored issues (not PRs) updated on/after a calendar date (YYYY-MM-DD). */
export const searchGithubIssues = tool(
  async ({ updatedSince, limit }) => {
    const client = octokitFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const day = updatedSince.slice(0, 10);
    const q = `author:@me type:issue updated:>=${day}`;
    const { data } = await client.rest.search.issuesAndPullRequests({
      q,
      per_page: Math.min(limit ?? 50, 50),
      sort: "updated",
      order: "desc",
    });

    return jsonResult(
      data.items.map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        repository: item.repository_url?.replace(
          "https://api.github.com/repos/",
          ""
        ),
        url: item.html_url,
        updatedAt: item.updated_at,
      }))
    );
  },
  {
    name: "search_github_issues",
    description:
      "Search issues authored by the authenticated user, updated on or after a date.",
    schema: z.object({
      updatedSince: z
        .string()
        .min(10)
        .describe("ISO date or datetime; the YYYY-MM-DD portion is used."),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  }
);
