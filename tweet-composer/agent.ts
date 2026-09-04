import { defineDeepAgent } from "managed-deepagents";

/**
 * Tweet Composer — draft and post launch tweets from a GitHub PR.
 *
 * Paste a PR URL; the agent uses user-scoped GitHub + X MCP connectors to
 * research the change and current conversation on X, then proposes one tweet.
 * Posting is gated with `interruptOn` so the UI can Approve / Reject / Edit.
 *
 * Identity: `identity.ts` (`auth.supabase`).
 * Connectors: `connectors/mcp.ts`. Memory: `memory.ts`.
 * System prompt: `instructions.md`. UI: `src/` (Vite + Supabase login).
 */
export const agent = defineDeepAgent({
  name: "mda-example-tweet-composer-ts",
  model: "openai:gpt-5.5",
  interruptOn: {
    // Gate the X MCP write tool. Resume with HITL decisions from the UI.
    x__post_tweet: {
      allowedDecisions: ["approve", "edit", "reject"],
    },
  },
});
