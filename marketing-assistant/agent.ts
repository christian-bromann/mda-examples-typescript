import { defineDeepAgent } from "managed-deepagents";

import { getXUserTimeline } from "./tools/get-x-user-timeline.js";
import { searchHackerNews } from "./tools/search-hackernews.js";
import { searchXPosts } from "./tools/search-x-posts.js";

/**
 * Marketing assistant — scan public discussion (HN always; X optional),
 * draft tweets from `/memories/agent/focus.md`, DM on Slack for manual posting.
 *
 * Durable memory requires root `memory.ts` (`defineMemory({ scope: "agent" })`).
 * Secrets from `.env` (see `env.example`) — not connectors.
 * System prompt from `instructions.md`.
 */
export const agent = defineDeepAgent({
  name: "mda-example-marketing-assistant-ts",
  model: "openai:gpt-5.5",
  tools: [searchHackerNews, searchXPosts, getXUserTimeline],
});
