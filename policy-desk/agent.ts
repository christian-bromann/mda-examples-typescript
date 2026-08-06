import { defineDeepAgent } from "managed-deepagents";

import { stageChatUploadsMiddleware } from "./middleware/stage-chat-uploads.js";

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
  name: "policy-desk",
  model: "openai:gpt-5.5",
  middleware: [stageChatUploadsMiddleware()],
});
