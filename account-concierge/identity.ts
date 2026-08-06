import { defineIdentity } from "managed-deepagents";

/**
 * Trusted-backend identity for the Account Concierge (the MDA default).
 *
 * Your product API authenticates the member (session cookie, OAuth, SSO, …),
 * then proxies LangGraph requests with:
 *   - `X-MDA-Ingress-Secret` — shared secret from `MDA_INGRESS_SECRET`
 *   - `X-MDA-User-Id` — the authenticated member id your backend resolved
 *
 * The client never sees the ingress secret. See `proxy/server.mjs` for a
 * stand-in product API.
 */
export const identity = defineIdentity();
