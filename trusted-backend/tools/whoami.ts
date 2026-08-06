import { tool } from "langchain";
import type { ManagedDeepAgentRuntime } from "managed-deepagents";
import { z } from "zod";

/**
 * Returns the caller identity MDA resolved from `X-MDA-User-Id` on this run.
 * Proof that trusted-backend ingress worked end-to-end.
 */
export const whoami = tool(
  async (_input, runtime: ManagedDeepAgentRuntime) => {
    const identity = runtime.identity;
    if (!identity) {
      return JSON.stringify(
        { error: "No authenticated caller on this run." },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        user: identity.user,
        groups: identity.groups ?? [],
        source: identity.source,
        claims: identity.claims ?? {},
      },
      null,
      2
    );
  },
  {
    name: "whoami",
    description:
      "Return the authenticated caller's identity (user id from the trusted backend). Use when the user asks who they are or to verify auth is working.",
    schema: z.object({}),
  }
);
