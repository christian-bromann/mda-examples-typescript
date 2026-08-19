/**
 * Stage large GitHub tool results directly into the thread sandbox.
 *
 * Without this middleware, the model has to copy the complete JSON payload
 * into a `write_file` call. That is slow and needlessly consumes model tokens.
 * This middleware performs the same handoff in code and replaces the tool
 * message seen by the model with a short path note.
 */
import {
  AIMessage,
  createMiddleware,
  ToolMessage,
  type BaseMessage,
} from "langchain";

const STAGED_KWARG = "mda_staged_github_data";

const OUTPUT_PATHS: Record<string, string> = {
  fetch_repo_overview: "/workspace/data/overview.json",
  fetch_repo_pull_requests: "/workspace/data/prs.json",
  fetch_repo_contributors: "/workspace/data/contributors.json",
  fetch_repo_issues: "/workspace/data/issues.json",
};

interface InvokableTool {
  name?: string;
  invoke?: (input: unknown, config?: unknown) => Promise<unknown> | unknown;
}

const pendingRewrites = new Map<string, ToolMessage>();

function messageKey(message: ToolMessage): string {
  return message.id || message.tool_call_id;
}

function toolName(
  message: ToolMessage,
  messages: BaseMessage[]
): string | undefined {
  if (message.name) return message.name;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!AIMessage.isInstance(candidate)) continue;
    const call = candidate.tool_calls?.find(
      (item) => item.id === message.tool_call_id
    );
    if (call) return call.name;
  }
  return undefined;
}

function jsonContent(message: ToolMessage): string | null {
  if (typeof message.content !== "string") return null;
  try {
    const parsed = JSON.parse(message.content) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed
    ) {
      return null;
    }
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return null;
  }
}

function resultCount(content: string): number | undefined {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.count === "number") return parsed.count;
    if (typeof parsed.contributorCount === "number") {
      return parsed.contributorCount;
    }
  } catch {
    // The content was already validated; this is only best-effort metadata.
  }
  return undefined;
}

function stagedMessage(
  message: ToolMessage,
  path: string,
  content: string
): ToolMessage {
  const count = resultCount(content);
  const suffix = count === undefined ? "" : ` (${count} records)`;
  return new ToolMessage({
    id: message.id,
    content:
      `GitHub data staged at ${path}${suffix}. ` +
      "Load that file directly with pandas or Python; do not copy it with write_file.",
    tool_call_id: message.tool_call_id,
    name: message.name,
    status: message.status,
    additional_kwargs: {
      ...message.additional_kwargs,
      [STAGED_KWARG]: path,
    },
    response_metadata: message.response_metadata,
  });
}

/** Write GitHub payloads to `/workspace/data` before the model sees them. */
export function stageGithubDataMiddleware() {
  return createMiddleware({
    name: "stageGithubData",
    wrapModelCall: async (request, handler) => {
      const messages = request.messages;
      if (!messages?.length) return handler(request);

      const writeFile = (request.tools as InvokableTool[]).find(
        (tool) => tool.name === "write_file" && typeof tool.invoke === "function"
      );
      if (!writeFile?.invoke) return handler(request);

      const nextMessages = messages.slice();
      let changed = false;

      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        if (!ToolMessage.isInstance(message)) continue;
        if (message.additional_kwargs?.[STAGED_KWARG]) continue;

        const name = toolName(message, messages);
        const path = name ? OUTPUT_PATHS[name] : undefined;
        const content = jsonContent(message);
        if (!path || !content) continue;

        try {
          await writeFile.invoke(
            { file_path: path, content },
            request.runtime
          );
        } catch (error) {
          console.warn(`[stageGithubData] failed to stage ${path}:`, error);
          continue;
        }

        const rewritten = stagedMessage(message, path, content);
        pendingRewrites.set(messageKey(message), rewritten);
        nextMessages[index] = rewritten;
        changed = true;
      }

      return handler(changed ? { ...request, messages: nextMessages } : request);
    },
    afterModel: (state) => {
      if (pendingRewrites.size === 0 || !state.messages?.length) {
        return undefined;
      }

      let changed = false;
      const messages = state.messages.map((message) => {
        if (!ToolMessage.isInstance(message)) return message;
        const rewritten = pendingRewrites.get(messageKey(message));
        if (!rewritten) return message;
        pendingRewrites.delete(messageKey(message));
        changed = true;
        return rewritten;
      });

      return changed ? { messages } : undefined;
    },
  });
}
