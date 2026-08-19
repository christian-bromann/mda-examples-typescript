import { defineSandbox } from "managed-deepagents";

/**
 * Per-thread LangSmith sandbox. MDA bakes `setup.sh` once at deploy/dev into a
 * recipe snapshot; new threads clone that image (tools + seed CSV already there).
 */
export const sandbox = defineSandbox({
  idleTtlSeconds: 600,
  defaultTimeout: 600,
});
