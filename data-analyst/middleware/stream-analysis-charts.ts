/**
 * Attach newly generated sandbox PNGs to the final assistant message.
 *
 * Deep Agents' `read_file` tool returns binary images as standard LangChain
 * image content blocks. This middleware uses that runtime-owned tool after the
 * model has produced its final (non-tool-calling) response, so PNG bytes travel
 * through LangGraph state to the browser without entering model context.
 */
import { createHash } from "node:crypto";

import {
  AIMessage,
  ToolMessage,
  createMiddleware,
  type BaseMessage,
} from "langchain";

const OUTPUT_DIR = "/workspace/out";
const CHARTS_KWARG = "mda_rendered_charts";
const MAX_CHARTS_PER_RESPONSE = 4;
const MAX_CHART_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_CHART_BYTES = 8 * 1024 * 1024;

interface InvokableTool {
  name?: string;
  invoke?: (input: unknown, config?: unknown) => Promise<unknown> | unknown;
}

interface ImageBlock {
  [key: string]: unknown;
  type: "image";
  mimeType: "image/png";
  data: string;
  metadata: {
    filename: string;
    path: string;
  };
}

interface ChartFingerprint {
  path: string;
  sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Trace chart delivery in the `mda dev` / deployment log.
 *
 * A chart can go missing for reasons that are invisible from the transcript —
 * the model never ran `savefig`, or the tool returned an unexpected shape — so
 * every exit path here says which one happened.
 */
function log(message: string): void {
  console.log(`[streamAnalysisCharts] ${message}`);
}

function describe(value: unknown): string {
  const text = toolText(value);
  const rendered = text || JSON.stringify(value);
  return rendered.length > 300 ? `${rendered.slice(0, 300)}…` : rendered;
}

function toolText(result: unknown): string {
  if (typeof result === "string") return result;
  if (isRecord(result)) {
    if (typeof result.text === "string") return result.text;
    if (typeof result.content === "string") return result.content;
  }
  return "";
}

/**
 * Normalize one glob output line to an absolute `/workspace/out/*.png` path.
 *
 * The LangSmith sandbox `glob` returns paths relative to the search base (e.g.
 * `chart.png`), while other backends may return absolute paths. Anything that
 * does not resolve under {@link OUTPUT_DIR} is dropped so a chart cannot point
 * outside the charts directory.
 */
function normalizePngPath(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.toLowerCase().endsWith(".png")) return null;
  if (trimmed.includes("..")) return null;

  if (trimmed.startsWith(`${OUTPUT_DIR}/`)) return trimmed;
  // Reject absolute paths under a different directory.
  if (trimmed.startsWith("/")) return null;
  // Relative to the glob base (OUTPUT_DIR).
  return `${OUTPUT_DIR}/${trimmed}`;
}

function pngPaths(result: unknown): string[] {
  const paths = new Set<string>();
  for (const line of toolText(result).split("\n")) {
    const path = normalizePngPath(line);
    if (path) paths.add(path);
  }
  return [...paths].sort();
}

function imageBlock(result: unknown, path: string): ImageBlock | null {
  const content =
    isRecord(result) && Array.isArray(result.content) ? result.content : result;
  if (!Array.isArray(content)) return null;

  const block = content.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.type === "image" &&
      candidate.mimeType === "image/png" &&
      typeof candidate.data === "string"
  );
  if (!isRecord(block) || typeof block.data !== "string") return null;

  return {
    type: "image",
    mimeType: "image/png",
    data: block.data,
    metadata: {
      filename: path.split("/").pop() || "analysis-chart.png",
      path,
    },
  };
}

function priorFingerprints(messages: BaseMessage[]): Set<string> {
  const seen = new Set<string>();
  for (const message of messages) {
    const value = message.additional_kwargs?.[CHARTS_KWARG];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (
        isRecord(item) &&
        typeof item.path === "string" &&
        typeof item.sha256 === "string"
      ) {
        seen.add(`${item.path}:${item.sha256}`);
      }
    }
  }
  return seen;
}

function isImageBlock(value: unknown): boolean {
  return isRecord(value) && value.type === "image";
}

function isDeliveredChartBlock(value: unknown): boolean {
  if (!isImageBlock(value) || !isRecord(value)) return false;
  const metadata = isRecord(value.metadata) ? value.metadata : undefined;
  return (
    typeof metadata?.path === "string" &&
    metadata.path.startsWith(`${OUTPUT_DIR}/`)
  );
}

/** Stand-in text for a PNG the user can already see in chat. */
function imagePlaceholder(block: unknown): { type: "text"; text: string } {
  const metadata = isRecord(block) && isRecord(block.metadata) ? block.metadata : undefined;
  const path = typeof metadata?.path === "string" ? metadata.path : "the chart";
  return {
    type: "text",
    text: `[PNG omitted from context — ${path} is already displayed to the user.]`,
  };
}

