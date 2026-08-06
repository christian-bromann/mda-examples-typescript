# daily-update

Weekdays at **7:00am America/Los_Angeles**, this Managed Deep Agent:

1. Reviews recent digests in memory for continuity
2. Reads Slack discussion via authored tools (`SLACK_USER_TOKEN`) for framing
3. Pulls your GitHub activity for the window via authored tools (`GITHUB_TOKEN`) —
   previous 24 hours, except **Monday, which looks back 72 hours** so Friday,
   Saturday and Sunday arrive as one consolidated weekend catch-up
4. Groups by evolving workstreams and writes `/memories/agent/daily/YYYY-MM-DD.md`
5. DMs you a standup-ready summary on Slack (`deliverTo.autoPost`)

Saturday and Sunday are **not** scheduled. You can still DM the bot later
(“what did I ship last week?”) and it will read those daily markdown files.

This example shows how to reach GitHub and Slack **without connectors**: tokens
live in `.env`, and the agent calls them through custom LangChain tools under
`tools/`.

## Layout

```text
daily-update/
  agent.ts                      # defineDeepAgent + tool wiring
  identity.ts                   # trusted-backend ingress
  memory.ts                     # defineMemory({ scope: "agent" }) — required for Context Hub
  instructions.md
  tools/                        # GitHub + Slack Web API tools
  channels/slack.ts             # DMs / mentions (bot token)
  schedules/morning-digest.ts   # 0 7 * * 1-5 PT → Slack DM
  docs/slack-user-token.md      # how to mint SLACK_USER_TOKEN
  env.example
```

## What this demonstrates

- **Custom tools** — Octokit + Slack Web API with deployment secrets
- **Schedules** — weekday cron with Slack DM delivery
- **Channels** — Slack Events for interactive follow-ups
- **Memory** — durable digests under `/memories/agent/daily/`

## Configure

1. Copy `env.example` → `.env` and fill secrets.
2. Edit `schedules/morning-digest.ts`: set your Slack member ID (must remain a
   string literal).
3. Slack **bot** app (Events + DM delivery):
   - Bot scopes: `chat:write`, `im:write`, `im:history`, `app_mentions:read`,
     `users:read`
   - Event subscriptions → Bot events: `message.im`, `app_mention`
   - After first deploy, Request URL =
     `https://<deployment>/channels/slack/events`
   - Open a DM with the bot once so Slack has an IM channel.
4. Slack **user token** (digest framing): follow
   **[docs/slack-user-token.md](./docs/slack-user-token.md)** and set
   `SLACK_USER_TOKEN`.
5. GitHub PAT: classic with `repo` (+ org SSO) so private and public activity
   both show up.

Do **not** set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` unless you intentionally
want Connect-with-Slack. Without that OAuth path, DMs invoke the agent directly.

## Run

```bash
cd daily-update
npm install
cp env.example .env
# fill secrets + set SLACK_USER_ID in schedules/morning-digest.ts

npx mda dev .
npx mda deploy . --name daily-update
```

## Manual test prompts

- `Run the daily GitHub contribution digest…` (same text as the schedule prompt)
- `Run the daily digest as if today were Monday` (exercises the 72h weekend window)
- `What did I work on this week?`
- `Show me 2026-08-05 from memory`
