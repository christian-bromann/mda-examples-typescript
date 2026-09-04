"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  LinkIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "src/components/ui/button";
import { ProviderLogo } from "src/components/provider-logo";
import { useOAuthSessionStatus } from "src/hooks/use-oauth-session-status";
import {
  resolveCredentialDisplayName,
  resolveCredentialProviderId,
} from "src/lib/resolve-credential-provider";

export type PendingCredential = {
  slug: string;
  kind: "oauth2" | "secret";
  connect_url?: string;
  auth_id?: string;
};

export type CredentialAuthorizationRequired = {
  type: "credential_authorization_required";
  message?: string;
  credentials: PendingCredential[];
};

export type CredentialAuthorizationCompletedResume = {
  type: "credential_authorization_completed";
  connected_slugs: string[];
};

/**
 * Normalize `useStream().interrupt` into a credential-authorization payload.
 * Handles bare payloads, `{ value: … }` wrappers, and the legacy
 * `mcp_user_auth_required` shape.
 */
export function parseCredentialInterrupt(
  interrupt: unknown
): CredentialAuthorizationRequired | null {
  if (!interrupt || typeof interrupt !== "object") return null;

  const root = interrupt as Record<string, unknown>;
  const candidate =
    root.type === "credential_authorization_required" ||
    root.type === "mcp_user_auth_required"
      ? root
      : root.value !== undefined && typeof root.value === "object"
        ? (root.value as Record<string, unknown>)
        : null;

  if (!candidate) return null;

  const list =
    candidate.type === "credential_authorization_required"
      ? candidate.credentials
      : candidate.type === "mcp_user_auth_required"
        ? candidate.servers
        : null;
  if (!Array.isArray(list) || list.length === 0) return null;

  return {
    type: "credential_authorization_required",
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
    credentials: list.map((row) => {
      const entry = row as Record<string, unknown>;
      return {
        slug: String(entry.slug ?? ""),
        kind: entry.kind === "secret" ? "secret" : "oauth2",
        ...(typeof entry.connect_url === "string"
          ? { connect_url: entry.connect_url }
          : {}),
        ...(typeof entry.auth_id === "string"
          ? { auth_id: entry.auth_id }
          : {}),
      };
    }),
  };
}

export function buildCredentialAuthorizationCompletedResume(
  credentials: PendingCredential[]
): CredentialAuthorizationCompletedResume {
  return {
    type: "credential_authorization_completed",
    connected_slugs: credentials.map((credential) => credential.slug),
  };
}

function parseAuthorizationURL(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

/** Interrupts this tab has already resumed (guards remount double-resume). */
const resumedInterrupts = new Set<string>();
const resumingInterrupts = new Set<string>();
const failedResumeInterrupts = new Set<string>();

function resumeKey(
  interruptId: string | undefined,
  credentials: PendingCredential[]
): string {
  return (
    interruptId ??
    credentials.map((credential) => credential.auth_id ?? credential.slug).join("|")
  );
}

function CredentialConnectRow({
  credential,
  completed,
  onCompleted,
}: {
  credential: PendingCredential;
  completed: boolean;
  onCompleted: (slug: string) => void;
}) {
  const { status, isLoading, error, retry } = useOAuthSessionStatus({
    authId: credential.auth_id,
    enabled: Boolean(credential.auth_id) && !completed,
    onCompleted: () => onCompleted(credential.slug),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const authorizationURL = credential.connect_url
    ? parseAuthorizationURL(credential.connect_url)
    : undefined;

  const done = completed || status === "completed";
  const terminal = status === "failed" || status === "expired";
  const providerId = resolveCredentialProviderId(credential);
  const displayName = resolveCredentialDisplayName(credential);

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border bg-background px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <ProviderLogo providerId={providerId} className="size-6" />
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-medium leading-snug">
              {displayName}
            </p>
            <p className="truncate font-mono text-xs leading-snug text-muted-foreground">
              {credential.slug}
            </p>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            {done
              ? "Connected"
              : terminal
                ? "This request ended. Run the agent again for a new connection link."
                : error
                  ? error
                  : isLoading
                    ? "Waiting for OAuth…"
                    : credential.kind === "oauth2"
                      ? "Not connected"
                      : "Configure this secret in Agent Auth"}
          </p>
        </div>
      </div>

      {done ? (
        <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" aria-label="Connected" />
      ) : terminal ? null : error ? (
        <Button size="sm" variant="secondary" onClick={retry}>
          Retry status
        </Button>
      ) : authorizationURL ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setConfirmOpen(true)}
          >
            <ExternalLinkIcon className="size-4" />
            Connect
          </Button>
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`connect-confirm-${credential.slug}`}
                className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-lg"
              >
                <p
                  id={`connect-confirm-${credential.slug}`}
                  className="text-sm font-semibold"
                >
                  Continue to external authorization
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Continue only if you trust{" "}
                  <span className="font-semibold text-foreground">
                    {authorizationURL.hostname}
                  </span>
                  . That site will handle your authorization.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      window.open(
                        authorizationURL.toString(),
                        "_blank",
                        "noopener"
                      );
                      setConfirmOpen(false);
                    }}
                  >
                    <ExternalLinkIcon className="size-4" />
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      )}
    </li>
  );
}

