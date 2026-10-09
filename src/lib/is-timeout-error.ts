/** Recognize abort/timeout names without requiring DOMException to extend Error. */
export function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null | undefined)?.name;
  return name === "AbortError" || name === "TimeoutError";
}
