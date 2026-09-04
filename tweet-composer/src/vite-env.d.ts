/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** LangSmith MDA API URL after the first agent deploy. Leave unset for local Vite proxy. */
  readonly TWEET_COMPOSER_DEPLOYMENT_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
