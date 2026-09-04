"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isSessionStatus,
  oauthSessionStatusUrl,
  type CredentialAuthorizationSessionStatus,
} from "src/lib/agent-auth";

const AUTH_WAIT_SECONDS = 25;
const MAX_TRANSIENT_FAILURES = 3;
const RETRY_DELAY_MS = 1000;

interface AuthorizationSessionResponse {
  id?: string;
  status?: string;
}

interface UseOAuthSessionStatusParams {
  authId?: string;
  enabled?: boolean;
  onCompleted?: () => void;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Long-poll Agent Auth oauth-authorization-sessions until completed/failed.
 *
 * Mirrors Studio `useCredentialAuthorizationSessionStatus`, but hits the
 * same-origin `/api/agent-auth` proxy (Vite / Cloudflare Worker) instead of
 * calling api.smith.langchain.com with a browser-held workspace key.
 */
export function useOAuthSessionStatus({
  authId,
  enabled = true,
  onCompleted,
}: UseOAuthSessionStatusParams) {
  const [status, setStatus] =
    useState<CredentialAuthorizationSessionStatus>("pending");
  const [isLoading, setIsLoading] = useState(Boolean(authId && enabled));
  const [error, setError] = useState<string>();
  const [retryAttempt, setRetryAttempt] = useState(0);

  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  const retry = useCallback(() => {
    setRetryAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (!authId || !enabled) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setError(undefined);
    setStatus("pending");

    const poll = async () => {
      let transientFailures = 0;
      while (!controller.signal.aborted) {
        try {
          setIsLoading(true);
          const response = await fetch(
            oauthSessionStatusUrl(authId, AUTH_WAIT_SECONDS),
            {
              method: "GET",
              headers: { accept: "application/json" },
              signal: controller.signal,
            }
          );

          if (controller.signal.aborted) break;

          if (!response.ok) {
            const retryable = response.status === 429 || response.status >= 500;
            transientFailures += 1;
            if (!retryable || transientFailures >= MAX_TRANSIENT_FAILURES) {
              setIsLoading(false);
              setStatus("unknown");
              setError(
                response.status === 401 || response.status === 403
                  ? "Agent Auth proxy is missing workspace credentials."
                  : "Authorization status could not be loaded."
              );
              break;
            }
            await delay(RETRY_DELAY_MS * transientFailures, controller.signal);
            continue;
          }

          const session =
            (await response.json()) as AuthorizationSessionResponse;
          const candidate = session.status ?? "";
          const next = isSessionStatus(candidate) ? candidate : "unknown";
          setStatus(next);
          transientFailures = 0;

          if (next === "completed") {
            setIsLoading(false);
            onCompletedRef.current?.();
            break;
          }

          if (next !== "pending") {
            setIsLoading(false);
            break;
          }

          await delay(RETRY_DELAY_MS, controller.signal);
        } catch (err) {
          if (controller.signal.aborted) break;
          transientFailures += 1;
          if (transientFailures >= MAX_TRANSIENT_FAILURES) {
            setIsLoading(false);
            setStatus("unknown");
            setError(
              err instanceof Error
                ? err.message
                : "Authorization status could not be loaded."
            );
            break;
          }
          await delay(RETRY_DELAY_MS * transientFailures, controller.signal);
        }
      }
    };

    void poll();
    return () => controller.abort();
  }, [authId, enabled, retryAttempt]);

  return { status, isLoading, error, retry };
}
