import { defineIdentity } from "managed-deepagents";

/**
 * Trusted-backend ingress for Studio / `mda dev` and API clients.
 *
 * No browser JWT in this example — contrast with `policy-desk/` (Supabase).
 */
export const identity = defineIdentity({
  auth: "backend",
});
