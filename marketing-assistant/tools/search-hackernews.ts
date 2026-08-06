import { tool } from "langchain";
import { z } from "zod";

import { jsonResult } from "./json-result.js";

type AlgoliaHit = {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string;
  story_text?: string | null;
};

/**
 * Search Hacker News via the public Algolia API (no auth).
 * Always available — use when X is unset or as an extra signal.
 */
export const searchHackerNews = tool(
  async ({ query, maxResults }) => {
    const limit = Math.min(maxResults ?? 20, 30);
    const params = new URLSearchParams({
      query,
      tags: "story",
      hitsPerPage: String(limit),
    });

    try {
      const response = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?${params}`
      );
      if (!response.ok) {
        return jsonResult({
          error: `Hacker News search failed (${response.status})`,
        });
      }

      const body = (await response.json()) as { hits?: AlgoliaHit[] };
      const hits = (body.hits ?? []).slice(0, limit).map((hit) => ({
        id: hit.objectID,
        title: hit.title,
        url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
        hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        author: hit.author,
        points: hit.points,
        comments: hit.num_comments,
        createdAt: hit.created_at,
        snippet: hit.story_text?.slice(0, 240) ?? null,
      }));

      return jsonResult({ query, count: hits.length, hits });
    } catch (error) {
      return jsonResult({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  {
    name: "search_hackernews",
    description:
      "Search recent Hacker News stories (public Algolia API, no credentials). For daily zeitgeist scans use several niche queries with maxResults ~20.",
    schema: z.object({
      query: z.string().min(1).describe("Search keywords from focus.md niches."),
      maxResults: z.number().int().min(1).max(30).optional(),
    }),
  }
);
