"use client";

import { useEffect, useState } from "react";

import { AUTH_CHANGED_EVENT } from "src/lib/auth/events";
import { getAuthHeaders, supabase } from "src/lib/auth/supabase";

/**
 * Resolves Bearer headers for `useStream({ defaultHeaders })`. Refreshes when the
 * Supabase session changes so token rotation is picked up automatically.
 */
export function useAuthHeaders() {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await getAuthHeaders();
        if (!cancelled) {
          setHeaders((prev) =>
            prev?.Authorization === next?.Authorization ? prev : next
          );
        }
      } catch {
        if (!cancelled) setHeaders(null);
      }
    }

    void refresh();

    const onAuthChanged = () => {
      void refresh();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    const subscription = supabase?.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  return headers;
}
