/**
 * Stage chat dataset attachments into the per-thread LangSmith sandbox.
 *
 * There is no separate upload HTTP endpoint. The browser attaches (or drags) a
 * CSV in the chat UI (`src/components/chat-app.tsx`), encodes it as base64, and
 * submits a multimodal human message via `useStream` / LangGraph, e.g.:
 *
 * ```ts
 * {
 *   type: "human",
 *   content: [
 *     { type: "text", text: "Revenue by country?" },
 *     {
 *       type: "file",
 *       mime_type: "text/csv",
 *       source_type: "base64",
 *       data: "<base64…>",
 *       metadata: { filename: "online_retail_sample.csv" },
 *     },
 *   ],
 * }
 * ```
 *
 * This middleware runs before the model sees that message:
 *
 * 1. **`wrapModelCall`** — find allowed `file` blocks on the latest human
 *    message, decode base64 → UTF-8, and invoke harness `write_file` to
 *    `/workspace/uploads/<safe-name>`.
 * 2. Replace heavy file blocks with a short text note listing sandbox paths, so
 *    a multi-megabyte CSV never enters model context.
 * 3. **`afterModel`** — persist the rewritten human message into graph state
 *    (`additional_kwargs.mda_staged_uploads` holds the staged paths).
 *
 * Idempotency: in-process `stagedKeys` avoids re-uploading the same message
 * across model calls in one turn; `mda_staged_uploads` skips once state is
 * rewritten.
 *
 * Only text formats are accepted — binary workbooks would need a base64-aware
 * sandbox write path. `instructions.md` tells the agent to analyze staged files
 * with pandas / DuckDB rather than reading them into context.
 *
 * Wire this in `agent.ts` via `middleware: [stageChatUploadsMiddleware()]`.
 */

import { extname } from "node:path";
import { createMiddleware, HumanMessage } from "langchain";
import type { BaseMessage } from "langchain";

/** Sandbox directory for chat-staged uploads. */
const UPLOAD_DIR = "/workspace/uploads";

/** `additional_kwargs` key listing absolute paths written for this human message. */
const STAGED_KWARG = "mda_staged_uploads";

/** Message ids (or content fingerprints) already written to the sandbox this process. */
const stagedKeys = new Set<string>();

/** Rewritten human messages to merge into graph state after the model step. */
const pendingRewrites = new Map<string, HumanMessage>();

/**
 * Extensions we stage. Keep in sync with the chat UI `accept` list.
 * Unknown extensions default to rejected unless MIME is clearly text/*.
 */
const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".tsv",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
  ".log",
]);

type ContentBlock = Record<string, unknown>;

interface StagedUpload {
  fileName: string;
  /** UTF-8 payload for `write_file`. */
  writeContent: string;
  path: string;
}

function isRecord(value: unknown): value is ContentBlock {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return normalized.startsWith("text/") || normalized === "application/json";
}

function isStageable(mime: string | undefined, fileName: string | undefined): boolean {
  return isTextMime(mime) || TEXT_EXTENSIONS.has(extname(fileName ?? "").toLowerCase());
}

function safeFileName(raw: string, index: number): string {
  const base = raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "");
  return (base || `upload-${index + 1}.csv`).slice(0, 120);
}

function parseDataUrl(url: string): { mime?: string; base64: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]+)$/i.exec(url);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  if (!isBase64) return null;
  return { mime: match[1], base64: match[3] };
}

function decodeBase64Utf8(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf8");
}

function collectUploads(content: unknown): StagedUpload[] {
  if (!Array.isArray(content)) return [];

  const uploads: StagedUpload[] = [];
  let index = 0;

  for (const block of content) {
    if (!isRecord(block) || block.type !== "file") continue;

    const mime =
      (typeof block.mime_type === "string" && block.mime_type) ||
      (typeof block.mimeType === "string" && block.mimeType) ||
      (typeof block.mediaType === "string" && block.mediaType) ||
      undefined;

    const meta = isRecord(block.metadata) ? block.metadata : undefined;
    const fileNameCandidate =
      (typeof block.name === "string" && block.name) ||
      (typeof block.filename === "string" && block.filename) ||
      (typeof meta?.filename === "string" && meta.filename) ||
      (typeof meta?.name === "string" && meta.name) ||
      undefined;

    let base64: string | null = null;
    let dataUrlMime: string | undefined;
    if (typeof block.data === "string" && block.data.length > 0) {
      base64 = block.data;
    } else if (typeof block.url === "string" && block.url.startsWith("data:")) {
      const parsed = parseDataUrl(block.url);
      if (parsed) {
        base64 = parsed.base64;
        dataUrlMime = parsed.mime;
      }
    }

    if (!base64) continue;

    const effectiveMime = mime || dataUrlMime;
    if (!isStageable(effectiveMime, fileNameCandidate)) continue;

    const fileName = safeFileName(
      fileNameCandidate ?? `upload-${index + 1}.csv`,
      index
    );

    uploads.push({
      fileName,
      path: `${UPLOAD_DIR}/${fileName}`,
      writeContent: decodeBase64Utf8(base64),
    });
    index += 1;
  }

  return uploads;
}

