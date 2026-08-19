"use client";

import { DeepAgentsMark } from "src/components/brand";
import { SampleDatasetCard } from "src/components/sample-dataset-card";
import { Suggestion, Suggestions } from "src/components/ui/suggestion";

/** Prompts tailored to the Online Retail sample (country, SKU, cancellations). */
export const SAMPLE_DATASET_PROMPTS = [
  "Chart monthly revenue by country for this dataset.",
  "What are the top 10 products by revenue, and how concentrated is spend?",
  "What share of invoices are cancellations (InvoiceNo starting with C), and which countries drive them?",
] as const;

interface EmptyStateProps {
  onAttachSample: (file: File) => void;
  sampleAttached: boolean;
  /** Fill the composer with a suggested prompt (does not submit). */
  onSelectPrompt: (prompt: string) => void;
}

/**
 * Empty chat surface: brand, the draggable sample file, then example prompts
 * once that file is attached.
 */
export function EmptyState({
  onAttachSample,
  sampleAttached,
  onSelectPrompt,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end overflow-x-hidden px-4 pb-2 pt-8 text-center sm:px-8">
      <div className="mb-auto flex flex-col items-center gap-4 pt-10">
        <DeepAgentsMark />
        <div className="w-full max-w-md space-y-2 px-1">
          <h1 className="text-3xl font-light tracking-tight">Data Analyst</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Drop a CSV and ask a business question. Analysis runs in a sandbox
            that already has pandas, DuckDB, and matplotlib.
          </p>
        </div>
      </div>

      {!sampleAttached ? (
        <div className="flex flex-col items-center gap-2">
          <p className="max-w-xs font-mono text-sm tracking-tight text-muted-foreground">
            Drag this file into the box below — or drop your own CSV
          </p>
          <SampleDatasetCard onAttach={onAttachSample} attached={sampleAttached} />
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
      ) : (
        <div className="mb-4 flex w-full max-w-lg flex-col items-center gap-3 px-1">
          <p className="font-mono text-sm tracking-tight text-muted-foreground">
            Sample attached — try one of these, or write your own
          </p>
          <Suggestions className="justify-center">
            {SAMPLE_DATASET_PROMPTS.map((prompt) => (
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
