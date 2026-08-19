import { defineDeepAgent } from "managed-deepagents";

import { injectGithubAuthMiddleware } from "./middleware/inject-github-auth.js";
import { streamAnalysisChartsMiddleware } from "./middleware/stream-analysis-charts.js";

/**
 * Repo Pulse — maintainer analytics over a GitHub repository.
 *
 * The baked sandbox ships `gh`, jq, and pandas/matplotlib. The agent fetches
 * metrics with the GitHub CLI (`execute`), charts under `/workspace/out/`, and
 * the chat UI streams those PNGs inline. Middleware stages `GITHUB_TOKEN`
 * into the box for `gh` without exposing it to the model.
 *
 * Identity: `identity.ts` (trusted backend). System prompt: `instructions.md`.
 */
export const agent = defineDeepAgent({
  name: "mda-example-repo-pulse-ts",
  model: "openai:gpt-5.5",
  middleware: [
    injectGithubAuthMiddleware(),
    streamAnalysisChartsMiddleware(),
  ],
});