function stagingNote(uploads: StagedUpload[]): string {
  const lines = uploads.map((u) => `- \`${u.path}\``);
  const header =
    uploads.length === 1
      ? "Attached dataset staged in the sandbox:"
      : "Attached datasets staged in the sandbox:";
  return `${header}\n${lines.join(
    "\n"
  )}\n\nAnalyze with pandas or DuckDB in the sandbox — do not read the whole file into context.`;
}

function rewriteContent(content: unknown, uploads: StagedUpload[]): string {
  const note = stagingNote(uploads);
  const textParts: string[] = [];

  if (typeof content === "string" && content.trim()) {
    textParts.push(content.trim());
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
        const t = block.text.trim();
        if (t) textParts.push(t);
      }
    }
  }

  textParts.push(note);
  return textParts.join("\n\n");
}

function messageKey(message: BaseMessage): string {
  if (typeof message.id === "string" && message.id.length > 0) return message.id;
  const text = typeof message.content === "string" ? message.content.slice(0, 80) : "human";
  return `anon:${text}:${Array.isArray(message.content) ? message.content.length : 0}`;
}

function alreadyStaged(message: BaseMessage): boolean {
  const kwargs = message.additional_kwargs as Record<string, unknown> | undefined;
  const staged = kwargs?.[STAGED_KWARG];
  return Array.isArray(staged) && staged.length > 0;
}

/**
 * Returns Deep Agents middleware that stages chat file attachments onto the
 * sandbox filesystem (see module docstring).
 */
export function stageChatUploadsMiddleware() {
  return createMiddleware({
    name: "stageChatUploads",
    wrapModelCall: async (request, handler) => {
      const messages = request.messages;
      if (!messages?.length) {
        return handler(request);
      }

      let lastHumanIndex = -1;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (HumanMessage.isInstance(messages[i])) {
          lastHumanIndex = i;
          break;
        }
      }
      if (lastHumanIndex < 0) {
        return handler(request);
      }

      const human = messages[lastHumanIndex];
      if (alreadyStaged(human)) {
        return handler(request);
      }

      const uploads = collectUploads(human.content);
      if (uploads.length === 0) {
        return handler(request);
      }

      const key = messageKey(human);
      const tools = request.tools as Array<{
        name?: string;
        invoke?: (input: unknown, config?: unknown) => unknown;
      }>;
      const writeFile = tools.find(
        (t) => t.name === "write_file" && typeof t.invoke === "function"
      );

      if (!writeFile?.invoke) {
        console.warn(
          "[stageChatUploads] write_file tool unavailable; leaving file blocks in the message"
        );
        return handler(request);
      }

      if (!stagedKeys.has(key)) {
        for (const upload of uploads) {
          try {
            await writeFile.invoke(
              { file_path: upload.path, content: upload.writeContent },
              request.runtime
            );
          } catch (err) {
            console.error(
              `[stageChatUploads] failed to stage ${upload.path}:`,
              err
            );
            return handler(request);
          }
        }
        stagedKeys.add(key);
      }

      const rewritten = new HumanMessage({
        id: human.id,
        content: rewriteContent(human.content, uploads),
        additional_kwargs: {
          ...human.additional_kwargs,
          [STAGED_KWARG]: uploads.map((u) => u.path),
        },
        response_metadata: human.response_metadata,
      });

      pendingRewrites.set(key, rewritten);

      const nextMessages = messages.slice();
      nextMessages[lastHumanIndex] = rewritten;
      return handler({ ...request, messages: nextMessages });
    },
    afterModel: (state) => {
      if (pendingRewrites.size === 0) return undefined;
      const messages = state.messages;
      if (!messages?.length) return undefined;

      let changed = false;
      const next = messages.map((message) => {
        if (!HumanMessage.isInstance(message)) return message;
        const key = messageKey(message);
        const rewritten = pendingRewrites.get(key);
        if (!rewritten) return message;
        pendingRewrites.delete(key);
        changed = true;
        return rewritten;
      });

      return changed ? { messages: next } : undefined;
    },
  });
}
