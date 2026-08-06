import { defineDeepAgent } from "managed-deepagents";

import { getGithubUser } from "./tools/get-github-user.js";
import { listGithubEvents } from "./tools/list-github-events.js";
import { searchGithubCommits } from "./tools/search-github-commits.js";
import { searchGithubIssues } from "./tools/search-github-issues.js";
import { searchGithubPullRequests } from "./tools/search-github-pull-requests.js";
import { getSlackThread } from "./tools/get-slack-thread.js";
import { searchSlackMessages } from "./tools/search-slack-messages.js";

/**
 * Daily update agent — GitHub + Slack activity digest via authored tools,
 * Slack DM delivery from `schedules/morning-digest.ts`, and durable notes under
 * `/memories/agent/daily/`. System prompt from `instructions.md`.
 *
 * Durable memory requires root `memory.ts` (`defineMemory({ scope: "agent" })`).
 * GitHub and Slack access use deployment secrets (`GITHUB_TOKEN`,
 * `SLACK_USER_TOKEN`) from `.env` — not connectors.
 */
export const agent = defineDeepAgent({
  name: "daily-update",
  model: "openai:gpt-5.5",
  tools: [
    getGithubUser,
    listGithubEvents,
    searchGithubPullRequests,
    searchGithubIssues,
    searchGithubCommits,
    searchSlackMessages,
    getSlackThread,
  ],
});
