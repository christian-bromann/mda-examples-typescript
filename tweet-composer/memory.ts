import { defineMemory } from "managed-deepagents";

/**
 * Deployment-shared procedural memory at `/memories/agent/`.
 * Brand voice and launch messaging prefs live here — not per-user drafts.
 */
export const memory = defineMemory({ scope: "agent" });
