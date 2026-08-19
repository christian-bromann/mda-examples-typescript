import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv, parseRepoSlug } from "./clients/github.js";

/** Recent issues (excluding PRs) for throughput / backlog analysis. */
export const fetchRepoIssues = tool(
  async ({ repository, state, limit, updatedSince }) => {
    const client = octokitFromEnv();
    if ("error" in client) return jsonResult({ error: client.error });

    const parsed = parseRepoSlug(repository);
    if ("error" in parsed) return jsonResult({ error: parsed.error });

    const { data } = await client.rest.issues.listForRepo({
      owner: parsed.owner,
      repo: parsed.repo,
      state,
      sort: "updated",
      direction: "desc",
      per_page: Math.min(limit ?? 50, 100),
    });

    const since = updatedSince?.slice(0, 10);
    const issues = data
      .filter((item) => !item.pull_request)
      .filter((item) => {
        if (!since) return true;
        return (item.updated_at ?? "").slice(0, 10) >= since;
      })
      .map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        user: item.user?.login ?? null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        closedAt: item.closed_at,
        comments: item.comments,
        labels: (item.labels ?? [])
          .map((label) => (typeof label === "string" ? label : label.name))
          .filter(Boolean),
        url: item.html_url,
      }));

    return jsonResult({
      repository: `${parsed.owner}/${parsed.repo}`,
      count: issues.length,
      issues,
      hint: "Write to /workspace/data/issues.json before charting.",
    });
  },
  {
    name: "fetch_repo_issues",
    description:
      "List recent issues (not PRs) for a repository. Use for backlog and time-to-close charts.",
    schema: z.object({
      repository: z.string().min(3).describe("owner/repo"),
      state: z.enum(["open", "closed", "all"]).default("all"),
      limit: z.number().int().min(1).max(100).optional(),
      updatedSince: z.string().min(10).optional().describe("Optional YYYY-MM-DD filter."),
    }),
  }
);
