import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv } from "./github-client.js";

/**
 * Recent public + private account events for the authenticated user, filtered
 * to `since` (ISO-8601).
 */
export const listGithubEvents = tool(
  async ({ login, since, limit }) => {
    const client = octokitFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const perPage = 100;
    const maxItems = Math.min(limit ?? 80, 100);
    const events: unknown[] = [];
    let page = 1;

    while (events.length < maxItems && page <= 3) {
      // Authenticated `/users/{username}/events` includes private events the
      // token can see when `login` is the token owner.
      const { data } = await client.rest.activity.listEventsForAuthenticatedUser({
        username: login,
        per_page: perPage,
        page,
      });
      if (data.length === 0) break;

      for (const event of data) {
        if (event.created_at && event.created_at < since) {
          return jsonResult(events.slice(0, maxItems));
        }
        events.push({
          id: event.id,
          type: event.type,
          created_at: event.created_at,
          repo: event.repo?.name ?? null,
          payload: summarizePayload(event.type, event.payload),
        });
        if (events.length >= maxItems) break;
      }

      if (data.length < perPage) break;
      page += 1;
    }

    return jsonResult(events.slice(0, maxItems));
  },
  {
    name: "list_github_events",
    description:
      "List recent GitHub account events for a user login, newer than `since` (ISO-8601).",
    schema: z.object({
      login: z.string().min(1).describe("GitHub username from get_github_user."),
      since: z
        .string()
        .min(1)
        .describe("ISO-8601 lower bound, e.g. 2026-08-05T14:00:00Z."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max events to return (default 80)."),
    }),
  }
);

function summarizePayload(
  type: string | null | undefined,
  payload: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!payload) return null;
  switch (type) {
    case "PushEvent": {
      const commits = Array.isArray(payload.commits) ? payload.commits : [];
      return {
        ref: payload.ref,
        size: payload.size,
        commits: commits.slice(0, 5).map((commit) => {
          const c = commit as { sha?: string; message?: string };
          return { sha: c.sha?.slice(0, 7), message: c.message };
        }),
      };
    }
    case "PullRequestEvent":
    case "PullRequestReviewEvent":
    case "PullRequestReviewCommentEvent": {
      const pr = payload.pull_request as
        | { number?: number; title?: string; html_url?: string }
        | undefined;
      return {
        action: payload.action,
        number: pr?.number,
        title: pr?.title,
        url: pr?.html_url,
      };
    }
    case "IssuesEvent":
    case "IssueCommentEvent": {
      const issue = payload.issue as
        | { number?: number; title?: string; html_url?: string }
        | undefined;
      return {
        action: payload.action,
        number: issue?.number,
        title: issue?.title,
        url: issue?.html_url,
      };
    }
    case "CreateEvent":
    case "DeleteEvent":
      return { ref_type: payload.ref_type, ref: payload.ref };
    default:
      return { action: payload.action };
  }
}
