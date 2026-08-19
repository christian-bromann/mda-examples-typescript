"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  FilePenIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderSearchIcon,
  LoaderIcon,
  TerminalIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { HighlightedCode } from "src/components/highlighted-code";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "src/components/ui/collapsible";
import { languageForPath, looksLikeJson, stripLineNumbers } from "src/lib/tool-output";
import { cn } from "src/lib/utils";

export type ToolStatus = "running" | "finished" | "error";

export interface ToolActivityProps {
  name: string;
  args?: Record<string, unknown>;
  output?: unknown;
  status: ToolStatus;
}

function meta(name: string): { label: string; Icon: LucideIcon } {
  switch (name) {
    case "execute":
    case "shell":
    case "run":
      return { label: "Run", Icon: TerminalIcon };
    case "ls":
    case "list_files":
    case "list_directory":
      return { label: "List", Icon: FolderSearchIcon };
    case "glob":
    case "grep":
    case "search":
      return { label: "Search", Icon: FolderSearchIcon };
    case "read_file":
    case "read":
      return { label: "Read", Icon: FileTextIcon };
    case "write_file":
    case "write":
      return { label: "Write", Icon: FilePlusIcon };
    case "edit_file":
    case "edit":
    case "str_replace":
      return { label: "Edit", Icon: FilePenIcon };
    default:
      return { label: name, Icon: WrenchIcon };
  }
}

const DETAIL_KEYS = ["path", "file_path", "filePath", "pattern", "command", "dir", "directory"];

function isShellTool(name: string): boolean {
  return name === "execute" || name === "shell" || name === "run";
}

function shellCommand(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  const value = args.command;
  return typeof value === "string" && value.trim() ? value : null;
}

/** One-line header preview so long heredocs do not flood the trigger. */
function commandSummary(command: string): string {
  const firstLine = command.trim().split("\n")[0]?.trim() ?? command.trim();
  const multiline = command.includes("\n");
  const base = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
  return multiline ? `${base} …` : base;
}

function detail(args: Record<string, unknown> | undefined, name: string): string | null {
  if (!args) return null;
  if (isShellTool(name)) {
    const command = shellCommand(args);
    return command ? commandSummary(command) : null;
  }
  for (const key of DETAIL_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Extra shell args beyond `command` (timeout, etc.), if any. */
function remainingArgs(
  args: Record<string, unknown> | undefined,
  omit: string[],
): string {
  if (!args) return "";
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (omit.includes(key)) continue;
    rest[key] = value;
  }
  return Object.keys(rest).length > 0 ? stringify(rest) : "";
}

function filePath(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  for (const key of ["file_path", "filePath", "path"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

interface RenderedOutput {
  text: string;
  language: string | null;
  startLine?: number;
}

/**
 * Decide how to display a tool result: file reads keep a single line-number
 * gutter and are highlighted by extension, JSON payloads highlight as JSON, and
 * console output stays plain.
 */
function renderedOutput(
  text: string,
  args: Record<string, unknown> | undefined,
): RenderedOutput {
  const { text: stripped, startLine } = stripLineNumbers(text);
  if (startLine !== undefined) {
    const language = languageForPath(filePath(args)) ?? (looksLikeJson(stripped) ? "json" : null);
    return { text: stripped, language, startLine };
  }
  return { text, language: looksLikeJson(text) ? "json" : null };
}

function StatusGlyph({ status }: { status: ToolStatus }) {
  if (status === "running") return <LoaderIcon className="size-3.5 animate-spin text-blue-500" />;
  if (status === "error") return <XIcon className="size-3.5 text-destructive" />;
  return <CheckIcon className="size-3.5 text-emerald-500" />;
}

export function ToolActivity({ name, args, output, status }: ToolActivityProps) {
  const [open, setOpen] = useState(false);
  const { label, Icon } = meta(name);
  const subtitle = detail(args, name);
  const command = isShellTool(name) ? shellCommand(args) : null;
  const argsText = command
    ? remainingArgs(args, ["command"])
    : args && Object.keys(args).length > 0
      ? stringify(args)
      : "";
  const outputText = stringify(output);
  const outputView = outputText ? renderedOutput(outputText, args) : null;
  const hasBody = Boolean(command || argsText || outputText);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-lg border bg-muted/40"
    >
      <CollapsibleTrigger
        disabled={!hasBody}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-xs",
          hasBody && "hover:bg-muted/70",
        )}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">{label}</span>
        {subtitle && <span className="truncate font-mono text-muted-foreground">{subtitle}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <StatusGlyph status={status} />
          {hasBody && (
            <ChevronRightIcon
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </span>
      </CollapsibleTrigger>

      {hasBody && (
        <CollapsibleContent>
          <div className="space-y-2 border-t px-3 py-2">
            {command && (
              <div className="space-y-1">
                <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Command
                </p>
                <HighlightedCode code={command} language="bash" maxHeightClassName="max-h-72" />
              </div>
            )}
            {argsText && (
              <div className="space-y-1">
                <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {command ? "Options" : "Input"}
                </p>
                <HighlightedCode
                  code={argsText}
                  language="json"
                  maxHeightClassName="max-h-40"
                />
              </div>
            )}
            {outputView && (
              <div className="space-y-1">
                <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  Output
                </p>
                {outputView.language ? (
                  <HighlightedCode
                    code={outputView.text}
                    language={outputView.language}
                    startLine={outputView.startLine}
                    maxHeightClassName="max-h-72"
                  />
                ) : (
                  <pre className="max-h-72 overflow-auto rounded-md bg-background p-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre">
                    {outputView.text}
                  </pre>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
