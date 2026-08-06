export function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
