import { tool } from "langchain";
import { z } from "zod";

import { jsonResult } from "./json-result.js";
import { xReadClientFromEnv } from "./x-client.js";

/** Recent posts from a watch-account username in focus.md. */
export const getXUserTimeline = tool(
  async ({ username, maxResults }) => {
    const client = xReadClientFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const handle = username.replace(/^@/, "");
    const limit = Math.min(maxResults ?? 25, 50);

    try {
      const user = await client.v2.userByUsername(handle);
      const userId = user.data.id;
      const timeline = await client.v2.userTimeline(userId, {
        max_results: Math.max(5, Math.min(limit, 100)),
        exclude: ["replies", "retweets"],
        "tweet.fields": ["created_at", "public_metrics", "lang"],
      });

      const posts = (timeline.data.data ?? []).slice(0, limit).map((tweet) => ({
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        lang: tweet.lang,
        metrics: tweet.public_metrics,
        author: { username: handle },
        url: `https://x.com/${handle}/status/${tweet.id}`,
      }));

      return jsonResult({ username: handle, count: posts.length, posts });
    } catch (error) {
      return jsonResult({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  {
    name: "get_x_user_timeline",
    description:
      "Fetch recent original posts from an X username in focus.md Watch accounts. For zeitgeist, use maxResults ~20–30 per account.",
    schema: z.object({
      username: z.string().min(1).describe("Handle with or without @."),
      maxResults: z.number().int().min(1).max(50).optional(),
    }),
  }
);
