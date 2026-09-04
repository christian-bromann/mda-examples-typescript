"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";

import { Button } from "src/components/ui/button";

const TWEET_LIMIT = 280;

/** Common shapes used by X MCP `post_tweet` implementations. */
const TEXT_ARG_KEYS = ["text", "tweet", "content", "status", "message"] as const;

export type ActionRequest = {
  name: string;
  args: Record<string, unknown>;
  description?: string;
};

export type HITLRequest = {
  actionRequests: ActionRequest[];
  reviewConfigs?: Array<{
    actionName?: string;
    allowedDecisions?: Array<"approve" | "reject" | "edit" | "respond">;
  }>;
};

export type HITLDecision =
  | { type: "approve" }
  | { type: "reject"; message?: string }
  | {
      type: "edit";
      editedAction: { name: string; args: Record<string, unknown> };
    };

type TweetApprovalCardProps = {
  hitl: HITLRequest;
  disabled?: boolean;
  onRespond: (resume: { decisions: HITLDecision[] }) => void;
};

function extractTweetText(args: Record<string, unknown>): string {
  for (const key of TEXT_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string") return value;
  }
  // Fallback: first string field that looks like tweet body.
  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}

function textArgKey(args: Record<string, unknown>): string {
  for (const key of TEXT_ARG_KEYS) {
    if (key in args) return key;
  }
  return "text";
}

/**
 * Normalize `useStream().interrupt` into a HITLRequest.
 * Handles both the bare payload and `{ value: HITLRequest }` wrappers.
 */
export function parseHitlInterrupt(interrupt: unknown): HITLRequest | null {
  if (!interrupt || typeof interrupt !== "object") return null;

  const root = interrupt as Record<string, unknown>;
  const candidate =
    root.actionRequests !== undefined
      ? root
      : root.value !== undefined && typeof root.value === "object"
        ? (root.value as Record<string, unknown>)
        : null;

  if (!candidate) return null;
  const actions = candidate.actionRequests;
  if (!Array.isArray(actions) || actions.length === 0) return null;

  return {
    actionRequests: actions as ActionRequest[],
    reviewConfigs: Array.isArray(candidate.reviewConfigs)
      ? (candidate.reviewConfigs as HITLRequest["reviewConfigs"])
      : undefined,
  };
}

export function TweetApprovalCard({
  hitl,
  disabled,
  onRespond,
}: TweetApprovalCardProps) {
  const action = hitl.actionRequests[0];
  const initialText = useMemo(
    () => extractTweetText(action?.args ?? {}),
    [action]
  );
  const [draft, setDraft] = useState(initialText);
  const overLimit = draft.length > TWEET_LIMIT;
  const unchanged = draft === initialText;

  if (!action) return null;

  const approve = () => {
    onRespond({
      decisions: hitl.actionRequests.map(() => ({ type: "approve" })),
    });
  };

  const reject = () => {
    onRespond({
      decisions: hitl.actionRequests.map(() => ({
        type: "reject",
        message:
          "User rejected this tweet. Do not post it. Wait for new direction.",
      })),
    });
  };

  const editAndPost = () => {
    const key = textArgKey(action.args ?? {});
    onRespond({
      decisions: [
        {
          type: "edit",
          editedAction: {
            name: action.name,
            args: { ...action.args, [key]: draft },
          },
        },
        ...hitl.actionRequests.slice(1).map(() => ({ type: "approve" as const })),
      ],
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-2 sm:px-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Review tweet before posting</p>
            <p className="text-xs text-muted-foreground">
              Tool <span className="font-mono">{action.name}</span> is waiting
              for approval
            </p>
          </div>
        </div>

        {action.description ? (
          <p className="mb-3 whitespace-pre-wrap text-xs text-muted-foreground">
            {action.description}
          </p>
        ) : null}

        <label className="sr-only" htmlFor="tweet-draft">
          Tweet draft
        </label>
        <textarea
          id="tweet-draft"
          value={draft}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setDraft(e.target.value)
          }
          className="min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          spellCheck
        />

        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Edit the text, then Approve or Edit &amp; post</span>
          <span className={overLimit ? "text-destructive" : undefined}>
            {draft.length}/{TWEET_LIMIT}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={disabled || overLimit || !draft.trim()}
            onClick={unchanged ? approve : editAndPost}
          >
            {unchanged ? (
              <>
                <CheckIcon className="size-4" />
                Approve
              </>
            ) : (
              <>
                <PencilIcon className="size-4" />
                Edit &amp; post
              </>
            )}
          </Button>
          {!unchanged && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={disabled || overLimit || !initialText.trim()}
              onClick={approve}
              title="Post the original draft without your edits"
            >
              <CheckIcon className="size-4" />
              Approve original
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={disabled}
            onClick={reject}
          >
            <XIcon className="size-4" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
