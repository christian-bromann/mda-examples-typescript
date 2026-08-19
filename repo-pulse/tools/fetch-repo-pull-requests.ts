import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv, parseRepoSlug } from "./clients/github.js";

/**
 * Recent pull requests for contributor / review-latency analysis.
 * Prefer writing this JSON to `/workspace/data/prs.json` before pandas work.
 */
export const fetchRepoPullRequests = tool(
  async ({ repository, state, limit, updatedSince }) => {
    const client = octokitFromEnv();
    if ("error" in client) return jsonResult({ error: client.error });

    const parsed = parseRepoSlug(repository);
    if ("error" in parsed) return jsonResult({ error: parsed.error });

    const perPage = Math.min(limit ?? 50, 100);
    const { data } = await client.rest.pulls.list({
      owner: parsed.owner,
      repo: parsed.repo,
      state,
      sort: "updated",
      direction: "desc",
      per_page: perPage,
    });

    const since = updatedSince?.slice(0, 10);
    const items = data
      .filter((pr) => {
        if (!since) return true;
        return (pr.updated_at ?? "").slice(0, 10) >= since;
      })
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft ?? false,
        user: pr.user?.login ?? null,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
      }));

    return jsonResult({
      repository: `${parsed.owner}/${parsed.repo}`,
      count: items.length,
      pullRequests: items,
      hint: "Write this JSON to /workspace/data/prs.json, then analyze with pandas.",
    });
  },
  {
    name: "fetch_repo_pull_requests",
    description:
      "List recent pull requests for a repository (authors, merge times, churn). Use for contributor and latency charts.",
    schema: z.object({
      repository: z.string().min(3).describe("owner/repo"),
      state: z
        .enum(["open", "closed", "all"])
        .default("all")
        .describe("PR state filter."),
      limit: z.number().int().min(1).max(100).optional(),
      updatedSince: z
        .string()
        .min(10)
        .optional()
        .describe("Optional YYYY-MM-DD; keep PRs updated on/after this day."),
    }),
  }
);
