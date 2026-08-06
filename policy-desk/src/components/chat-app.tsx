"use client";

import {
  BookOpenIcon,
  FileTextIcon,
  LogOutIcon,
  PaperclipIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import { useStream } from "@langchain/react";
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
  type PromptInputMessage,
} from "src/components/ai-elements/prompt-input";
import { Button } from "src/components/ui/button";
import { ChatThread } from "src/components/chat-thread";
import { EmptyState } from "src/components/empty-state";
import { LANGGRAPH_API_URL, LANGGRAPH_ASSISTANT_ID } from "src/lib/stream";
import { useThreadIdParam } from "src/lib/thread-id";
import { useAuthedFetch } from "src/lib/auth/fetch";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_UPLOAD_PROMPT =
  "Summarize this policy and highlight what employees should know.";

/** Keep in sync with middleware/stage-chat-uploads.ts allowlists. */
const UPLOAD_ACCEPT = [
  "application/pdf",
  "text/*",
  "application/json",
  "application/javascript",
  "application/xml",
  ".pdf",
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
  ".log",
  ".env",
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
    const filename = file.filename || "upload.txt";
    const mime =
      file.mediaType ||
      (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain");
    blocks.push({
      type: "file",
      mime_type: mime,
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
      <div className="flex w-full flex-wrap gap-2">
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
      tooltip="Attach policy or handbook (PDF or text)"
      onClick={() => attachments.openFileDialog()}
      aria-label="Attach policy file"
    >
      <PaperclipIcon className="size-4" />
    </PromptInputButton>
  );
}

interface ChatSessionProps {
  userLabel?: string;
  authHeaders: Record<string, string>;
  onSignOut: () => void;
}

function ChatSession({ userLabel, authHeaders, onSignOut }: ChatSessionProps) {
  const [threadId, onThreadId] = useThreadIdParam();
  const [inputText, setInputText] = useState("");
  const [hasAttachments, setHasAttachments] = useState(false);
  const authedFetch = useAuthedFetch(authHeaders);

  const stream = useStream({
    apiUrl: LANGGRAPH_API_URL,
    assistantId: LANGGRAPH_ASSISTANT_ID,
    onThreadId,
    threadId,
    defaultHeaders: authHeaders,
    fetch: authedFetch,
  });

  const hasMessages = stream.messages.length > 0;
  const chatStatus = stream.isLoading ? "streaming" : "ready";

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const blocks = buildHumanContent(message.text, message.files);
      if (blocks.length === 0) return;
      setInputText("");
      setHasAttachments(false);
      stream.submit({ messages: [{ type: "human", content: blocks }] });
    },
    [stream]
  );

  const handleNewChat = useCallback(() => {
    onThreadId(undefined);
    setInputText("");
    setHasAttachments(false);
  }, [onThreadId]);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpenIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Policy Desk</span>
          {userLabel && (
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {userLabel}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="gap-1.5 px-2 sm:px-3"
              title="New chat"
            >
              <PlusIcon className="size-4" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="gap-1.5 px-2 sm:px-3"
            title="Sign out"
          >
            <LogOutIcon className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {hasMessages ? (
          <ChatThread messages={stream.messages} isLoading={stream.isLoading} />
        ) : (
          <EmptyState />
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
              onError={(err) => {
                console.warn("[policy-desk] attachment error:", err.message);
              }}
              className="w-full rounded-xl"
            >
              <AttachmentChipsHeader />
              <PromptInputBody>
                <PromptInputTextarea
                  value={inputText}
                  placeholder="Ask about PTO, expenses, remote work… or attach a policy"
                  className="min-h-16 px-3 py-3 leading-relaxed"
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
                    disabled={!inputText.trim() && !hasAttachments && !stream.isLoading}
                  />
                </PromptInputTools>
              </PromptInputFooter>
              <AttachmentPresenceSync onChange={setHasAttachments} />
            </PromptInput>
          </div>
        </div>
      </main>
    </>
  );
}

/** Keeps submit enabled when files are attached (chips live inside PromptInput). */
function AttachmentPresenceSync({
  onChange,
}: {
  onChange: (hasFiles: boolean) => void;
}) {
  const attachments = usePromptInputAttachments();
  const hasFiles = attachments.files.length > 0;
  useEffect(() => {
    onChange(hasFiles);
  }, [hasFiles, onChange]);
  return null;
}

interface ChatAppProps {
  userLabel?: string;
  authHeaders: Record<string, string> | null;
  backendStatus: "checking" | "online" | "offline";
  apiUrl: string;
  onSignOut: () => void;
}

export function ChatApp({
  userLabel,
  authHeaders,
  backendStatus,
  apiUrl,
  onSignOut,
}: ChatAppProps) {
  if (backendStatus === "offline") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpenIcon className="size-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Policy Desk</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="gap-1.5 px-2 sm:px-3"
            title="Sign out"
          >
            <LogOutIcon className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium">Agent offline</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Cannot reach <span className="font-mono break-all">{apiUrl}</span>. In a
            separate terminal, run{" "}
            <span className="font-mono">npm run dev</span> from{" "}
            <span className="font-mono">policy-desk/</span>, or set{" "}
            <span className="font-mono">VITE_LANGGRAPH_API_URL</span> to your deployment.
          </p>
        </div>
      </div>
    );
  }

  if (backendStatus === "checking" || !authHeaders) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        {backendStatus === "checking"
          ? "Connecting to agent…"
          : "Preparing session…"}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ChatSession
        userLabel={userLabel}
        authHeaders={authHeaders}
        onSignOut={onSignOut}
      />
    </div>
  );
}
