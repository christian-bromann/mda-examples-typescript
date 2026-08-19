"use client";

import { DeepAgentsMark } from "src/components/brand";
import { TargetRepoCard } from "src/components/target-repo-card";
import { Suggestion, Suggestions } from "src/components/ui/suggestion";

/** Prompts once a target repo is selected. */
export const REPO_PULSE_PROMPTS = [
  "Chart contributor concentration and estimate bus factor for this repo.",
  "What's the median time from PR open to merge over the recent window?",
  "Show weekly PR throughput (opened vs merged) and call out any spikes.",
] as const;

interface EmptyStateProps {
  targetRepo: string | null;
  onSelectRepo: (repo: string) => void;
  /** Fill the composer with a suggested prompt (does not submit). */
  onSelectPrompt: (prompt: string) => void;
}

/**
 * Empty chat surface: brand, target-repo card, then example prompts once a
 * repository is selected — same layout pattern as data-analyst.
 */
export function EmptyState({
  targetRepo,
  onSelectRepo,
  onSelectPrompt,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end overflow-x-hidden px-4 pb-2 pt-8 text-center sm:px-8">
      <div className="mb-auto flex flex-col items-center gap-4 pt-10">
        <DeepAgentsMark />
        <div className="w-full max-w-md space-y-2 px-1">
          <h1 className="text-3xl font-light tracking-tight">Repo Pulse</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pick a GitHub repository and ask about contributors, review latency,
            or throughput. The sandbox already has the{" "}
            <code className="text-xs">gh</code> CLI, pandas, and matplotlib.
          </p>
        </div>
      </div>

      {!targetRepo ? (
        <div className="flex flex-col items-center gap-2">
          <p className="max-w-xs font-mono text-sm tracking-tight text-muted-foreground">
            Choose a target repo to get started
          </p>
          <TargetRepoCard selected={targetRepo} onSelect={onSelectRepo} />
          <svg
            aria-hidden="true"
            className="text-muted-foreground/65"
            width="48"
            height="72"
            viewBox="0 0 48 72"
            fill="none"
          >
            <path
              d="M24 4
               C 34 12, 12 18, 22 28
               C 32 38, 14 44, 24 54"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="2.5 5"
            />
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
      ) : (
        <div className="mb-4 flex w-full max-w-lg flex-col items-center gap-3 px-1">
          <p className="font-mono text-sm tracking-tight text-muted-foreground">
            Targeting{" "}
            <span className="font-mono text-foreground">{targetRepo}</span> — try
            one of these, or write your own
          </p>
          <Suggestions className="justify-center">
            {REPO_PULSE_PROMPTS.map((prompt) => (
              <Suggestion
                key={prompt}
                suggestion={prompt}
                onClick={onSelectPrompt}
                className="h-auto max-w-full whitespace-normal py-2 text-left text-xs sm:text-sm"
              />
            ))}
          </Suggestions>
        </div>
      )}
    </div>
  );
}
