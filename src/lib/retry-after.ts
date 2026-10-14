/** Server rate responses use seconds; tolerate an HTTP date and cap bad values. */
export function readRetryAfter(response: Pick<Response, "headers">): number {
  const value = response.headers?.get("Retry-After");
  if (!value) return 60;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - Date.now()) / 1000)) : 60;
}
