"use client";

import { useMemo } from "react";

/** Fetch wrapper that always attaches the Supabase Bearer token. */
export function useAuthedFetch(authHeaders: Record<string, string> | null) {
  return useMemo(() => {
    if (!authHeaders) return undefined;
    return (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(authHeaders)) {
        headers.set(name, value);
      }
      return fetch(input, { ...init, headers });
    };
  }, [authHeaders]);
}
