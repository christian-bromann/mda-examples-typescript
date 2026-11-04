import { AIMessage, createMiddleware } from "langchain";
import { defineDeepAgent } from "managed-deepagents";

import { getAgentInputError } from "./input-validation.js";
import { stageChatUploadsMiddleware } from "./middleware/stage-chat-uploads.js";

const inputValidationMiddleware = createMiddleware({
  name: "PolicyDeskInputValidation",
  beforeAgent: {
    canJumpTo: ["end"],
    hook: (state) => {
      const error = getAgentInputError(
        state.messages,
        "Please ask a policy question or attach a handbook or policy file."
      );
      if (!error) return;
      return { messages: [new AIMessage(error)], jumpTo: "end" as const };
    },
  },
});

/**
 * Policy Desk — employee policy / handbook assistant.
 *
 * Signed-in staff upload handbooks and policy PDFs; the agent stages them into
 * a per-thread LangSmith sandbox, extracts text, and answers with cited guidance.
 *
 * Identity: `identity.ts` (`auth.supabase`).
 * Sandbox: `sandbox/index.ts`. Memory: `memory.ts`.
 * System prompt: `instructions.md`. UI: `src/` (Vite + Supabase login).
 */
export const agent = defineDeepAgent({
  name: "mda-example-policy-desk-ts",
  model: "openai:gpt-5.5",
  middleware: [inputValidationMiddleware, stageChatUploadsMiddleware()],
});
