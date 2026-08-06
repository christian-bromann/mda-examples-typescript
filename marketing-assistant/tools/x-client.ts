import { TwitterApi } from "twitter-api-v2";

/** App-only bearer client for search and timeline reads. */
export function xReadClientFromEnv():
  | TwitterApi
  | { skipped: true; error: string } {
  const bearer = process.env.X_BEARER_TOKEN?.trim();
  if (!bearer) {
    return {
      skipped: true,
      error:
        "X is optional. Set X_BEARER_TOKEN to enable search_x_posts / get_x_user_timeline.",
    };
  }
  return new TwitterApi(bearer);
}
