# Repo Pulse analytics base image (private Docker Hub).
#
# MDA does not build this Dockerfile. Publish it to a **private** Hub repo,
# then set `dockerImage` + `registry` in `sandbox/index.ts`. With no
# `setup.sh`, bake turns the image into the recipe snapshot directly.
#
# Two publish flags are load-bearing; without either, bake fails with a bare
# "Snapshot creation failed. Please retry." and no server-side detail:
#
#   --platform linux/amd64  the sandbox host is amd64, and a build on an arm64
#                           machine otherwise publishes an arm64-only image
#   --provenance=false      buildx otherwise adds an attestation manifest to the
#   --sbom=false            index, which the snapshot builder cannot resolve
#
#   echo "$DOCKERHUB_TOKEN" | docker login -u christianbromann --password-stdin
#   docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
#     -t christianbromann/mda-repo-pulse:0.1.3 --push .
#
FROM python:3.12-slim

ARG GH_VERSION=2.74.2

ENV DEBIAN_FRONTEND=noninteractive \
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/mplconfig \
    PATH="/opt/mda-pulse/bin:${PATH}" \
    BASH_ENV=/etc/mda/bashenv.sh

RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
  && rm -rf /var/lib/apt/lists/*

# Official GitHub CLI binary (amd64 sandbox host).
RUN curl -fsSL \
      "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    | tar -xz -C /tmp \
  && mkdir -p /usr/local/lib/mda \
  && install -m 0755 "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/lib/mda/gh \
  && rm -rf "/tmp/gh_${GH_VERSION}_linux_amd64" \
  && /usr/local/lib/mda/gh --version

# Middleware stages GITHUB_TOKEN to /run/secrets/github_token, so the token
# never enters prompts or tool args. A snapshot-booted sandbox is a VM, not a
# `docker run`, so image `ENV` may not reach `bash -c`: this wrapper reads the
# secret itself instead of relying on BASH_ENV being inherited.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'if [ -z "$GH_TOKEN" ] && [ -f /run/secrets/github_token ]; then' \
  '  GH_TOKEN="$(cat /run/secrets/github_token)"' \
  '  export GH_TOKEN' \
  'fi' \
  'exec /usr/local/lib/mda/gh "$@"' \
  > /usr/local/bin/gh \
  && chmod 0755 /usr/local/bin/gh

# Belt and braces for plain `bash -c` when image ENV *is* inherited.
RUN mkdir -p /etc/mda \
  && printf '%s\n' \
  'if [ -f /run/secrets/github_token ]; then' \
  '  export GH_TOKEN="$(cat /run/secrets/github_token)"' \
  '  export GITHUB_TOKEN="$GH_TOKEN"' \
  'fi' \
  > /etc/mda/bashenv.sh

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
  && export PATH="/root/.local/bin:${PATH}" \
  && uv venv /opt/mda-pulse \
  && uv pip install --python /opt/mda-pulse/bin/python \
    pandas \
    pyarrow \
    matplotlib \
    seaborn

RUN printf '%s\n' \
  '# source /opt/mda-pulse/activate-pulse.sh' \
  'source /opt/mda-pulse/bin/activate' \
  'export MPLBACKEND=Agg' \
  'export MPLCONFIGDIR=/tmp/mplconfig' \
  'mkdir -p "$MPLCONFIGDIR"' \
  > /opt/mda-pulse/activate-pulse.sh

RUN mkdir -p /workspace/data /workspace/out /tmp/mplconfig /run/secrets \
  && /opt/mda-pulse/bin/python -c "import matplotlib; matplotlib.use('Agg'); import pandas as pd; import seaborn as sns; print(f'ok: pandas={pd.__version__} seaborn={sns.__version__}')" \
  && gh --version \
  && jq --version

WORKDIR /workspace
