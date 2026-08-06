import { tool } from "langchain";
import { z } from "zod";

import { jsonResult } from "./json-result.js";
import { xReadClientFromEnv } from "./x-client.js";

/** Recent public posts matching a query (raise maxResults for zeitgeist scans). */
export const searchXPosts = tool(
  async ({ query, maxResults }) => {
    const client = xReadClientFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const limit = Math.min(maxResults ?? 25, 50);
    try {
      const result = await client.v2.search(query, {
        max_results: Math.max(10, Math.min(limit, 100)),
        "tweet.fields": ["created_at", "public_metrics", "lang", "author_id"],
        expansions: ["author_id"],
        "user.fields": ["username", "name"],
      });

      const users = new Map(
        (result.includes?.users ?? []).map((user) => [user.id, user])
      );

      const posts = (result.data.data ?? []).slice(0, limit).map((tweet) => {
        const author = tweet.author_id
          ? users.get(tweet.author_id)
          : undefined;
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          lang: tweet.lang,
          metrics: tweet.public_metrics,
          author: author
            ? { id: author.id, username: author.username, name: author.name }
            : { id: tweet.author_id ?? null },
          url: author?.username
            ? `https://x.com/${author.username}/status/${tweet.id}`
            : `https://x.com/i/web/status/${tweet.id}`,
        };
      });

      return jsonResult({ query, count: posts.length, posts });
    } catch (error) {
      return jsonResult({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  {
    name: "search_x_posts",
    description:
      "Search recent public X posts for focus.md niches. For daily zeitgeist scans use maxResults ~25–50 and several queries so you see volume, not a skim.",
    schema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          "X recent-search query, e.g. '(\"deep agents\" OR langgraph) -is:retweet lang:en'."
        ),
      maxResults: z.number().int().min(1).max(50).optional(),
    }),
  }
);
