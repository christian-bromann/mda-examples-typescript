/**
 * Default demo repository shown on the empty-state card.
 * Override with `VITE_DEFAULT_REPO=owner/repo` in `.env`.
 */
export const DEFAULT_REPO =
  (import.meta.env.VITE_DEFAULT_REPO as string | undefined)?.trim() ||
  "langchain-ai/langchain";

export const DEFAULT_REPO_LABEL = "Public · lots of PRs & contributors";

/** Normalize a slug; returns null if invalid. */
export function normalizeRepoSlug(input: string): string | null {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return null;
  return trimmed;
}
