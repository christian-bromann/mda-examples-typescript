import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const LANGGRAPH_UPSTREAM =
  process.env.LANGGRAPH_PROXY_TARGET ?? "http://localhost:2024";

/**
 * Dev stand-in for a product backend: the browser never holds
 * `MDA_INGRESS_SECRET`, the proxy stamps it (plus a stable local user id) on
 * every agent call, exactly like `account-concierge/proxy/server.mjs`.
 */
function ingressHeaders(secret: string): Record<string, string> | undefined {
  if (!secret) {
    console.warn(
      "[data-analyst] MDA_INGRESS_SECRET is not set — agent calls will be rejected."
    );
    return undefined;
  }
  return {
    "x-mda-ingress-secret": secret,
    "x-mda-user-id": "local-analyst",
  };
}

function createLangGraphViteProxy(
  headers: Record<string, string> | undefined
): Record<string, ProxyOptions> {
  const upstream: ProxyOptions = {
    target: LANGGRAPH_UPSTREAM,
    changeOrigin: true,
    headers,
  };

  return {
    "/api/langgraph": {
      ...upstream,
      rewrite: (p) => p.replace(/^\/api\/langgraph/, ""),
    },
    "/threads": upstream,
    "/runs": upstream,
    "/assistants": upstream,
    "/info": upstream,
    "/ok": upstream,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");

  return {
    base: process.env.DEPLOY_BASE || "/",
    // Serve the committed sample dataset at `/online_retail_sample.csv`.
    publicDir: "fixtures",
    // Expose DATA_ANALYST_DEPLOYMENT_API to the client (Vite defaults to VITE_* only).
    envPrefix: ["VITE_", "DATA_ANALYST_"],
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        src: path.resolve(import.meta.dirname, "./src"),
      },
    },
    clearScreen: false,
    server: {
      port: 4910,
      proxy: createLangGraphViteProxy(
        ingressHeaders(env.MDA_INGRESS_SECRET?.trim() ?? "")
      ),
    },
  };
});
