import { sandboxes } from "managed-deepagents";

/**
 * Per-conversation LangSmith sandbox. MDA names, reuses, and tears down the
 * environment.
 */
export const sandbox = sandboxes.langsmith({
  scope: "thread",
  idleTtlSeconds: 600,
  defaultTimeout: 600,
});
