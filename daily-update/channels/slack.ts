import { channels } from "managed-deepagents";

/**
 * Slack Events — answer follow-ups in DMs (e.g. "what did I do last week?").
 *
 * Events URL after deploy:
 *   `https://<deployment>/channels/slack/events`
 *
 * Secrets: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` (Events path is Slack-signed
 * only). `MDA_INGRESS_SECRET` is for trusted-backend loopback into the graph,
 * not Slack webhook auth.
 * Digest framing uses authored Slack tools + `SLACK_USER_TOKEN` (user token),
 * not this bot token.
 *
 * Also subscribe to the matching bot events on your Slack app:
 * `message.im`, `app_mention`.
 */
export const channel = channels.slack({
  autoReply: true,
  mentionBehavior: "strip",
});
