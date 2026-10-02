const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /\+?\d[\d\s().-]{7,}\d/g;
const bearerPattern = /(Bearer\s+)[^\s",]+/gi;
const providerSecretPattern = /\b(?:sk[-_]|pk_|rk_|whsec_)[A-Za-z0-9_-]+\b/g;
const signedWebSocketPattern = /wss:\/\/[^\s"']+/gi;
const sensitiveKeys = new Set([
  "authorization",
  "apikey",
  "cookie",
  "customeremail",
  "customerphone",
  "email",
  "idtoken",
  "paymentproviderid",
  "password",
  "phone",
  "refreshtoken",
  "secret",
  "sessiontoken",
  "stripecustomerid",
  "token",
  "userid",
  "xapikey",
  "xiapikey",
]);

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  return sensitiveKeys.has(normalizeKey(key));
}

function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function redactPhoneLikeContent(value: string) {
  return value.replace(phonePattern, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 8 ? REDACTED : match;
  });
}

function sanitizeString(value: string, key?: string, seen?: WeakSet<object>): string {
  if (looksLikeJson(value)) {
    try {
      return JSON.stringify(sanitizeValue(JSON.parse(value), key, seen));
    } catch {
      // Fall through to pattern-based sanitization.
    }
  }

  return redactPhoneLikeContent(
    value
      .replace(emailPattern, REDACTED)
      .replace(bearerPattern, `$1${REDACTED}`)
      .replace(providerSecretPattern, REDACTED)
      .replace(signedWebSocketPattern, REDACTED),
  );
}

function sanitizeError(error: Error, seen: WeakSet<object>) {
  return {
    name: error.name,
    message: sanitizeString(error.message, undefined, seen),
    stack: error.stack ? sanitizeString(error.stack, undefined, seen) : undefined,
  };
}

export function sanitizeValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value, key, seen);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeError(value, seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR;
    }

    seen.add(value);

    const sanitized = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey, seen),
      ]),
    );

    seen.delete(value);
    return sanitized;
  }

  return String(value);
}

export function sanitizeLogMessage(value: string): string {
  return sanitizeString(value);
}
