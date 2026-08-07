import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const LANGGRAPH_UPSTREAM =
  process.env.LANGGRAPH_PROXY_TARGET ?? "http://localhost:2024";

const UPSTREAM_PROXY: ProxyOptions = {
  target: LANGGRAPH_UPSTREAM,
  changeOrigin: true,
};

/**
 * Same-origin proxy so the browser can send `Authorization` to the LangGraph dev
 * server without cross-origin fetch stripping or blocking custom headers.
 */
function createLangGraphViteProxy(): Record<string, ProxyOptions> {
  return {
    "/api/langgraph": {
      ...UPSTREAM_PROXY,
      rewrite: (p) => p.replace(/^\/api\/langgraph/, ""),
    },
    "/threads": UPSTREAM_PROXY,
    "/runs": UPSTREAM_PROXY,
    "/assistants": UPSTREAM_PROXY,
    "/info": UPSTREAM_PROXY,
    "/ok": UPSTREAM_PROXY,
    "/identity": UPSTREAM_PROXY,
  };
}

export default defineConfig(() => {
  return {
    base: process.env.DEPLOY_BASE || "/",
    // Expose POLICY_DESK_DEPLOYMENT_API to the client (Vite defaults to VITE_* only).
    envPrefix: ["VITE_", "POLICY_DESK_"],
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        src: path.resolve(import.meta.dirname, "./src"),
      },
    },
    clearScreen: false,
    server: {
      port: 4900,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // blob: required so PromptInput can fetch object URLs when converting attachments to data URLs
          "connect-src 'self' blob: ws: wss: http://127.0.0.1:* http://localhost:* https://*.supabase.co https://*.langgraph.app wss://*.langgraph.app https://*.langsmith.app https://*.smith.langchain.com",
          "img-src 'self' data: blob:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "object-src 'none'",
          "base-uri 'self'",
        ].join("; "),
      },
      proxy: createLangGraphViteProxy(),
    },
  };
});
