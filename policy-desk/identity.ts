import { auth, defineIdentity } from "managed-deepagents";

/**
 * Resolve the Supabase project subdomain for JWKS verification.
 *
 * Prefer `SUPABASE_PROJECT_REF`, otherwise parse
 * `SUPABASE_URL` / `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`).
 */
function supabaseProjectRef(): string {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;

  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
  if (url) {
    try {
      const host = new URL(url).hostname;
      const ref = host.split(".")[0]?.trim();
      if (ref) return ref;
    } catch {
      // fall through to the error below
    }
  }

  throw new Error(
    "Set SUPABASE_PROJECT_REF or SUPABASE_URL (or VITE_SUPABASE_URL) so " +
      "identity.ts can resolve auth.supabase({ projectRef })."
  );
}

/**
 * Browser-direct Supabase auth for the Policy Desk UI.
 *
 * MDA verifies JWTs via JWKS — the browser sends
 * `Authorization: Bearer <access_token>` on every agent call.
 *
 * Default identity scope gives each signed-in employee private threads (and
 * thus private per-thread sandboxes for their policy uploads).
 */
export const identity = defineIdentity({
  auth: auth.supabase({ projectRef: supabaseProjectRef() }),
});
