/**
 * Helpers for presenting deep-agent tool payloads as code.
 *
 * `read_file` output arrives with `cat -n` style prefixes (`%6d\t`). The
 * LangSmith sandbox backend numbers lines in the shell command *and* the
 * `read_file` tool numbers the result again, so the same content can carry two
 * gutters. Both are stripped here and re-rendered as a single gutter.
 */

const LINE_PREFIX = /^ *(\d+(?:\.\d+)?)\t/;

export interface NumberedText {
  text: string;
  /** Line number of the first row, when the payload carried a gutter. */
  startLine?: number;
}

function stripOneLayer(lines: string[]): { lines: string[]; startLine: number } | null {
  let startLine: number | undefined;
  const stripped: string[] = [];

  for (const line of lines) {
    if (line === "") {
      stripped.push(line);
      continue;
    }
    const match = LINE_PREFIX.exec(line);
    if (!match) return null;
    if (startLine === undefined) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed)) startLine = parsed;
    }
    stripped.push(line.slice(match[0].length));
  }

  if (startLine === undefined) return null;
  return { lines: stripped, startLine };
}

/**
 * Remove every line-number gutter, keeping the outermost numbering as the
 * starting line so the rendered gutter still matches the file.
 */
export function stripLineNumbers(text: string): NumberedText {
  const lines = text.split("\n");
  if (lines.length === 0) return { text };

  let current = lines;
  let startLine: number | undefined;

  for (;;) {
    const layer = stripOneLayer(current);
    if (!layer) break;
    current = layer.lines;
    startLine ??= layer.startLine;
  }

  if (startLine === undefined) return { text };
  return { text: current.join("\n"), startLine };
}

const EXTENSION_LANGUAGES: Record<string, string> = {
  json: "json",
  jsonl: "json",
  py: "python",
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  sh: "bash",
  bash: "bash",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  csv: "csv",
  html: "html",
  css: "css",
};

/** Shiki language for a file path, or `null` to render as plain text. */
export function languageForPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return EXTENSION_LANGUAGES[extension] ?? null;
}

/** Whether text is a JSON object/array we can highlight as JSON. */
export function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}
