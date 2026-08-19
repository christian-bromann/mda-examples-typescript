/** LangGraph API base URL. In dev, defaults to the Vite same-origin proxy. */
export const LANGGRAPH_API_URL =
  import.meta.env.DATA_ANALYST_DEPLOYMENT_API ??
  (typeof window !== "undefined"
    ? `${window.location.origin}/api/langgraph`
    : "http://localhost:2024");

/** Must match `name` in `agent.ts`. */
export const LANGGRAPH_ASSISTANT_ID = "mda-example-data-analyst-ts";
