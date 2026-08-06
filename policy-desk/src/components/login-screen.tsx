"use client";

import { BookOpenIcon } from "lucide-react";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "src/components/ui/button";
import { signInWithEmail, signUpWithEmail } from "src/lib/auth/supabase";

type AuthMode = "sign-in" | "sign-up";

export function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setAuthError(null);
      setAuthNotice(null);
      setPending(true);
      try {
        if (mode === "sign-in") {
          await signInWithEmail(email, password);
        } else {
          await signUpWithEmail(email, password);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("check your email to confirm")
        ) {
          setAuthNotice(error.message);
          setMode("sign-in");
        } else {
          setAuthError(error instanceof Error ? error.message : "Authentication failed");
        }
      } finally {
        setPending(false);
      }
    },
    [email, mode, password]
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted">
            <BookOpenIcon className="size-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Policy Desk</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to ask about handbooks and company policies — attach a file
              and get clear guidance.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border bg-card p-6">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          {authError && <p className="text-xs text-destructive">{authError}</p>}
          {authNotice && <p className="text-xs text-muted-foreground">{authNotice}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "sign-in" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setAuthError(null);
                setAuthNotice(null);
              }}
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
