# marketing-assistant

Weekdays at **9:00am America/Los_Angeles**, this Managed Deep Agent:

1. Reads your focus notes from `/memories/agent/focus.md` (edit anytime in Context Hub)
2. Scans public discussion for topics:
   - **Hacker News** — always on (no secrets)
   - **X** — optional (`X_BEARER_TOKEN`)
3. Drafts **3** tweet options grounded in sources
4. Saves `/memories/agent/drafts/YYYY-MM-DD.md`
5. DMs you on Slack (`deliverTo.autoPost`)

You revise in Slack if needed, then **copy-paste to X yourself**. The agent
never publishes. LinkedIn is out of scope.

## Layout

```text
marketing-assistant/
  agent.ts
  identity.ts
  memory.ts                   # defineMemory({ scope: "agent" }) — required for Context Hub
  instructions.md
  tools/                      # HN + optional X
  channels/slack.ts
  schedules/morning-drafts.ts # 0 9 * * 1-5 PT → Slack DM
  docs/x-api-setup.md
  env.example
```

## What this demonstrates

- **Custom tools** — mix free + optional paid/auth APIs (no connectors)
- **Schedules** — weekday cron + Slack DM delivery
- **Channels** — interactive revise / copy-ready drafts
- **Memory** — `memory.ts` mounts `/memories/agent/`; `focus.md` + daily draft diary

## Configure

1. Copy `env.example` → `.env` and fill secrets.
2. Edit `schedules/morning-drafts.ts`: set your Slack member ID (string literal).
3. Slack bot: same Events + DM setup as [`daily-update`](../daily-update).
4. Optional X bearer: **[docs/x-api-setup.md](./docs/x-api-setup.md)**

You can run with **only Slack + model keys**; morning drafts then rely on
Hacker News alone.

## Run / deploy

```bash
cd marketing-assistant
npm install
cp env.example .env
# fill secrets + set SLACK_USER_ID in schedules/morning-drafts.ts

npx mda deploy .
```

After deploy, point Slack Event Subscriptions at
`https://<deployment>/channels/slack/events` and open a DM with the bot once.

## Set research topics (after deploy)

Topics are **not** in `.env`. They live in durable agent memory:

**`/memories/agent/focus.md`**

### 1. Preferred — edit in Context Hub

1. Deploy the agent (`mda deploy` or the **Deploy agent** GitHub Action).
2. Open the deployment in LangSmith → **Context Hub** (agent memory).
3. Create or edit `memories/agent/focus.md` (path may show as
   `/memories/agent/focus.md` to the agent).

Use a structure like:

```markdown
# Marketing focus

## Niches
- managed deep agents, LangChain, AI developer tooling

## Avoid
- politics, interpersonal drama, pile-ons

## Voice
- concise, technical, slightly opinionated
- no hype adjectives; no emoji spam

## Watch accounts (X)
- LangChainAI
```

| Section | Used for |
| --- | --- |
| **Niches** | Search queries on HN / X |
| **Avoid** | Topics to skip |
| **Voice** | How drafts should sound |
| **Watch accounts (X)** | Optional `get_x_user_timeline` pulls (needs `X_BEARER_TOKEN`) |

Changes apply on the next cron run or Slack turn — no redeploy needed.

### 2. Alternative — ask the bot in Slack

DM the bot, for example:

- `Create focus.md with niches: open-source DX, LangGraph, evals`
- `Update focus.md to emphasize agents this month and avoid fundraising news`

The agent writes or edits `focus.md` with `write_file` / `edit_file`.

### First run with no file

If `focus.md` is missing, the morning job creates a starter from
`instructions.md`. Edit it in Context Hub (or via Slack) so drafts match your
real focus.

## Manual test prompts

- `Run the daily marketing draft…` (same idea as the schedule prompt)
- `Make draft #2 sharper and under 200 characters`
- `Update focus.md to emphasize open-source DX this month`
