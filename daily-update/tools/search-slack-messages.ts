import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, slackClientFromEnv, slackError } from "./clients/slack.js";

/**
 * Search Slack messages visible to the user token for digest framing.
 * Prefer a focused query; pass `after` (Unix seconds) to bound the window.
 */
export const searchSlackMessages = tool(
  async ({ query, after, count }) => {
    const client = slackClientFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const parts = [query.trim()];
    if (after !== undefined) {
      parts.push(`after:${after}`);
    }
    let result;
    try {
      result = await client.search.messages({
        query: parts.filter(Boolean).join(" "),
        count: Math.min(count ?? 20, 50),
        sort: "timestamp",
        sort_dir: "desc",
      });
    } catch (err) {
      return slackError(err);
    }

    if (!result.ok) {
      return jsonResult({
        error: result.error ?? "Slack search.messages failed",
      });
    }

    const matches = result.messages?.matches ?? [];
    return jsonResult(
      matches.map((match) => ({
        channel: match.channel?.name ?? match.channel?.id ?? null,
        channelId: match.channel?.id ?? null,
        user: match.user ?? match.username ?? null,
        text: match.text,
        ts: match.ts,
        permalink: match.permalink,
      }))
    );
  },
  {
    name: "search_slack_messages",
    description:
      "Search Slack messages the user token can see. Use for discussion framing (themes, decisions, blockers), not as proof of shipped GitHub work.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Slack search query. Can be empty when `after` bounds the window; otherwise keywords, from:<user>, in:<channel>, etc."
        ),
      after: z
        .number()
        .int()
        .optional()
        .describe("Unix timestamp (seconds). Only messages after this time."),
      count: z.number().int().min(1).max(50).optional(),
    }),
  }
);
