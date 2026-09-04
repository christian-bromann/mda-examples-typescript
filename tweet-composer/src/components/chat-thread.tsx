"use client";

import { useMemo } from "react";
import type { BaseMessage } from "langchain";
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import { AlertCircleIcon, BotIcon, FileTextIcon, UserIcon } from "lucide-react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
} from "src/components/ui/message-scroller";
import { Message, MessageAvatar, MessageBody, MessageHeader } from "src/components/ui/message";
import { Bubble } from "src/components/ui/bubble";
import { Marker } from "src/components/ui/marker";
import { Response } from "src/components/response";
import { ToolActivity, type ToolStatus } from "src/components/tool-activity";
import {
  formatStreamError,
  toolOutputLooksLikeError,
} from "src/lib/stream-error";

interface ChatThreadProps {
  messages: BaseMessage[];
  isLoading: boolean;
  /** `useStream().error` from a failed lifecycle event. */
  error?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanText(message: HumanMessage): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return message.text ?? "";
  return message.content
    .filter((block) => isRecord(block) && block.type === "text" && typeof block.text === "string")
    .map((block) => (block as { text: string }).text)
    .join("\n")
    .trim();
}

function humanFileLabels(message: HumanMessage): string[] {
  const fromKwargs =
    message.additional_kwargs?.mda_staged_uploads ??
    message.additional_kwargs?.mda_staged_pdfs;
  if (Array.isArray(fromKwargs)) {
    return fromKwargs
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.split("/").pop() || p);
  }

  if (!Array.isArray(message.content)) return [];
  const names: string[] = [];
  for (const block of message.content) {
    if (!isRecord(block) || block.type !== "file") continue;
    const meta = isRecord(block.metadata) ? block.metadata : undefined;
    const name =
      (typeof block.name === "string" && block.name) ||
      (typeof block.filename === "string" && block.filename) ||
      (typeof meta?.filename === "string" && meta.filename) ||
      "attachment";
    names.push(name);
  }
  return names;
}

export function ChatThread({ messages, isLoading, error }: ChatThreadProps) {
  const runError = useMemo(() => formatStreamError(error), [error]);
  const runFailed = Boolean(runError) && !isLoading;

  const toolResultMap = useMemo(() => {
    const map = new Map<string, { output: unknown; status: ToolStatus }>();
    for (const msg of messages) {
      if (!ToolMessage.isInstance(msg) && msg.type !== "tool") continue;
      const id = (msg as BaseMessage & { tool_call_id?: string }).tool_call_id;
      if (!id) continue;
      const raw = msg.text;
      let output: unknown = raw;
      try {
        output = JSON.parse(raw);
      } catch {
        // keep string
      }
      const status: ToolStatus =
        (ToolMessage.isInstance(msg) && msg.status === "error") ||
        toolOutputLooksLikeError(output) ||
        toolOutputLooksLikeError(raw)
          ? "error"
          : "finished";
      map.set(id, { output, status });
    }
    return map;
  }, [messages]);

  const rendered = useMemo(
    () =>
      messages.filter((msg) => {
        if (HumanMessage.isInstance(msg)) return true;
        if (AIMessage.isInstance(msg)) {
          if (msg.text.trim().length > 0) return true;
          return !!msg.tool_calls && msg.tool_calls.length > 0;
        }
        return false;
      }),
    [messages]
  );

  const lastMsg = rendered.at(-1);
  const waitingForFirstReply =
    isLoading && (!lastMsg || HumanMessage.isInstance(lastMsg));

  return (
    <MessageScroller className="scroll-fade">
      <MessageScrollerContent>
        {rendered.map((msg, i) => {
          const key = msg.id ?? `msg-${i}`;

          if (HumanMessage.isInstance(msg)) {
            const text = humanText(msg);
            const files = humanFileLabels(msg);
            return (
              <Message key={key} from="user">
                <MessageAvatar className="bg-primary text-primary-foreground">
                  <UserIcon className="size-4" />
                </MessageAvatar>
                <MessageBody>
                  <Bubble variant="primary" align="end">
                    <div className="space-y-2">
                      {files.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {files.map((name) => (
                            <div
                              key={name}
                              className="flex items-center gap-1.5 text-xs opacity-90"
                            >
                              <FileTextIcon className="size-3.5 shrink-0" />
                              <span className="truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {text ? <div className="whitespace-pre-wrap">{text}</div> : null}
                    </div>
                  </Bubble>
                </MessageBody>
              </Message>
            );
          }

          const toolCalls = AIMessage.isInstance(msg) ? (msg.tool_calls ?? []) : [];
          const isLastRendered = i === rendered.length - 1;

          return (
            <Message key={key} from="assistant">
              <MessageAvatar>
                <BotIcon className="size-4" />
              </MessageAvatar>
              <MessageBody>
                <MessageHeader>Assistant</MessageHeader>
                {msg.text.trim().length > 0 && (
                  <Bubble variant="default" align="start">
                    <Response>{msg.text}</Response>
                  </Bubble>
                )}

                {toolCalls.map((tc) => {
                  const result = toolResultMap.get(tc.id ?? "");
                  let status: ToolStatus;
                  if (result) {
                    status = result.status;
                  } else if (isLastRendered && isLoading) {
                    status = "running";
                  } else if (isLastRendered && runFailed) {
                    status = "error";
                  } else {
                    status = "finished";
                  }
                  return (
                    <ToolActivity
                      key={tc.id ?? tc.name}
                      name={tc.name}
                      args={tc.args}
                      output={result?.output}
                      status={status}
                    />
                  );
                })}
              </MessageBody>
            </Message>
          );
        })}

        {waitingForFirstReply && (
          <Marker variant="status" shimmer icon={<BotIcon className="size-3.5" />}>
            Thinking…
          </Marker>
        )}

        {runError && (
          <div
            role="alert"
            className="mx-auto w-full max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium leading-snug">Run failed</p>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-destructive/90">
                  {runError}
                </p>
              </div>
            </div>
          </div>
        )}
      </MessageScrollerContent>
      <MessageScrollerButton />
    </MessageScroller>
  );
}
