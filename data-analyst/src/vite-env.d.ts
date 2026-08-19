/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of a backend that proxies agent traffic and stamps the MDA
   * ingress headers. Leave unset for the local Vite proxy.
   */
  readonly DATA_ANALYST_DEPLOYMENT_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
