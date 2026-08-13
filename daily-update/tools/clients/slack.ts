import { WebClient } from "@slack/web-api";

/**
 * User token (`xoxp-…`) for search/history. Separate from `SLACK_BOT_TOKEN`,
 * which only powers Events + DM delivery.
 *
 * Do not fall back to connector/MCP Slack tokens — those are almost always
 * bot tokens, and `search.messages` rejects them with `not_allowed_token_type`.
 */
export function slackUserToken(): string | undefined {
  const token = process.env.SLACK_USER_TOKEN;
  return token?.trim() || undefined;
}

export function slackClientFromEnv(): WebClient | { error: string } {
  const token = slackUserToken();
  if (!token) {
    return {
      error:
        "No Slack user token configured. Set SLACK_USER_TOKEN (xoxp-…) in the deployment environment. See docs/slack-user-token.md. Do not use SLACK_BOT_TOKEN here.",
    };
  }
  if (!token.startsWith("xoxp-")) {
    const kind = token.startsWith("xoxb-")
      ? "a bot token (xoxb-…)"
      : "a non-user token";
    return {
      error:
        `SLACK_USER_TOKEN is ${kind}. search.messages requires a user token (xoxp-…) with search:read. See docs/slack-user-token.md. Do not reuse SLACK_BOT_TOKEN.`,
    };
  }
  return new WebClient(token);
}

export function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Map thrown Slack Web API errors to a tool JSON payload. */
export function slackError(err: unknown): string {
  const code = slackErrorCode(err);
  if (code === "not_allowed_token_type") {
    return jsonResult({
      error:
        "Slack search.messages rejected the token type. It needs a user token (xoxp-…) with search:read, not SLACK_BOT_TOKEN (xoxb-…). Set SLACK_USER_TOKEN on the deployment from docs/slack-user-token.md and redeploy.",
    });
  }
  if (code) {
    return jsonResult({ error: code });
  }
  const message = err instanceof Error ? err.message : String(err);
  return jsonResult({ error: message });
}

function slackErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  if ("data" in err) {
    const data = (err as { data?: { error?: unknown } }).data;
    if (typeof data?.error === "string") {
      return data.error;
    }
  }
  if (err instanceof Error) {
    const match = /: ([a-z_]+)$/.exec(err.message);
    return match?.[1];
  }
  return undefined;
}
