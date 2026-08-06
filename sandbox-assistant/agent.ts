import { defineDeepAgent } from "managed-deepagents";

import { stageChatUploadsMiddleware } from "./middleware/stage-chat-uploads.js";

/**
 * Sandbox assistant — Supabase-authenticated browser agent with a per-thread
 * LangSmith sandbox for files + shell (`execute`).
 *
 * Identity: `identity.ts` (`auth.supabase`).
 * Sandbox: `sandbox/index.ts`. Memory: `memory.ts`.
 * System prompt: `instructions.md`. UI: `src/` (Vite + Supabase login).
 * Chat file uploads are staged by middleware; PDFs are extracted with pypdf.
 */
export const agent = defineDeepAgent({
  name: "sandbox-assistant",
  model: "openai:gpt-5.5",
  middleware: [stageChatUploadsMiddleware()],
});
