"use client";

import { FileSpreadsheetIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import {
  SAMPLE_DATASET_DRAG_TYPE,
  SAMPLE_DATASET_FILENAME,
  SAMPLE_DATASET_LABEL,
  loadSampleDataset,
} from "src/lib/sample-dataset";
import { cn } from "src/lib/utils";

interface SampleDatasetCardProps {
  /** Attach the sample to the composer (drag drop or click). */
  onAttach: (file: File) => void;
  /** Hide the card once the sample is sitting in the composer. */
  attached: boolean;
}

function isSampleDrag(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer?.types.includes(SAMPLE_DATASET_DRAG_TYPE) ?? false;
}

/**
 * A draggable stand-in for a file on disk.
 *
 * The demo CSV is fetched once and kept as a real `File`. Browsers do not let a
 * page put that file on the drag payload, so the drag is tagged with
 * {@link SAMPLE_DATASET_DRAG_TYPE} and this component completes the drop itself:
 * document-level listeners claim the event (so the textarea does not treat it as
 * text) and hand the file to the composer. Clicking attaches it directly.
 */
export function SampleDatasetCard({ onAttach, attached }: SampleDatasetCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    loadSampleDataset()
      .then((loaded) => {
        if (!cancelledRef.current) setFile(loaded);
      })
      .catch((error: unknown) => {
        console.warn("[data-analyst] sample dataset failed to load:", error);
        if (!cancelledRef.current) setFailed(true);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Own the drop while this card is being dragged. Capture phase so the
  // textarea never sees it as a text drop.
  useEffect(() => {
    if (!dragging || !file) return;

    const allowDrop = (event: globalThis.DragEvent) => {
      if (!isSampleDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      if (!isSampleDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      onAttach(file);
    };

    document.addEventListener("dragover", allowDrop, true);
    document.addEventListener("drop", handleDrop, true);
    return () => {
      document.removeEventListener("dragover", allowDrop, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, [dragging, file, onAttach]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      if (!file) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.clearData();
      // Marking the payload keeps the browser from substituting the card's
      // label as draggable text.
      event.dataTransfer.setData(SAMPLE_DATASET_DRAG_TYPE, SAMPLE_DATASET_FILENAME);
      setDragging(true);
    },
    [file]
  );

  const handleClick = useCallback(() => {
    if (file) onAttach(file);
  }, [file, onAttach]);

  if (failed || attached) return null;

  return (
    <button
      type="button"
      draggable={file !== null}
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onClick={handleClick}
      disabled={file === null}
      title="Drag into the composer, or click to attach"
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl border border-dashed bg-muted/40 px-4 py-3",
        "cursor-grab transition-colors hover:border-primary/60 hover:bg-muted active:cursor-grabbing",
        "disabled:cursor-default disabled:opacity-60",
        dragging && "border-primary/60 opacity-60"
      )}
    >
      <FileSpreadsheetIcon className="size-7 text-primary" />
      <span className="max-w-[14rem] truncate font-mono text-xs">
        {SAMPLE_DATASET_FILENAME}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {file === null ? "loading…" : SAMPLE_DATASET_LABEL}
      </span>
    </button>
  );
}
