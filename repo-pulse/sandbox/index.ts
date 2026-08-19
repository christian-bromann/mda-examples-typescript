import { defineSandbox } from "managed-deepagents";

/**
 * Per-thread LangSmith sandbox with a **private Docker Hub** bake base.
 *
 * `dockerImage` must already be published — MDA does not build
 * `sandbox/Dockerfile`. With no `setup.sh`, bake turns that image into the
 * recipe snapshot directly (pure Docker path).
 *
 * `registry` tells MDA to reconcile a deployment-owned Host registry from
 * `DOCKERHUB_TOKEN` before pulling. The token never enters the build or
 * recipe snapshot.
 *
 * Build / push (from this directory; repo must be private on Docker Hub). The
 * platform and attestation flags are required — see `sandbox/Dockerfile`:
 *
 * ```bash
 * echo "$DOCKERHUB_TOKEN" | docker login -u christianbromann --password-stdin
 * docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
 *   -t christianbromann/mda-repo-pulse:0.1.1 --push .
 * ```
 *
 * Requires an `mda` CLI that extracts `dockerImage` + `registry` (a
 * managed-deepagents release that includes bake bases).
 */
export const sandbox = defineSandbox({
  idleTtlSeconds: 600,
  defaultTimeout: 600,
  dockerImage: "christianbromann/mda-repo-pulse:0.1.1",
  registry: {
    url: "docker.io",
    username: "christianbromann",
    passwordEnv: "DOCKERHUB_TOKEN",
  },
});
