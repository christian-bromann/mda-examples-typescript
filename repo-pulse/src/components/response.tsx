"use client";

import type { ComponentProps } from "react";

import { cn } from "src/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { memo } from "react";
import { Streamdown } from "streamdown";

export type ResponseProps = ComponentProps<typeof Streamdown>;

// Upstream streamdown / @streamdown/code shiki types drift across versions.
const streamdownPlugins = { cjk, code, math } as NonNullable<
  ResponseProps["plugins"]
>;

/**
 * Streaming-aware markdown renderer used for assistant/subagent text.
 */
export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children,
);

Response.displayName = "Response";