type CredentialConnectCardProps = {
  payload: CredentialAuthorizationRequired;
  interruptId?: string;
  onResume: (
    resume: CredentialAuthorizationCompletedResume
  ) => Promise<void>;
};

/**
 * Studio-style Connect card: long-poll each OAuth session, show pending /
 * checkmark state, and auto-resume once every credential is connected.
 * There is no free-form Continue — grants must complete first.
 */
export function CredentialConnectCard({
  payload,
  interruptId,
  onResume,
}: CredentialConnectCardProps) {
  const key = resumeKey(interruptId, payload.credentials);
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(
    () => new Set()
  );
  const [resumed, setResumed] = useState(() => resumedInterrupts.has(key));
  const [resumeError, setResumeError] = useState(() =>
    failedResumeInterrupts.has(key)
  );
  const [resumeAttempt, setResumeAttempt] = useState(0);

  const oauthCredentials = useMemo(
    () =>
      payload.credentials.filter(
        (credential) => credential.kind === "oauth2" && credential.auth_id
      ),
    [payload.credentials]
  );

  const allComplete =
    oauthCredentials.length > 0 &&
    oauthCredentials.every((credential) =>
      completedSlugs.has(credential.slug)
    );

  const markCompleted = useCallback((slug: string) => {
    setCompletedSlugs((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  }, []);

  const onResumeRef = useRef(onResume);
  useEffect(() => {
    onResumeRef.current = onResume;
  }, [onResume]);

  useEffect(() => {
    if (
      !allComplete ||
      resumeError ||
      resumedInterrupts.has(key) ||
      resumingInterrupts.has(key)
    ) {
      return;
    }

    let active = true;
    resumingInterrupts.add(key);
    setResumeError(false);

    void (async () => {
      try {
        await onResumeRef.current(
          buildCredentialAuthorizationCompletedResume(oauthCredentials)
        );
        resumedInterrupts.add(key);
        failedResumeInterrupts.delete(key);
        if (active) setResumed(true);
      } catch {
        failedResumeInterrupts.add(key);
        if (active) setResumeError(true);
        resumingInterrupts.delete(key);
        return;
      }
      resumingInterrupts.delete(key);
    })();

    return () => {
      active = false;
    };
  }, [allComplete, key, oauthCredentials, resumeAttempt, resumeError]);

  if (resumed) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-3 sm:px-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-2.5">
          {!allComplete ? (
            <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <LinkIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold leading-snug">
              Connect integrations
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {payload.message ??
                "Connect the following integrations to continue. The run resumes automatically once every connection succeeds."}
            </p>
          </div>
        </div>

        <ul className="space-y-3">
          {payload.credentials.map((credential) => (
            <CredentialConnectRow
              key={credential.auth_id ?? credential.slug}
              credential={credential}
              completed={completedSlugs.has(credential.slug)}
              onCompleted={markCompleted}
            />
          ))}
        </ul>

        {resumeError && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              The run could not continue. Try again.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                failedResumeInterrupts.delete(key);
                setResumeError(false);
                setResumeAttempt((attempt) => attempt + 1);
              }}
            >
              Retry continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
