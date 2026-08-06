# Managed Deep Agents examples (TypeScript)

A collection of [Managed Deep Agents](https://docs.langchain.com/langsmith/managed-deep-agents-overview)
projects that show how common MDA capabilities fit together in TypeScript.

Each subdirectory is a deployable agent project (`mda dev` / `mda deploy`).

## Examples

| Example                                         | What it shows                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`daily-update/`](./daily-update)               | Weekday cron digest of GitHub + Slack activity, custom tools (no connectors), Slack DM delivery, durable memory |
| [`marketing-assistant/`](./marketing-assistant) | Weekday HN (+ optional X) topic scan → tweet drafts on Slack; revise in chat, post manually                     |
| [`sandbox-assistant/`](./sandbox-assistant)     | Supabase login → browser chat; per-thread LangSmith sandbox assistant; UI on Cloudflare Workers                 |
| [`trusted-backend/`](./trusted-backend)         | Minimal agent behind a custom API: session cookie → proxy stamps `X-MDA-Ingress-Secret` + `X-MDA-User-Id`       |

## Requirements

- Node.js 24+
- A LangSmith account with Managed Deep Agents access
- The `mda` CLI (`npm install -g managed-deepagents@dev` or via each example’s
  local `node_modules`)

## Getting started

```bash
cd daily-update
npm install
cp env.example .env
# fill secrets, then:
npx mda dev .
```

See each example’s README for secrets, Slack/GitHub setup, and deploy steps.

## Deploy via GitHub Actions

Use **Actions → Deploy agent → Run workflow** and pick an agent. The workflow
runs `mda deploy` against LangSmith. When you pick `sandbox-assistant`, it also
builds and deploys the Vite UI to Cloudflare.

Configure these repository secrets first (Settings → Secrets and variables →
Actions). Use `MDA_GITHUB_TOKEN` for your personal GitHub PAT — Actions already
owns the name `GITHUB_TOKEN`.

| Secret                       | Required                                      |
| ---------------------------- | --------------------------------------------- |
| `LANGSMITH_API_KEY`          | yes                                           |
| `OPENAI_API_KEY`             | yes                                           |
| `MDA_INGRESS_SECRET`         | trusted-backend                               |
| `SLACK_BOT_TOKEN`            | for Slack channels                            |
| `SLACK_SIGNING_SECRET`       | for Slack channels                            |
| `SLACK_USER_TOKEN`           | for Slack search tools                        |
| `MDA_GITHUB_TOKEN`           | for GitHub tools (`daily-update`)             |
| `X_BEARER_TOKEN`             | optional X search (`marketing-assistant`)     |
| `MDA_GUEST_SIGNING_KEY`      | identity runtime (`sandbox-assistant`)         |
| `LANGSMITH_WORKSPACE_ID`     | if your key is org-scoped                     |
| `VITE_SUPABASE_URL`          | `sandbox-assistant` identity + UI             |
| `VITE_SUPABASE_ANON_KEY`     | `sandbox-assistant` UI                        |
| `VITE_LANGGRAPH_API_URL`     | `sandbox-assistant` UI (MDA deployment URL)   |
| `CLOUDFLARE_API_TOKEN`       | `sandbox-assistant` UI                        |
| `CLOUDFLARE_ACCOUNT_ID`      | `sandbox-assistant` UI                        |
