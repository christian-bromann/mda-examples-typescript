"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { signOut as signOutSupabase, supabase } from "src/lib/auth/supabase";

export type AuthMode = "supabase";

export interface AuthSession {
  mode: AuthMode;
  label?: string;
}

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!cancelled) {
          if (event === "SIGNED_IN") {
            const url = new URL(window.location.href);
            url.searchParams.delete("threadId");
            window.history.replaceState({}, "", url.toString());
          }
          setSession(nextSession);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await signOutSupabase();
    }
  }, []);

  const authSession: AuthSession | null = session
    ? { mode: "supabase", label: session.user.email ?? undefined }
    : null;

  return {
    authSession,
    loading,
    configured: supabase !== null,
    signOut,
  };
}
