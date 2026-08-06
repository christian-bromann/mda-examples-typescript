import { defineDeepAgent } from "managed-deepagents";

import { whoami } from "./tools/whoami.js";

/**
 * Minimal agent behind trusted-backend identity.
 *
 * Callers must reach the deployment through a backend that stamps
 * `X-MDA-Ingress-Secret` + `X-MDA-User-Id` (see `proxy/server.mjs`).
 * The only tool, `whoami`, echoes the resolved identity.
 */
export const agent = defineDeepAgent({
  name: "trusted-backend",
  model: "openai:gpt-5.5",
  tools: [whoami],
});
