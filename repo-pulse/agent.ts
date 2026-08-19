import { defineDeepAgent } from "managed-deepagents";

import { stageGithubDataMiddleware } from "./middleware/stage-github-data.js";
import { streamAnalysisChartsMiddleware } from "./middleware/stream-analysis-charts.js";
import { repoPulseTools } from "./tools/index.js";

/**
 * Repo Pulse — maintainer analytics over a GitHub repository.
 *
 * GitHub tools collect PR / contributor / issue metrics; the baked sandbox
 * (pandas + matplotlib) turns them into charts under `/workspace/out/`. The
 * chat UI reuses the data-analyst shell so PNGs render inline.
 *
 * Identity: `identity.ts` (trusted backend). System prompt: `instructions.md`.
 */
export const agent = defineDeepAgent({
  name: "mda-example-repo-pulse-ts",
  model: "openai:gpt-5.5",
  tools: repoPulseTools,
  middleware: [
    stageGithubDataMiddleware(),
    streamAnalysisChartsMiddleware(),
  ],
});
