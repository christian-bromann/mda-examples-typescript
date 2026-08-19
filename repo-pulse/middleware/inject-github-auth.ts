/**
 * Stage `GITHUB_TOKEN` into the thread sandbox for the baked `gh` CLI.
 *
 * The model never sees the token: middleware writes it via `write_file` on
 * the first model turn. The image's `BASH_ENV` exports `GH_TOKEN` from
 * `/run/secrets/github_token` for every non-interactive bash command.
 */
import { createMiddleware } from "langchain";

const SECRET_PATH = "/run/secrets/github_token";

interface InvokableTool {
  name?: string;
  invoke?: (input: unknown, config?: unknown) => Promise<unknown> | unknown;
}

function githubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT;
  return token?.trim() || undefined;
}

/** Write the deploy `GITHUB_TOKEN` into the sandbox once per process lifetime. */
export function injectGithubAuthMiddleware() {
  let staged = false;

  return createMiddleware({
    name: "injectGithubAuth",
    wrapModelCall: async (request, handler) => {
      if (staged) return handler(request);

      const token = githubToken();
      if (!token) return handler(request);

      const writeFile = (request.tools as InvokableTool[]).find(
        (tool) => tool.name === "write_file" && typeof tool.invoke === "function"
      );
      if (!writeFile?.invoke) return handler(request);

      try {
        await writeFile.invoke(
          { file_path: SECRET_PATH, content: `${token}\n` },
          request.runtime
        );
        staged = true;
      } catch (error) {
        console.warn(`[injectGithubAuth] failed to stage ${SECRET_PATH}:`, error);
      }

      return handler(request);
    },
  });
}
