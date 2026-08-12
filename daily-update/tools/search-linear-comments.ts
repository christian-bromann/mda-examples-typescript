import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, linearGraphql } from "./clients/linear.js";

type CommentNode = {
  id: string;
  body: string;
  createdAt: string;
  url: string | null;
  issue: {
    identifier: string;
    title: string;
    url: string;
    team: { name: string; key: string } | null;
  } | null;
};

type CommentsData = {
  comments: { nodes: CommentNode[] };
};

/**
 * Comments authored by the authenticated Linear user, created on or after
 * `since` (ISO-8601). Pass `userId` from `get_linear_user`.
 */
export const searchLinearComments = tool(
  async ({ userId, since, limit }) => {
    const first = Math.min(limit ?? 50, 50);
    const result = await linearGraphql<CommentsData>(
      `
      query SearchMyLinearComments(
        $userId: ID!
        $since: DateTimeOrDuration!
        $first: Int!
      ) {
        comments(
          first: $first
          orderBy: createdAt
          filter: {
            createdAt: { gte: $since }
            user: { id: { eq: $userId } }
          }
        ) {
          nodes {
            id
            body
            createdAt
            url
            issue {
              identifier
              title
              url
              team { name key }
            }
          }
        }
      }
    `,
      { userId, since, first }
    );
    if ("error" in result) {
      return jsonResult({ error: result.error });
    }

    return jsonResult(
      result.data.comments.nodes.map((comment) => ({
        id: comment.id,
        body: truncate(comment.body, 400),
        createdAt: comment.createdAt,
        url: comment.url,
        issue: comment.issue
          ? {
              identifier: comment.issue.identifier,
              title: comment.issue.title,
              url: comment.issue.url,
              team: comment.issue.team
                ? `${comment.issue.team.key} (${comment.issue.team.name})`
                : null,
            }
          : null,
      }))
    );
  },
  {
    name: "search_linear_comments",
    description:
      "Search Linear comments authored by a user id (from get_linear_user), created on or after `since` (ISO-8601).",
    schema: z.object({
      userId: z
        .string()
        .min(1)
        .describe("Linear user id from get_linear_user."),
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
        .describe("Max comments to return (default 50)."),
    }),
  }
);

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
