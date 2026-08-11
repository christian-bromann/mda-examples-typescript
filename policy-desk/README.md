# Policy Desk

An employee-facing **Policy Desk**: staff sign in, drop a handbook or policy PDF,
and get concrete guidance (“How many PTO days in year one?”, “Can I expense this
laptop?”). Each conversation runs in a **per-thread LangSmith sandbox** so the
agent can extract text, annotate sections, and work from the files they uploaded.

1. Sign in with your company account (Supabase email/password in this demo)
2. Attach a handbook, PTO policy, expense guidelines, or other policy doc
3. Ask what applies to your situation — or ask the desk to summarize / compare
4. The agent stages uploads under `/workspace/uploads/`, reads or extracts them
   in an isolated sandbox, and answers with citations from the file

Technically this shows Supabase JWT identity (`auth.supabase`) plus a managed
sandbox (`sandboxes.langsmith`) behind a browser chat UI.

## Layout

```text
policy-desk/
  agent.ts                 # defineDeepAgent + staging middleware
  identity.ts              # auth.supabase({ projectRef })
  memory.ts                # defineMemory({ scope: "agent" }) — procedural only
  middleware/              # stage chat PDF uploads into the sandbox
  sandbox/index.ts         # sandboxes.langsmith({ scope: "thread" })
  instructions.md
  src/                     # Vite + React chat (Supabase login)
  wrangler.jsonc           # Cloudflare Workers static assets for the UI
  env.example
```

## What this demonstrates

- **Use case** — authenticated Policy Desk: upload policies → ask → get guidance
- **Supabase login** — JWKS `validated_token` identity (browser Bearer token)
- **Managed sandbox** — per-thread LangSmith sandbox (files + shell)
- **File Q&A** — chat upload → stage to `/workspace/uploads/` → read text (or `pypdf` for PDFs) → answer
- **Browser chat** — `@langchain/react` `useStream` + Vite proxy locally
- **Private threads** — default identity scope isolates conversations per employee

## Upload a policy

1. Click the paperclip and choose a PDF or text file (`.txt`, `.md`, `.csv`, `.json`,
   source code, … — up to ~4MB).
2. Ask a question (or send with an empty prompt — defaults to a policy summary
   request).
3. Middleware stages the file under `/workspace/uploads/`.
4. **Text files** — the agent `read_file`s them directly. **PDFs** — it installs
   `pypdf` on demand, extracts to a sibling `.txt`, then answers from that text.

## Configure

1. Create a Supabase project. Enable **Email** auth.
2. Copy env and fill secrets. `identity.ts` parses the project ref from
   `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`).

```bash
cd policy-desk
cp env.example .env
```

| Variable | Where | Notes |
| --- | --- | --- |
| `LANGSMITH_API_KEY` | agent | Deploy + sandboxes |
| `OPENAI_API_KEY` | agent | Model |
| `MDA_GUEST_SIGNING_KEY` | agent | Random string (identity runtime) |
| `VITE_SUPABASE_URL` | UI + agent | Publishable URL; agent parses project ref from host |
| `VITE_SUPABASE_ANON_KEY` | UI (build-time) | Publishable / anon key |
| `POLICY_DESK_DEPLOYMENT_API` | UI (build-time) + Actions secret | LangSmith MDA API URL — required for Cloudflare / remote UI; leave unset for local Vite proxy |
| `CLOUDFLARE_API_TOKEN` | wrangler | Workers deploy (`npm run deploy`) |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler | Cloudflare account ID |

The UI must know where the hosted agent lives. That **API URL only exists after
the first agent deploy** — see [Deploy](#deploy).

## Run locally

```bash
npm run dev
```

Starts the agent (`:2024`) and UI (`:4900`) together. Open
[http://localhost:4900](http://localhost:4900), sign in, then try:

- Attach an employee handbook PDF and ask “How many PTO days do I get in year one?”
- Drop expense guidelines and ask “Can I expense a standing desk?”
- Attach a remote-work policy and ask “Summarize the main rules for hybrid staff”

Leave `POLICY_DESK_DEPLOYMENT_API` unset locally (Vite proxies to `:2024`).

## Deploy

Policy Desk ships in two parts: the **agent** (LangSmith) and the **UI**
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

### 2. Set `POLICY_DESK_DEPLOYMENT_API`

Put that URL in `.env` for local UI deploys, and as the GitHub Actions repo
secret of the same name for CI.

### 3. Deploy the UI

```bash
npm run deploy:ui
# or, once the URL is set, both steps together:
npm run deploy
```

Or use **Actions → Deploy agent → Run workflow** and pick `policy-desk`.
That deploys the agent to LangSmith and the UI to Cloudflare. After the first
agent deploy, set `POLICY_DESK_DEPLOYMENT_API` (plus `CLOUDFLARE_*` and the
`VITE_SUPABASE_*` secrets above) so the UI build can reach the hosted agent.
On the very first Actions run, the UI step fails until that secret is set —
re-run the workflow after copying the API URL from LangSmith.

## Security notes

- MDA verifies the Supabase JWT; tools never re-parse the bearer token.
- Sandbox work is isolated per conversation thread (`scope: "thread"`).
- Shared `/memories/agent/` is for procedural prefs only — not personal data.
