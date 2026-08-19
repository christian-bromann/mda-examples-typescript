# Data Analyst

A **sandbox-first data analyst** with a browser chat UI: drag a CSV into the
composer, ask a business question, and the agent analyzes it with pandas /
DuckDB / matplotlib — without installing anything on the first message.

Studio cannot attach CSVs, so this example ships its own small chat UI. The
bundled sample dataset appears as a **draggable file chip** above the composer:
drag it into the prompt (or click it) and it is attached exactly like a file
from your machine.

1. `mda deploy` / `mda dev` bakes `sandbox/setup.sh` into a LangSmith recipe
   snapshot (uv venv + pandas, pyarrow, DuckDB, matplotlib)
2. Each new thread clones that snapshot
3. You drop a CSV; middleware stages it at `/workspace/uploads/<name>.csv`
4. The agent writes detailed PNGs to `/workspace/out/`; middleware attaches the
   raw images to the final assistant message

## Layout

```text
data-analyst/
  agent.ts                     # defineDeepAgent + staging middleware
  identity.ts                  # trusted-backend ingress
  instructions.md
  middleware/
    stage-chat-uploads.ts      # chat attachment → /workspace/uploads/
  sandbox/
    index.ts                   # defineSandbox
    setup.sh                   # bake: uv venv + analytics packages
  fixtures/                    # Vite publicDir — also the UI's sample download
    online_retail_sample.csv
    ATTRIBUTION.md
  src/                         # Vite + React chat (no login)
  vite.config.ts               # proxy stamps MDA ingress headers in dev
  env.example
```

## What this demonstrates

- **Recipe bake** — heavy provision once per deploy, not per thread
- **Analytics tooling in the snapshot** — pandas, pyarrow, DuckDB, matplotlib
- **Chat upload → sandbox** — base64 file block staged with `write_file`, then
  stripped from model context so a multi-MB CSV never hits the prompt
- **Drag-and-drop sample data** — the demo CSV behaves like a local file
- **Inline analysis charts** — sandbox-generated PNGs stream back as image
  content blocks and render directly in the conversation
- **Trusted-backend identity** — the Vite dev proxy stamps
  `X-MDA-Ingress-Secret`; the browser never sees it

## Dataset

UCI [Online Retail](https://archive.ics.uci.edu/dataset/352/online+retail)
(Chen, 2015; DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33), CC BY 4.0).

`fixtures/online_retail_sample.csv` is a ~12k-row slice (Jan–Mar 2011; UK,
France, Germany, EIRE, Netherlands). See
[`fixtures/ATTRIBUTION.md`](./fixtures/ATTRIBUTION.md).

## Configure

```bash
cd data-analyst
npm install
cp env.example .env
# set LANGSMITH_API_KEY, OPENAI_API_KEY, MDA_INGRESS_SECRET
```

| Variable | Notes |
| --- | --- |
| `LANGSMITH_API_KEY` | Deploy + sandbox bake |
| `OPENAI_API_KEY` | Model |
| `MDA_INGRESS_SECRET` | Trusted-backend ingress — read by the Vite proxy, never shipped to the browser |
| `LANGSMITH_WORKSPACE_ID` | If your key is org-scoped |

## Run locally

```bash
npm run dev
```

Starts the agent (`:2024`) and UI (`:4910`) together. The first run bakes the
recipe (uv + packages) — expect a couple of minutes. Later runs with an
unchanged `setup.sh` reuse the ready snapshot.

Open [http://localhost:4910](http://localhost:4910), drag
`online_retail_sample.csv` into the composer, and try:

- “Chart revenue by month.”
- “Top 10 products by revenue.”
- “What’s the cancellation rate, and how does it differ by country?”
- “Average order value by country.”

High-resolution PNGs render inline in chat and can be opened or downloaded by
clicking them.

## Deploy

```bash
npm run deploy
```

Or use **Actions → Deploy agent → data-analyst**. That deploys the agent only.
The UI is a local development client: a hosted version needs a backend that
stamps the ingress headers (see
[`account-concierge/proxy/server.mjs`](../account-concierge/proxy/server.mjs))
or a browser-facing identity like
[`policy-desk/`](../policy-desk)’s Supabase JWT.
