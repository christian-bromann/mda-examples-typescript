import { AIMessage, createMiddleware } from "langchain";
import { defineDeepAgent } from "managed-deepagents";

import { getAgentInputError } from "./input-validation.js";
import { getGithubUser } from "./tools/get-github-user.js";
import { listGithubEvents } from "./tools/list-github-events.js";
import { searchGithubCommits } from "./tools/search-github-commits.js";
import { searchGithubIssues } from "./tools/search-github-issues.js";
import { searchGithubPullRequests } from "./tools/search-github-pull-requests.js";
import { getLinearUser } from "./tools/get-linear-user.js";
import { searchLinearComments } from "./tools/search-linear-comments.js";
import { searchLinearIssues } from "./tools/search-linear-issues.js";
import { getSlackThread } from "./tools/get-slack-thread.js";
import { searchSlackMessages } from "./tools/search-slack-messages.js";

const inputValidationMiddleware = createMiddleware({
  name: "DailyUpdateInputValidation",
  beforeAgent: {
    canJumpTo: ["end"],
    hook: (state) => {
      const error = getAgentInputError(
        state.messages,
        "Please describe the update or question you need help with."
      );
      if (!error) return;
      return { messages: [new AIMessage(error)], jumpTo: "end" as const };
    },
  },
});

/**
 * Daily update agent — GitHub + Linear + Slack activity digest via authored
 * tools, Slack DM delivery from `schedules/morning-digest.ts`, and durable
 * notes under `/memories/agent/daily/`. System prompt from `instructions.md`.
 *
 * Durable memory requires root `memory.ts` (`defineMemory({ scope: "agent" })`).
 * GitHub, Linear, and Slack access use deployment secrets (`GITHUB_TOKEN`,
 * `LINEAR_API_KEY`, `SLACK_USER_TOKEN`) from `.env` — not connectors.
 */
export const agent = defineDeepAgent({
  name: "mda-example-daily-update-ts",
  model: "openai:gpt-5.5",
  middleware: [inputValidationMiddleware],
  tools: [
    getGithubUser,
    listGithubEvents,
    searchGithubPullRequests,
    searchGithubIssues,
    searchGithubCommits,
    getLinearUser,
    searchLinearIssues,
    searchLinearComments,
    searchSlackMessages,
    getSlackThread,
  ],
});
