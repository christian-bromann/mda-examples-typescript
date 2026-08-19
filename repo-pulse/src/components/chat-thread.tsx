"use client";

import { useMemo } from "react";
import type { BaseMessage } from "langchain";
import { AIMessage, HumanMessage } from "langchain";
import { BotIcon, DownloadIcon, FileTextIcon, UserIcon } from "lucide-react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
} from "src/components/ui/message-scroller";
import { Message, MessageAvatar, MessageBody, MessageHeader } from "src/components/ui/message";
import { Bubble } from "src/components/ui/bubble";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "src/components/ui/dialog";
import { Marker } from "src/components/ui/marker";
import { Response } from "src/components/response";
import { ToolActivity, type ToolStatus } from "src/components/tool-activity";

interface ChatThreadProps {
  messages: BaseMessage[];
  isLoading: boolean;
}

interface AssistantImage {
  src: string;
  filename: string;
  path?: string;
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
  const fromKwargs = message.additional_kwargs?.mda_staged_uploads;
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

function assistantImages(message: AIMessage): AssistantImage[] {
  if (!Array.isArray(message.content)) return [];

  const images: AssistantImage[] = [];
  for (const block of message.content) {
    if (!isRecord(block) || block.type !== "image") continue;
    const mimeType =
      (typeof block.mimeType === "string" && block.mimeType) ||
      (typeof block.mime_type === "string" && block.mime_type);
    if (mimeType !== "image/png" || typeof block.data !== "string") continue;

    const metadata = isRecord(block.metadata) ? block.metadata : undefined;
    const filename =
      (typeof metadata?.filename === "string" && metadata.filename) ||
      "analysis-chart.png";
    images.push({
      src: `data:image/png;base64,${block.data}`,
      filename,
      path: typeof metadata?.path === "string" ? metadata.path : undefined,
    });
  }
  return images;
}

function ChartFigure({ image }: { image: AssistantImage }) {
  return (
    <Dialog>
      <figure className="overflow-hidden rounded-xl border bg-muted/20">
        <DialogTrigger asChild>
          <button
            type="button"
            title={`Expand ${image.filename}`}
            className="block w-full cursor-zoom-in"
          >
            <img
              src={image.src}
              alt={image.filename}
              className="h-auto max-h-[38rem] w-full bg-white object-contain"
            />
          </button>
        </DialogTrigger>
        <figcaption className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">{image.filename}</span>
          <a
            href={image.src}
            download={image.filename}
            className="shrink-0 rounded p-1 transition-colors hover:text-foreground"
            title={`Download ${image.filename}`}
          >
            <DownloadIcon className="size-3.5" />
            <span className="sr-only">Download {image.filename}</span>
          </a>
        </figcaption>
      </figure>

      <DialogContent className="max-w-[min(96vw,80rem)] border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{image.filename}</DialogTitle>
        <img
          src={image.src}
          alt={image.filename}
          className="max-h-[88vh] w-full rounded-lg bg-white object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

export function ChatThread({ messages, isLoading }: ChatThreadProps) {
  const toolResultMap = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const msg of messages) {
      if (msg.type !== "tool") continue;
      const id = (msg as BaseMessage & { tool_call_id?: string }).tool_call_id;
      if (!id) continue;
      const raw = msg.text;
      try {
        map.set(id, JSON.parse(raw));
      } catch {
        map.set(id, raw);
      }
    }
    return map;
  }, [messages]);

  const rendered = useMemo(
    () =>
      messages.filter((msg) => {
        if (HumanMessage.isInstance(msg)) return true;
        if (AIMessage.isInstance(msg)) {
          if (msg.text.trim().length > 0) return true;
          if (assistantImages(msg).length > 0) return true;
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
          const images = AIMessage.isInstance(msg) ? assistantImages(msg) : [];
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

                {images.length > 0 && (
                  <div className="mt-4 grid w-full gap-4">
                    {images.map((image) => (
                      <ChartFigure
                        key={`${key}-${image.path ?? image.filename}`}
                        image={image}
                      />
                    ))}
                  </div>
                )}

                {toolCalls.map((tc) => {
                  const hasResult = toolResultMap.has(tc.id ?? "");
                  const status: ToolStatus =
                    hasResult || !(isLastRendered && isLoading) ? "finished" : "running";
                  return (
                    <ToolActivity
                      key={tc.id ?? tc.name}
                      name={tc.name}
                      args={tc.args}
                      output={toolResultMap.get(tc.id ?? "")}
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
      </MessageScrollerContent>
      <MessageScrollerButton />
    </MessageScroller>
  );
}
