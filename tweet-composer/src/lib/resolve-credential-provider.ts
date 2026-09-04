/**
 * Resolve a display name + icon id for a Connect-card credential.
 *
 * Adapted from Studio's `resolve-credential-provider.ts` — trusted hostname
 * matching only (exact eTLD+1 / subdomain), never free-form hostname labels.
 */

export type CredentialProviderHints = {
  slug: string;
  connect_url?: string;
};

/** Maps OAuth provider prefixes to IntegrationLogo-style icon ids + labels. */
const AUTH_PROVIDER_META: Record<string, { icon: string; name: string }> = {
  google: { icon: "google", name: "Google" },
  slack: { icon: "slack", name: "Slack" },
  linkedin: { icon: "linkedin", name: "LinkedIn" },
  linear: { icon: "linear", name: "Linear" },
  github: { icon: "github", name: "GitHub" },
  microsoft: { icon: "microsoft", name: "Microsoft" },
  twitter: { icon: "x_com", name: "X" },
  x: { icon: "x_com", name: "X" },
  salesforce: { icon: "salesforce", name: "Salesforce" },
  notion: { icon: "notion", name: "Notion" },
};

/**
 * Registrable domains that may show AUTH_PROVIDER_META branding.
 * Only exact eTLD+1 matches (or subdomains of them) count.
 */
const TRUSTED_AUTH_PROVIDER_DOMAINS: ReadonlyArray<readonly [string, string]> =
  [
    ["notion.com", "notion"],
    ["linear.app", "linear"],
    ["slack.com", "slack"],
    ["github.com", "github"],
    ["githubcopilot.com", "github"],
    ["linkedin.com", "linkedin"],
    ["google.com", "google"],
    ["microsoft.com", "microsoft"],
    ["microsoftonline.com", "microsoft"],
    ["salesforce.com", "salesforce"],
    ["twitter.com", "twitter"],
    ["x.com", "twitter"],
  ];

function getAuthProviderMeta(providerId: string) {
  const prefix = providerId.toLowerCase().split(/[-_]/u)[0] ?? "";
  return AUTH_PROVIDER_META[prefix];
}

export function hasAuthProviderMeta(providerId: string): boolean {
  return getAuthProviderMeta(providerId) != null;
}

export function getAuthProviderIconId(providerId: string): string {
  return getAuthProviderMeta(providerId)?.icon ?? providerId;
}

export function getAuthProviderDisplayName(
  providerId: string,
  fallbackName?: string
): string {
  const meta = getAuthProviderMeta(providerId);
  if (meta) return meta.name;
  if (fallbackName) return prettifySlug(fallbackName);
  return prettifySlug(providerId);
}

function prettifySlug(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (char) => char.toUpperCase())
    .trim();
}

export function providerIdFromTrustedHostname(
  hostname: string
): string | undefined {
  const host = hostname.toLowerCase().trim();
  if (!host) return undefined;

  for (const [domain, providerId] of TRUSTED_AUTH_PROVIDER_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return providerId;
    }
  }
  return undefined;
}

/** URL / brand hints from a credential `connect_url` (resource query + host). */
export function connectUrlProviderHints(connectUrl: string): string[] {
  const hints: string[] = [];
  let url: URL;
  try {
    url = new URL(connectUrl);
  } catch {
    return hints;
  }

  const resource = url.searchParams.get("resource")?.trim();
  if (resource) {
    hints.push(resource);
    try {
      const resourceHost = new URL(resource).hostname;
      const trusted = providerIdFromTrustedHostname(resourceHost);
      if (trusted) hints.push(trusted);
    } catch {
      // ignore invalid resource URLs
    }
  }

  if (url.hostname) {
    hints.push(`https://${url.hostname}/mcp`);
    hints.push(`https://${url.hostname}`);
    const trusted = providerIdFromTrustedHostname(url.hostname);
    if (trusted) hints.push(trusted);
  }

  return hints;
}

function resolveHint(hint: string): string | undefined {
  if (hint.includes("://")) {
    try {
      return providerIdFromTrustedHostname(new URL(hint).hostname);
    } catch {
      return undefined;
    }
  }

  if (hasAuthProviderMeta(hint)) {
    return getAuthProviderIconId(hint);
  }

  return undefined;
}

/**
 * Resolve a provider icon id for a gate credential.
 *
 * Slug alone is not enough for names like `my-github`; fall back to
 * `connect_url` resource / trusted host so GitHub / X icons still show.
 */
export function resolveCredentialProviderId(
  credential: CredentialProviderHints
): string {
  const fromSlug = resolveHint(credential.slug);
  if (fromSlug) return fromSlug;

  const slugBase = credential.slug.toLowerCase().replace(/\d+$/u, "");
  if (slugBase && slugBase !== credential.slug.toLowerCase()) {
    const fromSlugBase = resolveHint(slugBase);
    if (fromSlugBase) return fromSlugBase;
  }

  // Strip common prefixes: `team-github` → `github`, `my-x` → `x`
  const slugParts = credential.slug.toLowerCase().split(/[-_]/u);
  for (let i = slugParts.length - 1; i >= 0; i -= 1) {
    const part = slugParts[i];
    if (!part) continue;
    const fromPart = resolveHint(part);
    if (fromPart) return fromPart;
  }

  if (credential.connect_url) {
    for (const hint of connectUrlProviderHints(credential.connect_url)) {
      const resolved = resolveHint(hint);
      if (resolved) return resolved;
    }
  }

  return credential.slug;
}

export function resolveCredentialDisplayName(
  credential: CredentialProviderHints
): string {
  const providerId = resolveCredentialProviderId(credential);
  if (hasAuthProviderMeta(providerId)) {
    return getAuthProviderDisplayName(providerId);
  }
  // Icon id may already be google/github/x_com from getAuthProviderIconId.
  const byIcon = getAuthProviderMeta(
    providerId === "x_com" ? "twitter" : providerId
  );
  if (byIcon) return byIcon.name;
  return getAuthProviderDisplayName(providerId, credential.slug);
}
