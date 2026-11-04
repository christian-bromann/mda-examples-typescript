import { AIMessage, createMiddleware } from "langchain";
import { defineDeepAgent } from "managed-deepagents";

import { getAgentInputError } from "./input-validation.js";
import { whoami } from "./tools/whoami.js";

const inputValidationMiddleware = createMiddleware({
  name: "AccountConciergeInputValidation",
  beforeAgent: {
    canJumpTo: ["end"],
    hook: (state) => {
      const error = getAgentInputError(
        state.messages,
        "Please enter a question about your account so I can help."
      );
      if (!error) return;
      return { messages: [new AIMessage(error)], jumpTo: "end" as const };
    },
  },
});

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
  middleware: [inputValidationMiddleware],
  tools: [whoami],
});
