"use client";

import { useEffect, useRef, useState } from "react";

import { getAuthHeaders } from "src/lib/auth/supabase";
import { LANGGRAPH_API_URL } from "src/lib/stream";

export type BackendStatus = "checking" | "online" | "offline";

/**
 * Ping the LangGraph dev server through the Vite proxy. Sends the Supabase
 * Bearer token when available so auth-gated dev servers respond with 200.
 *
 * After the first successful probe, status stays `online` during background
 * re-checks so the chat UI is not torn down every poll interval.
 */
export function useBackendHealth(hasAuth: boolean) {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (!hasAuth) {
      hasConnectedRef.current = false;
      setStatus("offline");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function check() {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${LANGGRAPH_API_URL}/ok`, {
          signal: controller.signal,
          headers: headers ?? undefined,
        });
        // Any HTTP response means the dev server is reachable (401 is expected
        // when auth is enabled but /ok is probed without a valid token).
        if (!cancelled) {
          hasConnectedRef.current = true;
          setStatus("online");
        }
        void response;
      } catch {
        if (!cancelled) {
          hasConnectedRef.current = false;
          setStatus("offline");
        }
      }
    }

    if (!hasConnectedRef.current) {
      setStatus("checking");
    }
    void check();
    const interval = window.setInterval(() => void check(), 30000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [hasAuth]);

  return { status, apiUrl: LANGGRAPH_API_URL };
}
