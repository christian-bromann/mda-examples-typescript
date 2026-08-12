import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, linearGraphql } from "./clients/linear.js";

type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  updatedAt: string;
  completedAt: string | null;
  createdAt: string;
  state: { name: string; type: string } | null;
  team: { name: string; key: string } | null;
  project: { name: string } | null;
  assignee: { id: string; name: string } | null;
  creator: { id: string; name: string } | null;
};

type IssuesData = {
  viewer: {
    id: string;
    assignedIssues: { nodes: LinearIssueNode[] };
    createdIssues: { nodes: LinearIssueNode[] };
  };
};

/**
 * Issues assigned to or created by the authenticated Linear user, updated on
 * or after `since` (ISO-8601).
 */
export const searchLinearIssues = tool(
  async ({ since, limit }) => {
    const first = Math.min(limit ?? 50, 50);
    const result = await linearGraphql<IssuesData>(
      `
      query SearchMyLinearIssues($since: DateTimeOrDuration!, $first: Int!) {
        viewer {
          id
          assignedIssues(
            first: $first
            orderBy: updatedAt
            filter: { updatedAt: { gte: $since } }
          ) {
            nodes {
              id
              identifier
              title
              url
              priority
              updatedAt
              completedAt
              createdAt
              state { name type }
              team { name key }
              project { name }
              assignee { id name }
              creator { id name }
            }
          }
          createdIssues(
            first: $first
            orderBy: updatedAt
            filter: { updatedAt: { gte: $since } }
          ) {
            nodes {
              id
              identifier
              title
              url
              priority
              updatedAt
              completedAt
              createdAt
              state { name type }
              team { name key }
              project { name }
              assignee { id name }
              creator { id name }
            }
          }
        }
      }
    `,
      { since, first }
    );
    if ("error" in result) {
      return jsonResult({ error: result.error });
    }

    const viewerId = result.data.viewer.id;
    const byId = new Map<string, ReturnType<typeof summarizeIssue>>();

    for (const issue of result.data.viewer.assignedIssues.nodes) {
      byId.set(issue.id, summarizeIssue(issue, viewerId, "assignee"));
    }
    for (const issue of result.data.viewer.createdIssues.nodes) {
      const existing = byId.get(issue.id);
      if (existing) {
        existing.roles = Array.from(
          new Set<("assignee" | "creator")>([...existing.roles, "creator"])
        ).sort();
      } else {
        byId.set(issue.id, summarizeIssue(issue, viewerId, "creator"));
      }
    }

    const issues = Array.from(byId.values()).sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1
    );

    return jsonResult(issues.slice(0, first));
  },
  {
    name: "search_linear_issues",
    description:
      "Search Linear issues assigned to or created by the authenticated user, updated on or after `since` (ISO-8601).",
    schema: z.object({
      since: z
        .string()
        .min(1)
        .describe("ISO-8601 lower bound, e.g. 2026-08-05T14:00:00Z."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max issues to return (default 50)."),
    }),
  }
);

function summarizeIssue(
  issue: LinearIssueNode,
  viewerId: string,
  role: "assignee" | "creator"
) {
  const roles = new Set<"assignee" | "creator">([role]);
  if (issue.assignee?.id === viewerId) roles.add("assignee");
  if (issue.creator?.id === viewerId) roles.add("creator");

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    priority: issue.priority,
    state: issue.state?.name ?? null,
    stateType: issue.state?.type ?? null,
    team: issue.team ? `${issue.team.key} (${issue.team.name})` : null,
    project: issue.project?.name ?? null,
    roles: Array.from(roles).sort(),
    updatedAt: issue.updatedAt,
    completedAt: issue.completedAt,
    createdAt: issue.createdAt,
  };
}
