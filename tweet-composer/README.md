# Tweet Composer

A **Tweet Composer** for Managed Deep Agents launches: sign in, paste a GitHub
PR, let the agent research the change + scan X, then **Approve / Reject / Edit**
one draft before it posts.

1. Sign in (Supabase email/password in this demo)
2. Paste a GitHub pull request URL
3. The agent uses **user-scoped MCP connections** (`github`, `x`) to fetch the
   PR and current conversation on X
4. It proposes one tweet; posting calls `x__post_tweet`, which pauses for HITL
5. Approve, edit the text, or reject in the interrupt card

Technically this shows Supabase JWT identity (`auth.supabase`), MDA
`connections.get(..., { type: "user" })` MCP connectors, and
`interruptOn` + a custom Vite approval UI.

## Layout

```text
tweet-composer/
  agent.ts                 # defineDeepAgent + interruptOn x__post_tweet
  identity.ts              # auth.supabase({ projectRef })
  memory.ts                # defineMemory({ scope: "agent" })
  connectors/mcp.ts        # GitHub (readonly) + X user MCP
  instructions.md
  src/                     # Vite + React chat (Supabase login + HITL card)
  wrangler.jsonc           # Cloudflare Workers static assets for the UI
  env.example
```

## What this demonstrates

- **Use case** — PR → research → one launch tweet → human approval → post
- **Supabase login** — JWKS `validated_token` identity (browser Bearer token)
- **User MCP connections** — `github` + `x` via `connections.get(..., { type: "user" })`
- **Connect interrupt** — Studio-style OAuth poll + auto-resume (no Continue)
- **HITL** — `interruptOn: { x__post_tweet: … }` with Approve / Reject / Edit UI
- **Browser chat** — `@langchain/react` `useStream` + Vite proxy locally
- **Private threads** — default identity scope isolates conversations per user

## Configure

1. Create a Supabase project. Enable **Email** auth.
2. Copy env and fill secrets. `identity.ts` parses the project ref from
   `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`).

```bash
cd tweet-composer
cp env.example .env
```

| Variable | Where | Notes |
| --- | --- | --- |
| `LANGSMITH_API_KEY` | agent + UI proxy | Deploy + Agent Auth session-status proxy |
| `LANGSMITH_WORKSPACE_ID` | agent + UI proxy | Required for Agent Auth `X-Tenant-Id` |
| `OPENAI_API_KEY` | agent | Model |
| `MDA_GUEST_SIGNING_KEY` | agent | Random string (identity runtime) |
| `VITE_SUPABASE_URL` | UI + agent | Publishable URL; agent parses project ref from host |
| `VITE_SUPABASE_ANON_KEY` | UI (build-time) | Publishable / anon key |
| `TWEET_COMPOSER_DEPLOYMENT_API` | UI (build-time) + Actions secret | LangSmith MDA API URL — required for Cloudflare / remote UI; leave unset for local Vite proxy |
| `CLOUDFLARE_API_TOKEN` | wrangler | Workers deploy (`npm run deploy`) |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler | Cloudflare account ID |

The UI must know where the hosted agent lives. That **API URL only exists after
the first agent deploy** — see [Deploy](#deploy).

### Connections

User-scoped MCP connections resolve through Agent Auth (deploy or `mda dev`).
Create the workspace connection rows once (auto-created on deploy / verified on
`mda dev` when `LANGSMITH_API_KEY` + `LANGSMITH_WORKSPACE_ID` are set):

```bash
npx mda connections create x --type user
npx mda connections create chris-github --type user
npx mda connections check
```

Slugs must match `connectors/mcp.ts`. On the first run the UI shows a Connect
card for missing OAuth grants. Each row long-polls Agent Auth session status
(via the same-origin `/api/agent-auth` proxy), shows a spinner while OAuth is
in flight, then a checkmark when complete. There is **no Continue button** —
once every connection succeeds the card auto-resumes the run.

For local Vite, set `LANGSMITH_API_KEY` + `LANGSMITH_WORKSPACE_ID` in `.env` so
the proxy can call Agent Auth. Hosted UI uses the same values as Cloudflare
Worker secrets.


## Run locally

```bash
npm install
npm run dev
```

If `mda dev` fails with `npm … ETIMEDOUT` while installing into `.mda/build`, prefer
IPv4 for Node (Cloudflare/`registry.npmjs.org` IPv6 stalls are common on macOS):

```bash
export NODE_OPTIONS='--dns-result-order=ipv4first'
npm run dev
```

This repo’s `.npmrc` already lowers parallel sockets and raises fetch retries.
After a cold cache wipe, one successful install in `.mda/build` warms the cache
for later runs.

Starts the agent (`:2024`) and UI (`:4901`) together. Open
[http://localhost:4901](http://localhost:4901), sign in, then try pasting a PR
URL. With workspace Agent Auth env configured, local `mda dev` can exercise
user-MCP OAuth via the Connect interrupt card.

Leave `TWEET_COMPOSER_DEPLOYMENT_API` unset locally (Vite proxies to `:2024`).

## Deploy

Tweet Composer ships in two parts: the **agent** (LangSmith) and the **UI**
(Cloudflare). The UI build bakes in the agent’s API URL, and that URL only
exists after the agent has been deployed once — so the first ship is two
passes.

### 1. Deploy the agent

```bash
npm run deploy:agent
```

In LangSmith, open the deployment and copy its **API URL** (also labeled
**Resource URL** — not the deployment dashboard link). It looks like:

```text
https://your-deployment.us.langsmith.app
```

### 2. Set `TWEET_COMPOSER_DEPLOYMENT_API`

Put that URL in `.env` for local UI deploys, and as the GitHub Actions repo
secret of the same name for CI.

### 3. Provision connections + deploy the UI

```bash
npx mda connections create x --type user
npx mda connections create github --type user
npm run deploy:ui
# or, once the URL is set, both steps together:
npm run deploy
```

Or use **Actions → Deploy agent → Run workflow** and pick `tweet-composer`.
That deploys the agent to LangSmith and the UI to Cloudflare. After the first
agent deploy, set `TWEET_COMPOSER_DEPLOYMENT_API` (plus `CLOUDFLARE_*` and the
`VITE_SUPABASE_*` secrets) so the UI build can reach the hosted agent.
On the very first Actions run, the UI step fails until that secret is set —
re-run the workflow after copying the API URL from LangSmith.

## Security notes

- MDA verifies the Supabase JWT; tools never re-parse the bearer token.
- GitHub MCP is read-only; X posts require an explicit HITL decision.
- Shared `/memories/agent/` is for procedural voice prefs only — not secrets.
