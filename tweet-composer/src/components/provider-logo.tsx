"use client";

import type { IconType } from "react-icons";
import { FaMicrosoft, FaSlack } from "react-icons/fa6";
import {
  SiGithub,
  SiGoogle,
  SiLinear,
  SiNotion,
  SiX,
} from "react-icons/si";

import { cn } from "src/lib/utils";

/**
 * Brand marks via Simple Icons (`react-icons/si`). Slack and Microsoft are no
 * longer in Simple Icons (trademark policy), so those two come from Font Awesome.
 */
const ICONS: Record<string, IconType> = {
  github: SiGithub,
  x_com: SiX,
  twitter: SiX,
  x: SiX,
  notion: SiNotion,
  linear: SiLinear,
  slack: FaSlack,
  google: SiGoogle,
  googleGeneric: SiGoogle,
  microsoft: FaMicrosoft,
};

type ProviderLogoProps = {
  providerId: string;
  className?: string;
};

/**
 * Compact provider mark for the Connect card (Studio IntegrationLogo subset).
 */
export function ProviderLogo({ providerId, className }: ProviderLogoProps) {
  const Icon = ICONS[providerId] ?? ICONS[providerId.toLowerCase()];
  if (Icon) {
    return (
      <Icon
        className={cn("size-5 shrink-0 text-foreground", className)}
        aria-hidden
      />
    );
  }

  const letter = providerId.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground",
        className
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}
