const LINEAR_API_URL = "https://api.linear.app/graphql";

/** Deployment-scoped Linear personal API key from `.env` / deploy secrets. */
export function linearApiKey(): string | undefined {
  const key = process.env.LINEAR_API_KEY;
  return key?.trim() || undefined;
}

export function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

type GraphQlError = { message?: string };

/**
 * Run a Linear GraphQL query with the deployment API key.
 * Uses fetch (no SDK) so the example stays dependency-light like a PAT script.
 */
export async function linearGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data: T } | { error: string }> {
  const apiKey = linearApiKey();
  if (!apiKey) {
    return {
      error:
        "No Linear API key configured. Set LINEAR_API_KEY in the deployment environment.",
    };
  }

  let response: Response;
  try {
    response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Linear request failed: ${message}` };
  }

  let payload: { data?: T; errors?: GraphQlError[] };
  try {
    payload = (await response.json()) as {
      data?: T;
      errors?: GraphQlError[];
    };
  } catch {
    return {
      error: `Linear returned non-JSON (HTTP ${response.status}).`,
    };
  }

  if (!response.ok) {
    const first = payload.errors?.[0]?.message;
    return {
      error:
        first ??
        `Linear GraphQL HTTP ${response.status}. Check LINEAR_API_KEY scopes.`,
    };
  }

  if (payload.errors?.length) {
    return {
      error: payload.errors.map((e) => e.message ?? "Unknown error").join("; "),
    };
  }

  if (!payload.data) {
    return { error: "Linear GraphQL returned no data." };
  }

  return { data: payload.data };
}
