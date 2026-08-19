/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of a backend that proxies agent traffic and stamps the MDA
   * ingress headers. Leave unset for the local Vite proxy.
   */
  readonly REPO_PULSE_DEPLOYMENT_API?: string;
  /** Optional empty-state default repository (`owner/repo`). */
  readonly VITE_DEFAULT_REPO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