/**
 * Strip PNG bytes from the messages handed to the model.
 *
 * Charts stay in graph state so the browser can render them, but they must not
 * re-enter model context. Beyond wasting tokens, OpenAI rejects an `image`
 * block inside a tool result outright ("Invalid value: 'image'"), which is what
 * happens when the model calls `read_file` on a chart itself. Human messages
 * are left untouched so genuine image uploads still work.
 */
function withoutImageBlocks(messages: BaseMessage[]): BaseMessage[] {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;

    if (ToolMessage.isInstance(message)) {
      if (!message.content.some(isImageBlock)) return message;
      return new ToolMessage({
        id: message.id,
        name: message.name,
        tool_call_id: message.tool_call_id,
        status: message.status,
        artifact: message.artifact,
        content: message.content.map((block) =>
          isImageBlock(block) ? imagePlaceholder(block) : block
        ),
        additional_kwargs: message.additional_kwargs,
        response_metadata: message.response_metadata,
      });
    }

    if (AIMessage.isInstance(message)) {
      const content = message.content.filter(
        (block) => !isDeliveredChartBlock(block)
      );
      if (content.length === message.content.length) return message;

      return new AIMessage({
        id: message.id,
        name: message.name,
        content,
        additional_kwargs: message.additional_kwargs,
        response_metadata: message.response_metadata,
        tool_calls: message.tool_calls,
        invalid_tool_calls: message.invalid_tool_calls,
        usage_metadata: message.usage_metadata,
      });
    }

    return message;
  });
}

function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

function appendImages(
  response: AIMessage,
  images: ImageBlock[],
  fingerprints: ChartFingerprint[]
): AIMessage {
  const textBlock =
    typeof response.content === "string"
      ? response.content
        ? [{ type: "text" as const, text: response.content }]
        : []
      : response.content;

  response.content = [...textBlock, ...images];
  response.additional_kwargs = {
    ...response.additional_kwargs,
    [CHARTS_KWARG]: fingerprints,
  };
  return response;
}

/**
 * Surface up to four new or changed PNGs from `/workspace/out/` in chat.
 *
 * The PNG bytes are added after the model finishes generating, so they are not
 * part of the token stream the browser reconstructs the reply from. The chat UI
 * has to re-read thread state once the run ends for a chart to appear without a
 * manual refresh — see the `onCompleted` + `client.threads.getState` path in
 * `src/components/chat-app.tsx`.
 */
export function streamAnalysisChartsMiddleware() {
  return createMiddleware({
    name: "streamAnalysisCharts",
    wrapModelCall: async (request, handler) => {
      const response = await handler({
        ...request,
        messages: withoutImageBlocks(request.messages),
      });
      if (response.tool_calls?.length) return response;

      const tools = request.tools as InvokableTool[];
      const glob = tools.find(
        (tool) => tool.name === "glob" && typeof tool.invoke === "function"
      );
      const readFile = tools.find(
        (tool) => tool.name === "read_file" && typeof tool.invoke === "function"
      );
      if (!glob?.invoke || !readFile?.invoke) {
        log(
          `filesystem tools unavailable (saw: ${tools
            .map((tool) => tool.name ?? "?")
            .join(", ")})`
        );
        return response;
      }

      let paths: string[];
      try {
        const result = await glob.invoke(
          { pattern: "*.png", path: OUTPUT_DIR },
          request.runtime
        );
        paths = pngPaths(result);
        log(`glob ${OUTPUT_DIR}/*.png -> ${describe(result)}`);
      } catch (error) {
        log(`failed to list charts: ${String(error)}`);
        return response;
      }

      const seen = priorFingerprints(request.messages);
      const images: ImageBlock[] = [];
      const fingerprints: ChartFingerprint[] = [];
      let totalBytes = 0;

      for (const path of paths) {
        if (images.length >= MAX_CHARTS_PER_RESPONSE) break;
        try {
          const result = await readFile.invoke(
            { file_path: path, offset: 0, limit: 1 },
            request.runtime
          );
          const image = imageBlock(result, path);
          if (!image) {
            log(`read_file returned no PNG block for ${path}: ${describe(result)}`);
            continue;
          }

          const bytes = base64Bytes(image.data);
          if (
            bytes > MAX_CHART_BYTES ||
            totalBytes + bytes > MAX_TOTAL_CHART_BYTES
          ) {
            log(`skipping oversized chart ${path} (${bytes} bytes)`);
            continue;
          }

          const sha256 = createHash("sha256")
            .update(image.data, "base64")
            .digest("hex");
          if (seen.has(`${path}:${sha256}`)) {
            log(`skipping ${path}: already delivered in this thread`);
            continue;
          }

          images.push(image);
          fingerprints.push({ path, sha256 });
          totalBytes += bytes;
        } catch (error) {
          log(`failed to read ${path}: ${String(error)}`);
        }
      }

      log(`attached ${images.length} chart(s) of ${paths.length} found`);

      return images.length > 0
        ? appendImages(response, images, fingerprints)
        : response;
    },
  });
}
