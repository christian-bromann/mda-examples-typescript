"use client";

import { ActivityIcon, GitBranchIcon, PlusIcon, XIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useStream } from "@langchain/react";
import { ensureMessageInstances } from "@langchain/langgraph-sdk/ui";
import type { BaseMessage } from "langchain";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "src/components/ai-elements/prompt-input";
import { Button } from "src/components/ui/button";
import { ChatThread } from "src/components/chat-thread";
import { EmptyState } from "src/components/empty-state";
import { LANGGRAPH_API_URL, LANGGRAPH_ASSISTANT_ID } from "src/lib/stream";
import { useThreadIdParam } from "src/lib/thread-id";

const DEFAULT_PROMPT =
  "Give me a maintainer pulse: bus factor, recent PR latency, and weekly throughput.";

function buildMessageText(text: string, targetRepo: string | null): string {
  const trimmed = text.trim() || DEFAULT_PROMPT;
  if (!targetRepo) return trimmed;
  if (trimmed.toLowerCase().includes(targetRepo.toLowerCase())) return trimmed;
  return `Target repository: ${targetRepo}\n\n${trimmed}`;
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
  const [targetRepo, setTargetRepo] = useState<string | null>(null);

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
        console.warn("[repo-pulse] failed to refresh thread state:", error);
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

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = buildMessageText(message.text, targetRepo);
      if (!text.trim()) return;
      setInputText("");
      stream.submit({ messages: [{ type: "human", content: text }] });
    },
    [stream, targetRepo]
  );

  const handleStop = useCallback(() => {
    void stream.stop().catch((error) => {
      console.warn("[repo-pulse] failed to cancel run:", error);
    });
  }, [stream]);

  const handleNewChat = useCallback(() => {
    onThreadId(undefined);
    setInputText("");
    setTargetRepo(null);
  }, [onThreadId]);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ActivityIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Repo Pulse</span>
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
            targetRepo={targetRepo}
            onSelectRepo={setTargetRepo}
            onSelectPrompt={setInputText}
          />
        )}

        <div className="shrink-0 border-t">
          <div className="mx-auto w-full max-w-2xl px-3 pb-5 pt-4 sm:px-4">
            <PromptInput
              onSubmit={handleSubmit}
              className="w-full rounded-xl has-[[data-slot=input-group-control]:focus-visible]:ring-0"
            >
              {targetRepo ? (
                <PromptInputHeader className="px-3 pt-3 pb-1">
                  <div className="flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/60 px-2.5 py-1.5 text-xs">
                    <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono">{targetRepo}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => setTargetRepo(null)}
                      aria-label="Clear target repository"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                </PromptInputHeader>
              ) : null}
              <PromptInputBody>
                <PromptInputTextarea
                  value={inputText}
                  placeholder={
                    targetRepo
                      ? "Ask about contributors, review latency, throughput…"
                      : "Pick a repo above, then ask a maintainer question"
                  }
                  className="min-h-16 px-3 py-3 leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setInputText(e.target.value)
                  }
                />
              </PromptInputBody>
              <PromptInputFooter className="border-0 px-3 pb-3 pt-1">
                <div />
                <PromptInputTools className="ml-auto gap-1.5">
                  <PromptInputSubmit
                    status={chatStatus}
                    onStop={handleStop}
                    disabled={
                      !stream.isLoading && !inputText.trim() && !targetRepo
                    }
                  />
                </PromptInputTools>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>
    </>
  );
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
          <ActivityIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Repo Pulse</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium">Agent offline</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cannot reach <span className="font-mono break-all">{apiUrl}</span>. Run{" "}
            <span className="font-mono">npm run dev</span> from{" "}
            <span className="font-mono">repo-pulse/</span> so the agent and UI
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
