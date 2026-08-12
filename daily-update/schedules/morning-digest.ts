import { defineSchedule } from "managed-deepagents";
import prompt from "./morning-digest.md" with { type: "text" };

const SLACK_USER_ID = "U097E05JJAF";

/**
 * Your Slack user ID (starts with `U`). Must stay a string literal / top-level
 * const so `mda` can statically extract it into the cron delivery target.
 *
 * Find it: Slack → profile → ⋯ → Copy member ID. DM the bot once after install
 * so Slack opens the IM channel.
 */
export const schedule = defineSchedule({
  // 7:00am Pacific, Monday–Friday (no Saturday / Sunday runs)
  cron: "0 7 * * 1-5",
  timezone: "America/Los_Angeles",
  prompt,
  deliverTo: {
    channel: "slack",
    to: {
      type: "provider_conversation",
      conversationId: SLACK_USER_ID,
    },
    autoPost: true,
  },
});
