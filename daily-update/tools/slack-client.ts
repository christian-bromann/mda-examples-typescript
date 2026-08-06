import { WebClient } from "@slack/web-api";

/**
 * User token (`xoxp-…`) for search/history. Separate from `SLACK_BOT_TOKEN`,
 * which only powers Events + DM delivery.
 */
export function slackUserToken(): string | undefined {
  const token = process.env.SLACK_USER_TOKEN ?? process.env.SLACK_MCP_TOKEN;
  return token?.trim() || undefined;
}

export function slackClientFromEnv(): WebClient | { error: string } {
  const token = slackUserToken();
  if (!token) {
    return {
      error:
        "No Slack user token configured. Set SLACK_USER_TOKEN in the deployment environment.",
    };
  }
  return new WebClient(token);
}

export function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
