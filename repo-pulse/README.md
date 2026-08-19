# Repo Pulse

A **maintainer analytics** agent with the same chat + chart UI shell as
[`data-analyst/`](../data-analyst): pick a GitHub repository, ask about
contributors / review latency / throughput, and get inline PNG charts from a
baked pandas / matplotlib sandbox.

1. You build and push `sandbox/Dockerfile` to a **private** Docker Hub repo
2. `mda deploy` / `mda dev` reconciles a Host registry from `DOCKERHUB_TOKEN`,
   then bakes that `dockerImage` into a LangSmith recipe snapshot (no
   `setup.sh` — pure Docker bake path)
3. Each new thread clones that snapshot
4. GitHub tools (`GITHUB_TOKEN`) collect PRs, contributors, and issues
5. Middleware stages metrics under `/workspace/data/`; charts go to
   `/workspace/out/` and attach as PNGs on the final assistant message

## Layout

```text
repo-pulse/
  agent.ts                     # defineDeepAgent + chart middleware + tools
  identity.ts                  # trusted-backend ingress
  instructions.md
  tools/                       # Octokit: overview, PRs, contributors, issues
  middleware/
    stage-github-data.ts       # tool JSON → /workspace/data/*.json (no model copy)
    stream-analysis-charts.ts  # /workspace/out/*.png → message image blocks
  sandbox/
    index.ts                   # defineSandbox({ dockerImage, registry })
    Dockerfile                 # analytics base — build & push to private Hub
  src/                         # Vite + React chat (data-analyst UI adapted)
  vite.config.ts               # proxy stamps MDA ingress headers in dev
  env.example
```

## What this demonstrates

- **Private Docker Hub + managed registry** — `registry: { url, username,
  passwordEnv }` so MDA creates/updates a deployment-owned Host registry and
  pulls with `registry_id` (token never enters the recipe snapshot)
- **Pure Docker recipe** — empty / absent `setup.sh`, so bake is
  `create_snapshot_from_docker_image` only
- **GitHub tools + sandbox analysis** — fetch with Octokit, chart with pandas
- **Automatic data staging** — middleware writes GitHub results directly into
  the sandbox instead of making the model reproduce large JSON in `write_file`
- **Inline analysis charts** — same PNG streaming path as data-analyst
- **Trusted-backend identity** — Vite proxy stamps `X-MDA-Ingress-Secret`

## Publish the private sandbox image

1. Create `christianbromann/mda-repo-pulse` on Docker Hub and set it to
   **Private**.
2. Create an access token (Hub → Account Settings → Security). Read-only is
   enough for bake pulls; push needs Read, Write, Delete.
3. From `sandbox/` (or use the npm scripts):

```bash
docker build -t christianbromann/mda-repo-pulse:0.1.0 .
echo "$DOCKERHUB_TOKEN" | docker login -u christianbromann --password-stdin
docker push christianbromann/mda-repo-pulse:0.1.0
```

Or: `npm run build:sandbox && npm run login:sandbox && npm run push:sandbox`.

Change the tag / username in `sandbox/index.ts` (`dockerImage`,
`registry.username`) and the npm scripts if you use a different Hub account.

> **CLI note:** `dockerImage` + `registry` bake needs an `mda` that understands
> bake bases (the SDK that added private-registry support). Until that lands in
> the published `managed-deepagents` you pin, use a locally built `mda` from the
> SDK repo for `mda dev` / `mda deploy`. Package types may lag —
> `sandbox/index.ts` casts the options for `tsc`.

## Configure

```bash
cd repo-pulse
npm install
cp env.example .env
# set LANGSMITH_API_KEY, OPENAI_API_KEY, MDA_INGRESS_SECRET,
# GITHUB_TOKEN, DOCKERHUB_TOKEN
```

| Variable | Notes |
| --- | --- |
| `LANGSMITH_API_KEY` | Deploy + sandbox bake |
| `OPENAI_API_KEY` | Model |
| `MDA_INGRESS_SECRET` | Trusted-backend ingress — read by the Vite proxy, never shipped to the browser |
| `GITHUB_TOKEN` | PAT with read access to the repos you analyze |
| `DOCKERHUB_TOKEN` | Hub access token for the private image (`registry.passwordEnv`) |
| `LANGSMITH_WORKSPACE_ID` | If your key is org-scoped |
| `VITE_DEFAULT_REPO` | Optional UI default (`owner/repo`) |

## Run locally

```bash
npm run dev
```

Starts the agent (`:2024`) and UI (`:4911`) together. The first run reconciles
the Host registry, pulls the private image, and bakes the recipe snapshot.
Later runs reuse it until `dockerImage` / `registry` (or their digest) change.

Open [http://localhost:4911](http://localhost:4911), pick the default demo repo
(or enter another `owner/repo`), and try:

- “Chart contributor concentration and estimate bus factor.”
- “What’s the median time from PR open to merge?”
- “Show weekly PR throughput (opened vs merged).”

High-resolution PNGs render inline in chat.

## Deploy

```bash
npm run deploy
```

Or use **Actions → Deploy agent → repo-pulse**. That deploys the agent only.
The UI is a local development client: a hosted version needs a backend that
stamps the ingress headers (see
[`account-concierge/proxy/server.mjs`](../account-concierge/proxy/server.mjs))
or a browser-facing identity like
[`policy-desk/`](../policy-desk)’s Supabase JWT.
