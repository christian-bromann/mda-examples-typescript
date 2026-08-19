# Repo Pulse

A **maintainer analytics** agent with the same chat + chart UI shell as
[`data-analyst/`](../data-analyst): pick a GitHub repository, ask about
contributors / review latency / throughput, and get inline PNG charts from a
baked pandas / matplotlib sandbox that also ships the **`gh` CLI**.

1. You build and push `sandbox/Dockerfile` to a **private** Docker Hub repo
2. `mda deploy` / `mda dev` reconciles a Host registry from `DOCKERHUB_TOKEN`,
   then bakes that `dockerImage` into a LangSmith recipe snapshot (no
   `setup.sh` — pure Docker bake path)
3. Each **new** thread clones that snapshot (live threads keep their existing
   box, so bump the tag *and* start a new thread to pick up image changes)
4. Middleware stages `GITHUB_TOKEN` into the box; the agent fetches metrics
   with `gh` via `execute` and writes JSON under `/workspace/data/`
5. Charts go to `/workspace/out/` and attach as PNGs on the final assistant
   message

## Layout

```text
repo-pulse/
  agent.ts                     # defineDeepAgent + auth + chart middleware
  identity.ts                  # trusted-backend ingress
  instructions.md              # use gh + pandas in the sandbox
  middleware/
    inject-github-auth.ts     # GITHUB_TOKEN → /run/secrets (for gh)
    stream-analysis-charts.ts  # /workspace/out/*.png → message image blocks
  sandbox/
    index.ts                   # defineSandbox({ dockerImage, registry })
    Dockerfile                 # gh + jq + pandas/matplotlib — push to Hub
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
- **Preinstalled `gh` in the bake base** — no custom Octokit tools; the agent
  shells out to the GitHub CLI like a maintainer would
- **Token injection without model exposure** — middleware writes
  `GITHUB_TOKEN` to `/run/secrets/github_token`; a `gh` wrapper in the image
  reads that file, so auth does not depend on image `ENV` reaching `bash -c`
- **Inline analysis charts** — same PNG streaming path as data-analyst
- **Trusted-backend identity** — Vite proxy stamps `X-MDA-Ingress-Secret`

## Publish the private sandbox image

1. Create `christianbromann/mda-repo-pulse` on Docker Hub and set it to
   **Private**.
2. Create an access token (Hub → Account Settings → Security). Read-only is
   enough for bake pulls; push needs Read, Write, Delete.
3. From `sandbox/` (or use the npm scripts):

```bash
echo "$DOCKERHUB_TOKEN" | docker login -u christianbromann --password-stdin
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  -t christianbromann/mda-repo-pulse:0.1.3 --push .
```

Or: `npm run login:sandbox && npm run build:sandbox`.

Change the tag / username in `sandbox/index.ts` (`dockerImage`,
`registry.username`) and the npm scripts if you use a different Hub account.

> **CLI note:** pin `managed-deepagents` to a release that includes `dockerImage`
> + `registry` bake bases (for example `0.5.4-dev.4`).

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
| `GITHUB_TOKEN` | PAT with read access; staged into the sandbox for `gh` |
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
