import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, slackClientFromEnv } from "./slack-client.js";

/** Read a Slack channel or thread when a search hit needs more context. */
export const getSlackThread = tool(
  async ({ channelId, threadTs, limit }) => {
    const client = slackClientFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    if (threadTs) {
      const result = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: Math.min(limit ?? 30, 50),
      });
      if (!result.ok) {
        return jsonResult({
          error: result.error ?? "Slack conversations.replies failed",
        });
      }
      return jsonResult(
        (result.messages ?? []).map((message) => ({
          user: message.user ?? null,
          text: message.text,
          ts: message.ts,
        }))
      );
    }

    const result = await client.conversations.history({
      channel: channelId,
      limit: Math.min(limit ?? 30, 50),
    });
    if (!result.ok) {
      return jsonResult({
        error: result.error ?? "Slack conversations.history failed",
      });
    }
    return jsonResult(
      (result.messages ?? []).map((message) => ({
        user: message.user ?? null,
        text: message.text,
        ts: message.ts,
        threadTs: message.thread_ts ?? null,
      }))
    );
  },
  {
    name: "get_slack_thread",
    description:
      "Read recent messages from a Slack channel, or a thread when threadTs is set. Use after search_slack_messages when a hit needs detail.",
    schema: z.object({
      channelId: z.string().min(1).describe("Slack channel/IM/MPIM id (C…/D…/G…)."),
      threadTs: z
        .string()
        .optional()
        .describe("Parent message ts to read a thread; omit for channel history."),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  }
);
