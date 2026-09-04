import { createClient, type Session } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "src/lib/stream";

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user && !data.session) {
    throw new Error(
      "Account created — check your email to confirm before signing in."
    );
  }
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const session = await getSupabaseSession();
  if (session) {
    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }
  return null;
}
