import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv, parseRepoSlug } from "./clients/github.js";

/** Contributor commit totals (GitHub contributors API). */
export const fetchRepoContributors = tool(
  async ({ repository, limit }) => {
    const client = octokitFromEnv();
    if ("error" in client) return jsonResult({ error: client.error });

    const parsed = parseRepoSlug(repository);
    if ("error" in parsed) return jsonResult({ error: parsed.error });

    const { data } = await client.rest.repos.listContributors({
      owner: parsed.owner,
      repo: parsed.repo,
      per_page: Math.min(limit ?? 30, 100),
      anon: "false",
    });

    const contributors = data.map((c) => ({
      login: "login" in c ? c.login : null,
      contributions: c.contributions,
      type: "type" in c ? c.type : null,
      url: "html_url" in c ? c.html_url : null,
    }));

    const total = contributors.reduce((sum, c) => sum + (c.contributions ?? 0), 0);
    const topShare =
      total > 0 && contributors[0]
        ? Number(((contributors[0].contributions / total) * 100).toFixed(1))
        : null;

    return jsonResult({
      repository: `${parsed.owner}/${parsed.repo}`,
      contributorCount: contributors.length,
      totalContributions: total,
      topContributorSharePct: topShare,
      contributors,
      hint: "Write to /workspace/data/contributors.json for bus-factor / Pareto charts.",
    });
  },
  {
    name: "fetch_repo_contributors",
    description:
      "List repository contributors by commit count. Use for bus-factor and concentration charts.",
    schema: z.object({
      repository: z.string().min(3).describe("owner/repo"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
  }
);
