import { connectors, connections } from "managed-deepagents";

/**
 * User-scoped MCP connectors for Tweet Composer.
 *
 * - `github` — read-only remote GitHub MCP (PRs, issues, repo context)
 * - `x` — official X MCP (search + post; post is HITL-gated in agent.ts)
 *
 * Create matching workspace connections (`mda connections create`) after the
 * first deploy. User OAuth grants resolve per signed-in caller.
 */
export const connector = connectors.mcp({
  mcpServers: {
    github: {
      transport: "http",
      url: "https://api.githubcopilot.com/mcp/readonly",
      connection: connections.get("chris-github", { type: "user" }),
    },
    x: {
      transport: "http",
      url: "https://api.x.com/mcp",
      connection: connections.get("chris-x", { type: "user" }),
    },
  },
});
// 0t7GGj-ex7OLKJBJLynoxh0qzhBCbZOZPc7i3DUwfmrLP_MrXi