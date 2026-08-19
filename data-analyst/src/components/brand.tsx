"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "src/components/ui/button";
import { cn } from "src/lib/utils";

const THEME_KEY = "mda-theme";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage failures (private mode).
  }
}

export function LangChainMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <img
        src="/brand/langchain-icon-light.svg"
        alt=""
        aria-hidden="true"
        className="h-5 w-auto dark:hidden"
      />
      <img
        src="/brand/langchain-icon-dark.svg"
        alt=""
        aria-hidden="true"
        className="hidden h-5 w-auto dark:block"
      />
    </span>
  );
}

export function DeepAgentsMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <img
        src="/brand/deep-agents-icon-light.svg"
        alt=""
        aria-hidden="true"
        className="h-14 w-auto dark:hidden"
      />
      <img
        src="/brand/deep-agents-icon-dark.svg"
        alt=""
        aria-hidden="true"
        className="hidden h-14 w-auto dark:block"
      />
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }, [theme]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="size-8 px-0"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function AppHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <LangChainMark />
        <span className="truncate font-mono text-sm tracking-tight">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
