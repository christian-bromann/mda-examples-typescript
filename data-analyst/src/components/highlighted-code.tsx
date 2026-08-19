"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

import { cn } from "src/lib/utils";

export interface HighlightedCodeProps {
  code: string;
  language?: string;
  className?: string;
  /** Cap height of the scrollable region. */
  maxHeightClassName?: string;
  /** Render a line-number gutter starting at this line. */
  startLine?: number;
}

/**
 * Shiki-highlighted code panel for tool activity (shell commands, file reads).
 * Falls back to a plain `<pre>` until highlighting resolves.
 */
export function HighlightedCode({
  code,
  language = "bash",
  className,
  maxHeightClassName = "max-h-72",
  startLine,
}: HighlightedCodeProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    void codeToHtml(code, {
      lang: language,
      theme: dark ? "github-dark" : "github-light",
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (!html) {
    return (
      <pre
        className={cn(
          "overflow-auto rounded-md bg-background p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre",
          maxHeightClassName,
          className,
        )}
      >
        {code}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "tool-code overflow-auto rounded-md bg-background text-[0.7rem] leading-relaxed [&_pre]:m-0 [&_pre]:!bg-transparent [&_pre]:p-2 [&_code]:font-mono [&_code]:text-[0.7rem] [&_code]:leading-relaxed",
        startLine !== undefined && "tool-code-numbered",
        maxHeightClassName,
        className,
      )}
      style={
        startLine !== undefined
          ? ({ "--tool-code-start": startLine - 1 } as React.CSSProperties)
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
