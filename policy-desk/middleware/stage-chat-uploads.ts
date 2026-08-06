/**
 * Stage chat file attachments into the per-thread LangSmith sandbox.
 *
 * There is no separate upload HTTP endpoint. The browser attaches a file in the
 * chat UI (`src/components/chat-app.tsx`), encodes it as base64, and submits a
 * multimodal human message via `useStream` / LangGraph, e.g.:
 *
 * ```ts
 * {
 *   type: "human",
 *   content: [
 *     { type: "text", text: "Summarize this file" },
 *     {
 *       type: "file",
 *       mime_type: "text/plain",
 *       source_type: "base64",
 *       data: "<base64…>",
 *       metadata: { filename: "notes.txt" },
 *     },
 *   ],
 * }
 * ```
 *
 * This middleware runs before the model sees that message:
 *
 * 1. **`wrapModelCall`** — find allowed `file` blocks on the latest human
 *    message, invoke harness `write_file` to `/workspace/uploads/<safe-name>`.
 *    - **Text files** (`.txt`, `.md`, `.py`, …): decode base64 → UTF-8 and pass
 *      plain text (sandbox `write` treats text MIME as UTF-8).
 *    - **PDFs**: pass base64 as-is (sandbox `write` decodes base64 for
 *      `application/pdf`).
 * 2. Replace heavy file blocks with a short text note listing sandbox paths.
 * 3. **`afterModel`** — persist the rewritten human message into graph state
 *    (`additional_kwargs.mda_staged_uploads` holds the staged paths).
 *
 * Idempotency: in-process `stagedKeys` avoids re-uploading the same message
 * across model calls in one turn; `mda_staged_uploads` skips once state is
 * rewritten.
 *
 * After staging, `instructions.md` tells the agent how to read each kind of
 * file (direct `read_file` for text; `pypdf` extract for PDFs).
 *
 * Wire this in `agent.ts` via `middleware: [stageChatUploadsMiddleware()]`.
 */

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
 * Unknown extensions default to rejected unless MIME is clearly text/* or PDF.
 */
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".log",
  ".py",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".htm",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".rs",
  ".go",
  ".java",
  ".rb",
  ".php",
  ".env",
]);

type ContentBlock = Record<string, unknown>;

type UploadKind = "text" | "pdf";

interface StagedUpload {
  fileName: string;
  /** Payload for `write_file`: UTF-8 text or base64 PDF bytes. */
  writeContent: string;
  path: string;
  kind: UploadKind;
}

function isRecord(value: unknown): value is ContentBlock {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extOf(name: string | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isPdfMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return normalized === "application/pdf" || normalized.endsWith("/pdf");
}

function isTextMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized === "application/json" ||
    normalized === "application/javascript" ||
    normalized === "application/xml" ||
    normalized === "application/x-yaml" ||
    normalized === "application/toml"
  );
}

function classifyUpload(
  mime: string | undefined,
  fileName: string | undefined
): UploadKind | null {
  const ext = extOf(fileName);
  if (isPdfMime(mime) || ext === ".pdf") return "pdf";
  if (isTextMime(mime) || TEXT_EXTENSIONS.has(ext)) return "text";
  return null;
}

function safeFileName(raw: string, index: number, kind: UploadKind): string {
  const fallback = kind === "pdf" ? `upload-${index + 1}.pdf` : `upload-${index + 1}.txt`;
  const base = raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "");
  const name = base || fallback;
  if (kind === "pdf" && !name.toLowerCase().endsWith(".pdf")) {
    return `${name}.pdf`.slice(0, 120);
  }
  return name.slice(0, 120);
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
    const kind = classifyUpload(effectiveMime, fileNameCandidate);
    if (!kind) continue;

    const fileName = safeFileName(
      fileNameCandidate ?? (kind === "pdf" ? `upload-${index + 1}.pdf` : `upload-${index + 1}.txt`),
      index,
      kind
    );

    uploads.push({
      fileName,
      path: `${UPLOAD_DIR}/${fileName}`,
      kind,
      writeContent: kind === "text" ? decodeBase64Utf8(base64) : base64,
    });
    index += 1;
  }

  return uploads;
}

function stagingNote(uploads: StagedUpload[]): string {
  const lines = uploads.map((u) => {
    if (u.kind === "pdf") {
      return `- \`${u.path}\` (PDF — extract with pypdf via execute, then read the sibling .txt)`;
    }
    return `- \`${u.path}\` (text — read_file / grep directly)`;
  });
  const header =
    uploads.length === 1
      ? "Attached file staged in the sandbox:"
      : "Attached files staged in the sandbox:";
  return `${header}\n${lines.join("\n")}`;
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
  const staged = kwargs?.[STAGED_KWARG] ?? kwargs?.mda_staged_pdfs;
  return Array.isArray(staged) && staged.length > 0;
}

function findWriteFileTool(
  tools: Array<{ name?: string; invoke?: (input: unknown, config?: unknown) => unknown }>
) {
  return tools.find((t) => t.name === "write_file" && typeof t.invoke === "function");
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
      const writeFile = findWriteFileTool(
        request.tools as Array<{
          name?: string;
          invoke?: (input: unknown, config?: unknown) => unknown;
        }>
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
