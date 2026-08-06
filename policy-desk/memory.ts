import { defineMemory } from "managed-deepagents";

/**
 * Deployment-shared procedural memory at `/memories/agent/`.
 * Per-employee policy Q&A lives in the thread sandbox, not here.
 */
export const memory = defineMemory({ scope: "agent" });
