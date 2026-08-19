"use client";

import { ChartColumnIcon, FileTextIcon, PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";

import { useStream } from "@langchain/react";
import { ensureMessageInstances } from "@langchain/langgraph-sdk/ui";
import type { BaseMessage } from "langchain";
import type { FileUIPart } from "ai";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type AttachmentsContext,
  type PromptInputMessage,
} from "src/components/ai-elements/prompt-input";
import { Button } from "src/components/ui/button";
import { ChatThread } from "src/components/chat-thread";
import { EmptyState } from "src/components/empty-state";
import { SAMPLE_DATASET_FILENAME } from "src/lib/sample-dataset";
import { LANGGRAPH_API_URL, LANGGRAPH_ASSISTANT_ID } from "src/lib/stream";
import { useThreadIdParam } from "src/lib/thread-id";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_PROMPT =
  "Profile this dataset and chart the most interesting trend.";

/** Keep in sync with middleware/stage-chat-uploads.ts allowlists. */
const UPLOAD_ACCEPT = [
  "text/*",
  "application/json",
  ".csv",
  ".tsv",
  ".txt",
  ".json",
  ".jsonl",
  ".md",
].join(",");

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "file";
      mime_type: string;
      source_type: "base64";
      data: string;
      metadata: { filename: string };
    };

function dataUrlToBase64(url: string): string | null {
  const match = /^data:[^;]+;base64,([\s\S]+)$/i.exec(url);
  return match?.[1] ?? null;
}

