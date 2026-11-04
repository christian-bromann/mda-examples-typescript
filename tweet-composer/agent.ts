import { AIMessage, createMiddleware } from "langchain";
import { defineDeepAgent } from "managed-deepagents";

import { getAgentInputError, hasGitHubIssueOrPullRequest } from "./input-validation.js";

const inputValidationMiddleware = createMiddleware({
  name: "TweetComposerInputValidation",
  beforeAgent: {
    canJumpTo: ["end"],
    hook: (state) => {
      const error = getAgentInputError(
        state.messages,
        "Please provide a GitHub pull request or issue URL so I can research it and draft a launch tweet.",
        hasGitHubIssueOrPullRequest
      );
      if (!error) return;
      return { messages: [new AIMessage(error)], jumpTo: "end" as const };
    },
  },
});

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
  middleware: [inputValidationMiddleware],
  interruptOn: {
    // Gate the X MCP write tool. Resume with HITL decisions from the UI.
    x__post_tweet: {
      allowedDecisions: ["approve", "edit", "reject"],
    },
  },
});
