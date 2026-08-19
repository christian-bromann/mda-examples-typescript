/**
 * Stage `GITHUB_TOKEN` into the thread sandbox for the baked `gh` CLI.
 *
 * The model never sees the token: middleware writes it via `write_file` on the
 * first model turn of each thread. The path has no route prefix, so it lands at
 * the sandbox's real `/run/secrets/github_token`, and the image's `gh` wrapper
 * exports `GH_TOKEN` from that file for every command.
 */
import { createMiddleware } from "langchain";

const SECRET_PATH = "/run/secrets/github_token";

interface InvokableTool {
  name?: string;
  invoke?: (input: unknown, config?: unknown) => Promise<unknown> | unknown;
}

interface RuntimeConfigurable {
  configurable?: { thread_id?: string; [key: string]: unknown };
}

function githubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT;
  return token?.trim() || undefined;
}

/**
 * Reuse key for a run. Each thread gets its own sandbox, so staging must track
 * threads, not the process: a single boolean staged only the first thread's box
 * and left every later thread (or a box recreated after invalidation) without
 * the secret, which surfaces much later as `gh auth login` errors.
 */
function threadKey(runtime: unknown): string {
  const threadId = (runtime as RuntimeConfigurable | undefined)?.configurable
    ?.thread_id;
  return typeof threadId === "string" && threadId.trim()
    ? threadId
    : "__default__";
}

/** Write the deploy `GITHUB_TOKEN` into each thread's sandbox once. */
export function injectGithubAuthMiddleware() {
  const staged = new Set<string>();
  let warned = false;

  return createMiddleware({
    name: "injectGithubAuth",
    wrapModelCall: async (request, handler) => {
      const key = threadKey(request.runtime);
      if (staged.has(key)) return handler(request);

      const token = githubToken();
      if (!token) {
        // Silence here surfaces much later as `gh auth login` errors the model
        // cannot fix, so name the missing variable once per process.
        if (!warned) {
          warned = true;
          console.warn(
            "[injectGithubAuth] GITHUB_TOKEN is unset or empty — `gh` will run " +
              "unauthenticated and fail with 'not logged into any GitHub hosts'. " +
              "Set GITHUB_TOKEN in .env and restart."
          );
        }
        return handler(request);
      }

      const writeFile = (request.tools as InvokableTool[]).find(
        (tool) => tool.name === "write_file" && typeof tool.invoke === "function"
      );
      if (!writeFile?.invoke) return handler(request);

      try {
        await writeFile.invoke(
          { file_path: SECRET_PATH, content: `${token}\n` },
          request.runtime
        );
        staged.add(key);
      } catch (error) {
        console.warn(`[injectGithubAuth] failed to stage ${SECRET_PATH}:`, error);
      }

      return handler(request);
    },
  });
}
