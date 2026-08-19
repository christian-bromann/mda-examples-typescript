"use client";

import { useEffect, useRef, useState } from "react";

import { LANGGRAPH_API_URL } from "src/lib/stream";

export type BackendStatus = "checking" | "online" | "offline";

/**
 * Ping the agent through the Vite proxy (which stamps the trusted-backend
 * ingress headers). After the first successful probe, status stays `online`
 * during background re-checks so the chat UI is not torn down every poll.
 */
export function useBackendHealth() {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function check() {
      try {
        // Any HTTP response means the server is reachable (401 is expected when
        // the probe itself is unauthenticated).
        await fetch(`${LANGGRAPH_API_URL}/ok`, { signal: controller.signal });
        if (!cancelled) {
          hasConnectedRef.current = true;
          setStatus("online");
        }
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
  }, []);

  return { status, apiUrl: LANGGRAPH_API_URL };
}
