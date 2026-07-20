/**
 * Parse a route/query param to a positive integer.
 * Returns null when the value is missing, empty, or not a valid integer.
 */
export function parseIntParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
