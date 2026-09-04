"use client";

import {
  LogOutIcon,
  PenLineIcon,
  PlusIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import { useStream } from "@langchain/react";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "src/components/ai-elements/prompt-input";
import { Button } from "src/components/ui/button";
import { ChatThread } from "src/components/chat-thread";
import { EmptyState } from "src/components/empty-state";
import {
  TweetApprovalCard,
  parseHitlInterrupt,
} from "src/components/tweet-approval-card";
import {
  CredentialConnectCard,
  parseCredentialInterrupt,
} from "src/components/credential-connect-card";
import { LANGGRAPH_API_URL, LANGGRAPH_ASSISTANT_ID } from "src/lib/stream";
import { useThreadIdParam } from "src/lib/thread-id";
import { useAuthedFetch } from "src/lib/auth/fetch";

interface ChatSessionProps {
  userLabel?: string;
  authHeaders: Record<string, string>;
  onSignOut: () => void;
}

function ChatSession({ userLabel, authHeaders, onSignOut }: ChatSessionProps) {
  const [threadId, onThreadId] = useThreadIdParam();
  const [inputText, setInputText] = useState("");
  const authedFetch = useAuthedFetch(authHeaders);

  const stream = useStream({
    apiUrl: LANGGRAPH_API_URL,
    assistantId: LANGGRAPH_ASSISTANT_ID,
    onThreadId,
    threadId,
    defaultHeaders: authHeaders,
    fetch: authedFetch,
  });

  const hitl = useMemo(
    () => parseHitlInterrupt(stream.interrupt),
    [stream.interrupt]
  );
  const credentialAuth = useMemo(
    () => parseCredentialInterrupt(stream.interrupt),
    [stream.interrupt]
  );

  const hasMessages = stream.messages.length > 0;
  const chatStatus = stream.isLoading
    ? "streaming"
    : stream.error
      ? "error"
      : "ready";
  const awaitingInterrupt = hitl !== null || credentialAuth !== null;

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text) return;
      setInputText("");
      stream.submit({ messages: [{ type: "human", content: text }] });
    },
    [stream]
  );

  const handleNewChat = useCallback(() => {
    onThreadId(undefined);
    setInputText("");
  }, [onThreadId]);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <PenLineIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">Tweet Composer</span>
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
          <ChatThread
            messages={stream.messages}
            isLoading={stream.isLoading}
            error={stream.error}
          />
        ) : (
          <EmptyState />
        )}

        {credentialAuth && (
          <CredentialConnectCard
            payload={credentialAuth}
            interruptId={stream.interrupt?.id}
            onResume={async (resume) => {
              await stream.respond(resume, {
                interruptId: stream.interrupt?.id,
              });
            }}
          />
        )}

        {hitl && !credentialAuth && (
          <TweetApprovalCard
            hitl={hitl}
            disabled={stream.isLoading}
            onRespond={(resume) => {
              // @langchain/react resumes HITL via respond(), not submit()+command.
              void stream.respond(resume, {
                interruptId: stream.interrupt?.id,
              });
            }}
          />
        )}

        <div className="shrink-0 border-t">
          <div className="mx-auto w-full max-w-2xl px-3 pb-5 pt-4 sm:px-4">
            <PromptInput
              onSubmit={handleSubmit}
              className="w-full rounded-xl"
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={inputText}
                  placeholder={
                    credentialAuth
                      ? "Finish connecting integrations above — the run continues automatically…"
                      : awaitingInterrupt
                        ? "Approve, edit, or reject the tweet above…"
                        : "Paste a GitHub PR URL to draft a launch tweet…"
                  }
                  className="min-h-16 px-3 py-3 leading-relaxed"
                  disabled={awaitingInterrupt}
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
                    disabled={
                      awaitingInterrupt ||
                      (!inputText.trim() && !stream.isLoading)
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
            <PenLineIcon className="size-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Tweet Composer</span>
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
            <span className="font-mono">tweet-composer/</span>, or set{" "}
            <span className="font-mono">TWEET_COMPOSER_DEPLOYMENT_API</span> to your
            deployment.
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
