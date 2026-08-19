"use client";

import { GitBranchIcon } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";

import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import {
  DEFAULT_REPO,
  DEFAULT_REPO_LABEL,
  normalizeRepoSlug,
} from "src/lib/target-repo";
import { cn } from "src/lib/utils";

interface TargetRepoCardProps {
  /** Currently selected target (null until the user picks one). */
  selected: string | null;
  onSelect: (repo: string) => void;
}

/**
 * Empty-state card mirroring data-analyst's sample dataset chip: pick the
 * default demo repo, or type another `owner/repo`.
 */
export function TargetRepoCard({ selected, onSelect }: TargetRepoCardProps) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleUseDefault = useCallback(() => {
    setError(null);
    onSelect(DEFAULT_REPO);
  }, [onSelect]);

  const handleCustom = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const slug = normalizeRepoSlug(custom);
      if (!slug) {
        setError("Use owner/repo (e.g. facebook/react)");
        return;
      }
      setError(null);
      onSelect(slug);
    },
    [custom, onSelect]
  );

  if (selected) return null;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleUseDefault}
        title="Use this repository"
        className={cn(
          "group flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed bg-muted/40 px-4 py-3",
          "cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted"
        )}
      >
        <GitBranchIcon className="size-7 text-primary" />
        <span className="max-w-full truncate font-mono text-xs">{DEFAULT_REPO}</span>
        <span className="text-[11px] text-muted-foreground">{DEFAULT_REPO_LABEL}</span>
      </button>

      <form onSubmit={handleCustom} className="flex w-full gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="or owner/repo…"
          className="h-9 font-mono text-xs"
          aria-label="Custom repository"
        />
        <Button type="submit" size="sm" variant="secondary" className="shrink-0">
          Use
        </Button>
      </form>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
