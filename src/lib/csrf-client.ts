const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Read the CSRF token from the __csrf cookie.
 * Returns null if the cookie is not set.
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name.trim() === CSRF_COOKIE_NAME) {
      return rest.join("=").trim() || null;
    }
  }
  return null;
}

/**
 * Return an object with the x-csrf-token header set,
 * suitable for spreading into a fetch headers object.
 * Returns empty object if no token is available.
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) return {};
  return { [CSRF_HEADER_NAME]: token };
}

/**
 * Wrapper around fetch that automatically adds the CSRF header
 * for state-changing HTTP methods (POST, PUT, PATCH, DELETE).
 */
export async function fetchWithCsrf(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!CSRF_METHODS.has(method)) return fetch(input, init);

  const token = getCsrfToken();
  const existingHeaders =
    init?.headers &&
    typeof init.headers === "object" &&
    !Array.isArray(init.headers)
      ? (init.headers as Record<string, string>)
      : {};

  const headers: Record<string, string> = {
    ...existingHeaders,
    ...(token ? { [CSRF_HEADER_NAME]: token } : {}),
  };

  return fetch(input, { ...init, headers });
}
