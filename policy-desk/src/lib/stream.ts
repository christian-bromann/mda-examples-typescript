/** LangGraph API base URL. In dev, defaults to the Vite same-origin proxy. */
export const LANGGRAPH_API_URL =
  import.meta.env.VITE_LANGGRAPH_API_URL ??
  (typeof window !== "undefined"
    ? `${window.location.origin}/api/langgraph`
    : "http://localhost:2024");

export const LANGGRAPH_ASSISTANT_ID =
  import.meta.env.VITE_LANGGRAPH_ASSISTANT_ID ?? "mda-example-policy-desk-ts";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * Absolute or same-origin URL for MDA HTTP routes (`/identity/*`, etc.).
 *
 * When `VITE_LANGGRAPH_API_URL` is set, identity calls go to the deployment.
 * Locally, leave it unset so Vite's `/identity` proxy is used.
 */
export function mdaHttpUrl(path: string): string {
  const explicit = import.meta.env.VITE_LANGGRAPH_API_URL?.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return explicit ? `${explicit}${normalized}` : normalized;
}
