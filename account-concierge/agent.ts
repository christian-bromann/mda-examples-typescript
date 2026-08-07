import { defineDeepAgent } from "managed-deepagents";

import { whoami } from "./tools/whoami.js";

/**
 * Account Concierge — member-facing agent behind trusted-backend identity.
 *
 * Lives behind your product API: the BFF authenticates the session, stamps
 * `X-MDA-Ingress-Secret` + `X-MDA-User-Id` (see `proxy/server.mjs`), and the
 * concierge greets the member by account. `whoami` echoes the resolved identity.
 */
export const agent = defineDeepAgent({
  name: "mda-example-account-concierge-ts",
  model: "openai:gpt-5.5",
  tools: [whoami],
});
