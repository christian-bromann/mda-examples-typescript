# sandbox-assistant

A **Supabase-authenticated** Managed Deep Agent that works as a hands-on
assistant inside a **per-thread LangSmith sandbox** (files + shell).

1. Sign in via Supabase email/password (browser UI)
2. Ask the agent to write scripts, transform data, or run experiments
3. Or **attach a PDF or text file**, stage it in the sandbox, and ask questions
4. It uses sandbox filesystem tools and `execute` in an isolated environment

This shows how little it takes to put an MDA behind Supabase login *and* give it
a real workspace: `auth.supabase({ projectRef })` for identity, plus
`sandboxes.langsmith(...)` for isolated execution.

## Layout

```text
sandbox-assistant/
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

- **Supabase login** — JWKS `validated_token` identity (browser Bearer token)
- **Managed sandbox** — per-thread LangSmith sandbox (files + shell)
- **File Q&A** — chat upload → stage to `/workspace/uploads/` → read text (or `pypdf` for PDFs) → answer
- **Browser chat** — `@langchain/react` `useStream` + Vite proxy locally
- **Private threads** — default identity scope isolates conversations per user

## Upload a file

1. Click the paperclip and choose a PDF or text file (`.txt`, `.md`, `.csv`, `.json`,
   source code, … — up to ~4MB).
2. Ask a question (or send with an empty prompt — defaults to “What is in this file?”).
3. Middleware stages the file under `/workspace/uploads/`.
4. **Text files** — the agent `read_file`s them directly. **PDFs** — it installs
   `pypdf` on demand, extracts to a sibling `.txt`, then answers from that text.

## Configure

1. Create a Supabase project. Enable **Email** auth.
2. Copy env and fill secrets. `identity.ts` reads the project ref from
   `SUPABASE_PROJECT_REF`, or parses it from `SUPABASE_URL` /
   `VITE_SUPABASE_URL` (`https://<project-ref>.supabase.co`).

```bash
cd sandbox-assistant
cp env.example .env
```

| Variable | Where | Notes |
| --- | --- | --- |
| `LANGSMITH_API_KEY` | agent | Deploy + sandboxes |
| `OPENAI_API_KEY` | agent | Model |
| `MDA_GUEST_SIGNING_KEY` | agent | Random string (identity runtime) |
| `VITE_SUPABASE_URL` | UI (build-time) | Publishable URL |
| `VITE_SUPABASE_ANON_KEY` | UI (build-time) | Publishable / anon key |
| `VITE_LANGGRAPH_API_URL` | UI (build-time) | Required for Cloudflare / remote UI |
| `VITE_LANGGRAPH_ASSISTANT_ID` | UI (build-time) | Default `sandbox-assistant` |

## Run locally

```bash
npm run dev
```

Starts the agent (`:2024`) and UI (`:4900`) together. Open
[http://localhost:4900](http://localhost:4900), sign in, then try:

- “Create a workspace and write a hello.py, then run it”
- Attach a `.md` / `.txt` / PDF and ask “What are the main sections?”

Leave `VITE_LANGGRAPH_API_URL` unset locally (Vite proxies to `:2024`).

## Deploy

### 1. Agent (LangSmith)

```bash
npm run deploy:agent
```

### 2. UI (Cloudflare)

```bash
# Set VITE_LANGGRAPH_API_URL to the LangSmith deployment URL first
npm run deploy:ui
```

Or use **Actions → Deploy agent → Run workflow** and pick `sandbox-assistant`.
That deploys the agent to LangSmith and the UI to Cloudflare (needs
`CLOUDFLARE_*` plus the `VITE_*` secrets above).

## Security notes

- MDA verifies the Supabase JWT; tools never re-parse the bearer token.
- Sandbox work is isolated per conversation thread (`scope: "thread"`).
- Shared `/memories/agent/` is for procedural prefs only — not personal data.
