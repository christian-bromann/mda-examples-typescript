import { defineMemory } from "managed-deepagents";

/**
 * Deployment-shared durable memory at `/memories/agent/` (read/write).
 * Hot file `/memories/agent/AGENTS.md` is loaded every run. Without this
 * declaration, writes under `/memories/` do not persist to Context Hub.
 */
export const memory = defineMemory({ scope: "agent" });
