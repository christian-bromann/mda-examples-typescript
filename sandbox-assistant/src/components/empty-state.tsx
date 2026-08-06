"use client";

import { FolderCodeIcon } from "lucide-react";

/**
 * Empty chat surface: brand + a dotted cue pointing at the composer below.
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-end overflow-x-hidden px-4 pb-2 pt-8 text-center sm:px-8">
      <div className="mb-auto flex flex-col items-center gap-4 pt-10">
        <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted">
          <FolderCodeIcon className="size-6 text-primary" />
        </div>
        <div className="w-full max-w-md space-y-2 px-1">
          <h1 className="text-xl font-semibold">Sandbox Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Signed in with Supabase. Each chat gets an isolated LangSmith sandbox.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="max-w-xs text-sm text-muted-foreground">
          Drop a document here and ask a question about it
        </p>
        <svg
          aria-hidden="true"
          className="text-muted-foreground/65"
          width="48"
          height="72"
          viewBox="0 0 48 72"
          fill="none"
        >
          {/* Squiggly stem — gentle S curves into the composer */}
          <path
            d="M24 4
               C 34 12, 12 18, 22 28
               C 32 38, 14 44, 24 54"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="2.5 5"
          />
          {/* Soft arrowhead */}
          <path
            d="M15 48
               C 18 54, 21 58, 24 62
               C 27 58, 30 54, 33 48"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2.5 4"
          />
        </svg>
      </div>
    </div>
  );
}
