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

### Connections (OAuth apps + workspace slots)

Slugs in `connectors/mcp.ts` are `x` and `github`. Each needs:

1. A **BYOT OAuth app** at the provider (client id + secret)
2. A matching **workspace connection** registered with `mda connections create`
3. A **per-user Connect** grant the first time that signed-in caller runs the agent

`LANGSMITH_API_KEY` + `LANGSMITH_WORKSPACE_ID` must be set (deploy / `mda
dev` / local Vite Agent Auth proxy).

#### 1. Create the OAuth apps

Both apps must use LangSmith Agent Auth as the callback:

```text
https://api.smith.langchain.com/v1/agent-auth/oauth/callback
```

**GitHub** — [OAuth Apps](https://github.com/settings/developers)

1. **New OAuth App**
2. Homepage URL: any URL you control (e.g. your UI origin)
3. **Authorization callback URL**: the Agent Auth URI above
4. Create the app and generate a **client secret**
5. Copy **Client ID** + **Client secret**

GitHub OAuth Apps do not declare scopes in the app settings. Scopes are
requested when the connection is created / when the user authorizes. The MDA
catalog default for `github` is only `read:user`, which is **not** enough for
`pull_request_read` on GitHub’s MCP — you must register `repo` (see below).

**X** — [Developer Portal](https://developer.x.com/en/portal/dashboard)

1. Create a Project + App (needs an X developer account with API access that
   can post)
2. Under **User authentication settings**, enable **OAuth 2.0**
3. App type: **Web App** (confidential client with a client secret)
4. App permissions: **Read and write** (needed to post)
5. **Callback URI / Redirect URL**: the Agent Auth URI above
6. Website URL: any URL you control
7. Save, then copy **Client ID** + **Client Secret**

Catalog defaults for `x` are `tweet.read`, `users.read`, and `offline.access`.
Posting via `x__post_tweet` also needs **`tweet.write`**, so override scopes
when creating the connection (see below).

Inspect catalog defaults anytime with `npx mda connections catalog`.

#### 2. Register workspace connections

From `tweet-composer/` (after the agent project exists in the workspace —
typically after the first `mda deploy` / `npm run deploy:agent`):

```bash
# Put client secrets in the environment (never commit them).
export X_CLIENT_ID=...
export X_CLIENT_SECRET=...
export GITHUB_CLIENT_ID=...
export GITHUB_CLIENT_SECRET=...

npx mda connections create x \
  --oauth x \
  --client-id "$X_CLIENT_ID" \
  --secret-from-env X_CLIENT_SECRET \
  --scope tweet.read \
  --scope tweet.write \
  --scope users.read \
  --scope offline.access

npx mda connections create github \
  --oauth github \
  --client-id "$GITHUB_CLIENT_ID" \
  --secret-from-env GITHUB_CLIENT_SECRET \
  --scope repo
```

Notes:

- Slugs **must** match `connectors/mcp.ts` (`x`, `github`). Rename
  either side if you prefer different names.
- `--scope` **replaces** catalog defaults (it does not merge). For X, re-list
  the read scopes plus `tweet.write`. For GitHub, `repo` alone is enough for
  PR research via `https://api.githubcopilot.com/mcp/readonly`.
- `--secret-from-env` keeps the client secret out of shell history; omit it to
  be prompted, or use `--secret-from-file`.
- There is no update-scopes command: change scopes with
  `npx mda connections delete <slug> --yes`, then recreate.
- Confirm with `npx mda connections get github` / `x`.

#### 3. Connect as a signed-in user

On the first run that needs GitHub or X, the UI shows a **Connect
integrations** card. Each row opens the provider authorize URL, long-polls
Agent Auth session status (via the same-origin `/api/agent-auth` proxy), then
shows a checkmark. There is **no Continue button** — once every connection
succeeds the card auto-resumes the run.

If you previously connected with weaker scopes (e.g. GitHub without `repo`),
delete the workspace connection, recreate with the scopes above, and reconnect
in the UI so a new token is issued.

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

Register `x` and `github` as in
[Connections](#connections-oauth-apps--workspace-slots), then:

```bash
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
- GitHub MCP is the read-only remote endpoint, but the OAuth token still needs
  the `repo` scope for PR tools. X posts require `tweet.write` plus an explicit
  HITL decision.
- Shared `/memories/agent/` is for procedural voice prefs only — not secrets.
