import { tool } from "langchain";
import type { ManagedDeepAgentRuntime } from "managed-deepagents";
import { z } from "zod";

/**
 * Returns the member identity MDA resolved from `X-MDA-User-Id` on this run.
 * Lets the Account Concierge greet / scope answers to the signed-in account.
 */
export const whoami = tool(
  async (_input, runtime: ManagedDeepAgentRuntime) => {
    const identity = runtime.identity;
    if (!identity) {
      return JSON.stringify(
        { error: "No authenticated member on this run." },
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
      "Return the signed-in member's identity (user id stamped by the product API). Use when they ask who they are, which account is active, or to verify the session reached the concierge.",
    schema: z.object({}),
  }
);
