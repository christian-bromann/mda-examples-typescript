/**
 * Cloudflare Worker: SPA assets + Agent Auth session-status proxy.
 *
 * Browser clients never see LANGSMITH_API_KEY. They call `/api/agent-auth/...`,
 * and this worker forwards to LangSmith Agent Auth with workspace credentials.
 */
export interface Env {
  ASSETS: Fetcher;
  LANGSMITH_API_KEY: string;
  LANGSMITH_WORKSPACE_ID: string;
  /** Optional override; defaults to https://api.smith.langchain.com */
  LANGSMITH_ENDPOINT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/agent-auth/")) {
      return proxyAgentAuth(request, url, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function proxyAgentAuth(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const apiKey = env.LANGSMITH_API_KEY?.trim();
  const workspaceId = env.LANGSMITH_WORKSPACE_ID?.trim();
  if (!apiKey || !workspaceId) {
    return Response.json(
      {
        error:
          "Worker missing LANGSMITH_API_KEY or LANGSMITH_WORKSPACE_ID secrets",
      },
      { status: 503 }
    );
  }

  const upstreamBase = (
    env.LANGSMITH_ENDPOINT?.trim() || "https://api.smith.langchain.com"
  ).replace(/\/$/, "");
  const upstreamPath =
    url.pathname.replace(/^\/api\/agent-auth/, "/v1/agent-auth") + url.search;

  const headers = new Headers({
    accept: "application/json",
    "x-api-key": apiKey,
    "x-tenant-id": workspaceId,
    "x-langsmith-product": "mda",
  });

  const upstream = await fetch(`${upstreamBase}${upstreamPath}`, {
    method: request.method,
    headers,
    signal: request.signal,
    redirect: "error",
  });

  // Strip hop-by-hop headers; forward status + body as-is.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("transfer-encoding");
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