function buildHumanContent(text: string, files: FileUIPart[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const trimmed = text.trim();
  if (trimmed) {
    blocks.push({ type: "text", text: trimmed });
  } else if (files.length > 0) {
    blocks.push({ type: "text", text: DEFAULT_UPLOAD_PROMPT });
  }

  for (const file of files) {
    if (!file.url) continue;
    const data = dataUrlToBase64(file.url);
    if (!data) continue;
    const filename = file.filename || "upload.csv";
    blocks.push({
      type: "file",
      mime_type: file.mediaType || "text/csv",
      source_type: "base64",
      data,
      metadata: { filename },
    });
  }

  return blocks;
}

function AttachmentChipsHeader() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <PromptInputHeader className="px-3 pt-3 pb-1">
      <div className="flex w-full flex-wrap items-center gap-2">
        {attachments.files.map((file) => (
          <div
            key={file.id}
            className="flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/60 px-2.5 py-1.5 text-xs"
          >
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.filename || "attachment"}</span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={() => attachments.remove(file.id)}
              aria-label={`Remove ${file.filename || "attachment"}`}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </PromptInputHeader>
  );
}

function AttachFileButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      tooltip="Attach a CSV or other text dataset"
      onClick={() => attachments.openFileDialog()}
      aria-label="Attach dataset"
    >
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

function hasImageBlock(message: BaseMessage): boolean {
  if (!Array.isArray(message.content)) return false;
  return message.content.some(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "image"
  );
}

function ChatSession() {
  const [threadId, onThreadId] = useThreadIdParam();
  const [inputText, setInputText] = useState("");
  const [attachedNames, setAttachedNames] = useState<string[]>([]);
  const attachmentsRef = useRef<AttachmentsContext | null>(null);

  const stream = useStream({
    apiUrl: LANGGRAPH_API_URL,
    assistantId: LANGGRAPH_ASSISTANT_ID,
    onThreadId,
    threadId,
  });

  // Charts are attached after the model finishes generating. `useStream`
  // reconciles by message id and keeps the token-streamed copy (text only)
  // unless the values snapshot has richer tool-calls — so image blocks never
  // win during the run. Re-read thread state when the run ends; that is what a
  // page refresh was doing. Keyed by thread id, because a brand new thread only
  // learns its id mid-run and a stale snapshot must never render.
  const [refreshed, setRefreshed] = useState<{
    threadId: string;
    messages: BaseMessage[];
  } | null>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = stream.isLoading;
    if (stream.isLoading || !wasLoading) return;

    const runThreadId = stream.threadId;
    if (!runThreadId) return;

    let cancelled = false;
    void stream.client.threads
      .getState(runThreadId)
      .then((state) => {
        if (cancelled) return;
        const raw = (state?.values as { messages?: unknown } | undefined)
          ?.messages;
        if (!Array.isArray(raw)) return;
        setRefreshed({
          threadId: runThreadId,
          messages: ensureMessageInstances(raw) as BaseMessage[],
        });
      })
      .catch((error) => {
        console.warn("[data-analyst] failed to refresh thread state:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [stream.isLoading, stream.threadId, stream.client]);

  // Overlay only the chart-bearing replies onto the live projection. Swapping
  // the whole snapshot in would drop the images again the moment the next run
  // starts streaming its own (text-only) copies of those same replies.
  const messages = useMemo(() => {
    if (refreshed?.threadId !== stream.threadId) return stream.messages;

    const withCharts = new Map<string, BaseMessage>();
    for (const message of refreshed.messages) {
      if (message.id && hasImageBlock(message)) withCharts.set(message.id, message);
    }
    if (withCharts.size === 0) return stream.messages;

    return stream.messages.map((message) => {
      if (!message.id || hasImageBlock(message)) return message;
      return withCharts.get(message.id) ?? message;
    });
  }, [refreshed, stream.messages, stream.threadId]);

  const hasMessages = messages.length > 0;
  const chatStatus = stream.isLoading ? "streaming" : "ready";
  const sampleAttached = attachedNames.includes(SAMPLE_DATASET_FILENAME);

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const blocks = buildHumanContent(message.text, message.files);
      if (blocks.length === 0) return;
      setInputText("");
      stream.submit({ messages: [{ type: "human", content: blocks }] });
    },
    [stream]
  );

  const handleStop = useCallback(() => {
    void stream.stop().catch((error) => {
      console.warn("[data-analyst] failed to cancel run:", error);
    });
  }, [stream]);

  const handleNewChat = useCallback(() => {
    onThreadId(undefined);
    setInputText("");
  }, [onThreadId]);

  const handleAttachSample = useCallback((file: File) => {
    attachmentsRef.current?.add([file]);
  }, []);

  const handleAttachmentError = useCallback((err: { message: string }) => {
    console.warn("[data-analyst] attachment error:", err.message);
  }, []);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ChartColumnIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Data Analyst</span>
        </div>
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="shrink-0 gap-1.5 px-2 sm:px-3"
            title="New chat"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {hasMessages ? (
          <ChatThread messages={messages} isLoading={stream.isLoading} />
        ) : (
          <EmptyState
            onAttachSample={handleAttachSample}
            sampleAttached={sampleAttached}
            onSelectPrompt={setInputText}
          />
        )}

        <div className="shrink-0 border-t">
          <div className="mx-auto w-full max-w-2xl px-3 pb-5 pt-4 sm:px-4">
            <PromptInput
              accept={UPLOAD_ACCEPT}
              multiple
              globalDrop
              maxFiles={2}
              maxFileSize={MAX_UPLOAD_BYTES}
              onSubmit={handleSubmit}
              onError={handleAttachmentError}
              className="w-full rounded-xl has-[[data-slot=input-group-control]:focus-visible]:ring-0"
            >
              <AttachmentChipsHeader />
              <PromptInputBody>
                <PromptInputTextarea
                  value={inputText}
                  placeholder="Ask about revenue, top products, cancellations… or drop a CSV"
                  className="min-h-16 px-3 py-3 leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setInputText(e.target.value)
                  }
                />
              </PromptInputBody>
              <PromptInputFooter className="border-0 px-3 pb-3 pt-1">
                <div />
                <PromptInputTools className="ml-auto gap-1.5">
                  <AttachFileButton />
                  <PromptInputSubmit
                    status={chatStatus}
                    onStop={handleStop}
                    disabled={
                      !inputText.trim() &&
                      attachedNames.length === 0 &&
                      !stream.isLoading
                    }
                  />
                </PromptInputTools>
              </PromptInputFooter>
              <AttachmentsBridge
                apiRef={attachmentsRef}
                onNamesChange={setAttachedNames}
              />
            </PromptInput>
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * Lifts the attachment API out of `PromptInput` so the empty state — which
 * renders outside the composer — can attach the sample dataset.
 *
 * The context object is handed back through a ref rather than state: its
 * identity changes on every composer render, so storing it in state would
 * re-render this subtree and rebuild the context again without end. Only the
 * filenames, which the parent actually renders, are mirrored into state, and
 * only when they change.
 */
function AttachmentsBridge({
  apiRef,
  onNamesChange,
}: {
  apiRef: RefObject<AttachmentsContext | null>;
  onNamesChange: (names: string[]) => void;
}) {
  const attachments = usePromptInputAttachments();
  const namesKey = attachments.files.map((file) => file.filename ?? "").join("\n");

  useEffect(() => {
    apiRef.current = attachments;
  });

  useEffect(() => {
    onNamesChange(namesKey === "" ? [] : namesKey.split("\n"));
  }, [namesKey, onNamesChange]);

  return null;
}

interface ChatAppProps {
  backendStatus: "checking" | "online" | "offline";
  apiUrl: string;
}

export function ChatApp({ backendStatus, apiUrl }: ChatAppProps) {
  if (backendStatus === "offline") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <ChartColumnIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Data Analyst</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium">Agent offline</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cannot reach <span className="font-mono break-all">{apiUrl}</span>. Run{" "}
            <span className="font-mono">npm run dev</span> from{" "}
            <span className="font-mono">data-analyst/</span> so the agent and UI
            start together.
          </p>
        </div>
      </div>
    );
  }

  if (backendStatus === "checking") {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Connecting to agent…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ChatSession />
    </div>
  );
}
