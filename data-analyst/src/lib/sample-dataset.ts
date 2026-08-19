/**
 * The bundled demo dataset, served from `fixtures/` (Vite `publicDir`).
 *
 * The UI fetches it once and hands out a real `File`, so the sample can be
 * dragged into the composer exactly like a file from the user's disk.
 */

export const SAMPLE_DATASET_FILENAME = "online_retail_sample.csv";

/**
 * Private drag type for the sample card.
 *
 * Chrome ignores `DataTransfer.items.add(File)` during a real `dragstart`, so
 * the card cannot hand the browser an actual file. Instead it marks the drag
 * with this MIME type and attaches the already-fetched `File` itself on drop.
 * A custom type also keeps the browser from falling back to dragging the
 * card's label as `text/plain`, which a textarea would happily paste.
 */
export const SAMPLE_DATASET_DRAG_TYPE = "application/x-mda-sample-dataset";

export const SAMPLE_DATASET_URL = `${import.meta.env.BASE_URL}${SAMPLE_DATASET_FILENAME}`;

/** Human-readable summary shown on the drag card. */
export const SAMPLE_DATASET_LABEL = "UCI Online Retail · 12k rows";

let pending: Promise<File> | null = null;

/** Fetch (and memoize) the sample CSV as a `File`. */
export function loadSampleDataset(): Promise<File> {
  pending ??= fetch(SAMPLE_DATASET_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`sample dataset unavailable (${response.status})`);
      }
      const blob = await response.blob();
      return new File([blob], SAMPLE_DATASET_FILENAME, { type: "text/csv" });
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });

  return pending;
}
