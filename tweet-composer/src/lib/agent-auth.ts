/**
 * Same-origin Agent Auth proxy path.
 *
 * Studio calls `/v1/agent-auth/...` with the signed-in LangSmith workspace
 * session. This example's browser only has a Supabase JWT, so Vite (local) and
 * the Cloudflare Worker (hosted) proxy Agent Auth and inject workspace
 * credentials server-side.
 */
export const AGENT_AUTH_PROXY_BASE = "/api/agent-auth";

export type CredentialAuthorizationSessionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "unknown";

export function isSessionStatus(
  value: string
): value is CredentialAuthorizationSessionStatus {
  return ["pending", "completed", "failed", "expired", "unknown"].includes(
    value
  );
}

export function oauthSessionStatusUrl(
  authId: string,
  waitSeconds: number
): string {
  const params = new URLSearchParams({
    wait_seconds: String(waitSeconds),
  });
  return `${AGENT_AUTH_PROXY_BASE}/oauth-authorization-sessions/${encodeURIComponent(authId)}?${params}`;
}
