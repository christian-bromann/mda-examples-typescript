import { connectors, connections } from "managed-deepagents";

/**
 * User-scoped MCP connectors for Tweet Composer.
 *
 * - `github` — read-only remote GitHub MCP (PRs, issues, repo context)
 * - `x` — official X MCP (search + post; post is HITL-gated in agent.ts)
 *
 * Slugs (`github`, `x`) must match workspace connections created with
 * `mda connections create` — see README “Connections”.
 */
export const connector = connectors.mcp({
  mcpServers: {
    github: {
      transport: "http",
      url: "https://api.githubcopilot.com/mcp/readonly",
      connection: connections.get("github", { type: "user" }),
    },
    x: {
      transport: "http",
      url: "https://api.x.com/mcp",
      connection: connections.get("x", { type: "user" }),
    },
  },
});
