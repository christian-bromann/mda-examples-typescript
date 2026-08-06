# Managed Deep Agents examples (TypeScript)

A collection of [Managed Deep Agents](https://docs.langchain.com/langsmith/managed-deep-agents-overview)
projects that show how common MDA capabilities fit together in TypeScript.

Each subdirectory is a deployable agent project (`mda dev` / `mda deploy`).

## Examples

| Example | What it shows |
| --- | --- |
| [`daily-update/`](./daily-update) | Weekday cron digest of GitHub + Slack activity, custom tools (no connectors), Slack DM delivery, durable memory |

## Requirements

- Node.js 22+
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

Use **Actions → Deploy agent → Run workflow** and pick an agent (currently
`daily-update`). The workflow runs `mda deploy` against LangSmith.

Configure these repository secrets first (Settings → Secrets and variables →
Actions). Use `MDA_GITHUB_TOKEN` for your personal GitHub PAT — Actions already
owns the name `GITHUB_TOKEN`.

| Secret | Required |
| --- | --- |
| `LANGSMITH_API_KEY` | yes |
| `OPENAI_API_KEY` | yes |
| `MDA_INGRESS_SECRET` | for Slack channels |
| `SLACK_BOT_TOKEN` | for Slack channels |
| `SLACK_SIGNING_SECRET` | for Slack channels |
| `SLACK_USER_TOKEN` | for Slack search tools |
| `MDA_GITHUB_TOKEN` | for GitHub tools |
| `LANGSMITH_WORKSPACE_ID` | if your key is org-scoped |
