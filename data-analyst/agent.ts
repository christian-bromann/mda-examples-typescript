import { defineDeepAgent } from "managed-deepagents";

import { stageChatUploadsMiddleware } from "./middleware/stage-chat-uploads.js";
import { streamAnalysisChartsMiddleware } from "./middleware/stream-analysis-charts.js";

/**
 * Data Analyst — sandbox showcase for baked analytics tooling.
 *
 * `sandbox/setup.sh` installs pandas / DuckDB / matplotlib once at deploy time.
 * The chat UI (`src/`) drops a CSV into the thread; middleware stages it under
 * `/workspace/uploads/`, and the agent answers with sandbox tools, writing
 * charts to `/workspace/out/`.
 *
 * Identity: `identity.ts` (trusted backend). System prompt: `instructions.md`.
 */
export const agent = defineDeepAgent({
  name: "mda-example-data-analyst-ts",
  model: "openai:gpt-5.5",
  middleware: [
    stageChatUploadsMiddleware(),
    streamAnalysisChartsMiddleware(),
  ],
});
