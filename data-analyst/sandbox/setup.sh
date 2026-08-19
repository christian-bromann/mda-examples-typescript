#!/usr/bin/env bash
# Bake-time recipe for the Data Analyst sandbox.
#
# MDA runs this once at `mda deploy` / `mda dev`, then captures a snapshot.
# New threads clone that snapshot — they do not re-run this script, so the
# first message never waits on a package install.
#
# Fail closed: non-zero exit fails the bake.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends ca-certificates curl >/dev/null
fi

# --- Python analytics toolchain (uv + venv) ---------------------------------
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="${HOME}/.local/bin:/root/.local/bin:${PATH}"

uv venv /opt/mda-analyst
uv pip install --python /opt/mda-analyst/bin/python \
  pandas \
  pyarrow \
  duckdb \
  matplotlib

# Headless charts by default for agent `execute` calls.
cat >/opt/mda-analyst/activate-analyst.sh <<'EOF'
# source /opt/mda-analyst/activate-analyst.sh
source /opt/mda-analyst/bin/activate
export MPLBACKEND=Agg
export MPLCONFIGDIR=/tmp/mplconfig
mkdir -p "$MPLCONFIGDIR"
EOF

# Uploads land here (see middleware/stage-chat-uploads.ts); charts go to out/.
mkdir -p /workspace/uploads /workspace/out /tmp/mplconfig

# Smoke-check imports so a broken bake fails closed.
/opt/mda-analyst/bin/python - <<'PY'
import duckdb
import matplotlib
import pandas as pd

matplotlib.use("Agg")
print(f"ok: pandas={pd.__version__} duckdb={duckdb.__version__}")
PY

echo "sandbox/setup.sh: data-analyst recipe ready"
