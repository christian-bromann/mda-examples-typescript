import { defineMemory } from "managed-deepagents";

/**
 * Deployment-shared procedural memory at `/memories/agent/`.
 * Per-conversation work lives in the thread sandbox, not here.
 */
export const memory = defineMemory({ scope: "agent" });
