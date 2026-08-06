import { defineIdentity } from "managed-deepagents";

/**
 * Personal digest bot reached by Slack Events and weekday cron.
 *
 * Default trusted-backend ingress is enough for channel + schedule traffic.
 * `scope: "agent"` mounts deployment-shared memory at `/memories/agent/` so cron
 * runs and Slack DMs see the same digests.
 *
 * Do not set Slack OAuth client id/secret unless you also want
 * Connect-with-Slack — without that path, DMs invoke the agent directly.
 */
export const identity = defineIdentity({
    auth: "backend",
});
