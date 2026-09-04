/**
 * Turn `useStream().error` into a short user-facing string.
 *
 * Lifecycle `failed` events often put a JSON blob in `Error.message`:
 * `{"error":"ToolException","message":"Error calling tool …"}`.
 */
export function formatStreamError(error: unknown): string | null {
  if (error == null) return null;

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();

  const trimmed = raw.trim();
  if (!trimmed) return "Run failed.";

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
    };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim().replace(/\n+$/, "");
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // plain string
  }

  return trimmed.replace(/\n+$/, "");
}

export function toolOutputLooksLikeError(output: unknown): boolean {
  const text =
    typeof output === "string"
      ? output
      : output == null
        ? ""
        : (() => {
            try {
              return JSON.stringify(output);
            } catch {
              return String(output);
            }
          })();
  const lower = text.toLowerCase();
  return (
    lower.includes("toolexception") ||
    lower.includes("error calling tool") ||
    lower.includes("insufficient scopes") ||
    lower.includes("mcperror") ||
    /^\s*error[:\s]/i.test(text)
  );
}
