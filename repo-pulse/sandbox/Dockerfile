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
#     -t christianbromann/mda-repo-pulse:0.1.1 --push .
#
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/mplconfig \
    PATH="/opt/mda-pulse/bin:${PATH}"

RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends \
    ca-certificates \
    curl \
    git \
  && rm -rf /var/lib/apt/lists/*

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

RUN mkdir -p /workspace/data /workspace/out /tmp/mplconfig \
  && /opt/mda-pulse/bin/python -c "import matplotlib; matplotlib.use('Agg'); import pandas as pd; import seaborn as sns; print(f'ok: pandas={pd.__version__} seaborn={sns.__version__}')"

WORKDIR /workspace
