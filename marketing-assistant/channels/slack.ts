import { channels } from "managed-deepagents";

/**
 * Slack Events — revise drafts (“make #2 shorter”) for the user to post manually.
 *
 * Events URL after deploy:
 *   `https://<deployment>/channels/slack/events`
 *
 * Secrets: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`.
 * Subscribe to bot events: `message.im`, `app_mention`.
 */
export const channel = channels.slack({
  autoReply: true,
  mentionBehavior: "strip",
});
