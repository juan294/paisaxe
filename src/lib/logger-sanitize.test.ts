import { describe, it, expect } from "vitest";
import { sanitizeValue, sanitizeLogMessage } from "./logger-sanitize";

describe("sanitizeValue", () => {
  describe("Bearer token redaction", () => {
    it("redacts Bearer token in a plain string", () => {
      const result = sanitizeValue("Authorization: Bearer abc123secrettoken");
      expect(result).toBe("Authorization: Bearer [REDACTED]");
    });

    it("redacts Bearer token regardless of case", () => {
      const result = sanitizeValue("bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
      expect(result).toBe("bearer [REDACTED]");
    });

    it("redacts Bearer token in nested object", () => {
      // 'auth' is not a sensitive key — the pattern replaces just the token portion
      const result = sanitizeValue({ headers: { auth: "Bearer supersecret" } }) as Record<string, Record<string, string>>;
      expect(result.headers.auth).toBe("Bearer [REDACTED]");
    });

    it("redacts sensitive key 'authorization' regardless of value", () => {
      const result = sanitizeValue({ authorization: "Bearer xyz" }) as Record<string, string>;
      expect(result.authorization).toBe("[REDACTED]");
    });
  });

  describe("Stripe key redaction", () => {
    it("redacts sk_live_ keys", () => {
      const result = sanitizeValue("key=sk_live_abcdef123456");
      expect(result).toBe("key=[REDACTED]");
    });

    it("redacts sk_test_ keys", () => {
      const result = sanitizeValue("secret=sk_test_abcdef123456");
      expect(result).toBe("secret=[REDACTED]");
    });

    it("redacts pk_ keys", () => {
      const result = sanitizeValue("pk_live_publickey123");
      expect(result).toBe("[REDACTED]");
    });

    it("redacts rk_ keys", () => {
      const result = sanitizeValue("rk_live_restrictedkey");
      expect(result).toBe("[REDACTED]");
    });

    it("redacts whsec_ webhook secrets", () => {
      const result = sanitizeValue("whsec_webhooksecretvalue123");
      expect(result).toBe("[REDACTED]");
    });
  });

  describe("Phone number redaction", () => {
    it("redacts international phone numbers", () => {
      const result = sanitizeValue("Call me at +34 612 345 678");
      expect(result).toBe("Call me at [REDACTED]");
    });

    it("redacts phone numbers with dashes", () => {
      const result = sanitizeValue("Phone: 612-345-678");
      expect(result).toBe("Phone: [REDACTED]");
    });

    it("does not redact short digit sequences (under 8 digits)", () => {
      const result = sanitizeValue("code 1234");
      expect(result).toBe("code 1234");
    });
  });

  describe("Email address redaction", () => {
    it("redacts email addresses in strings", () => {
      const result = sanitizeValue("Contact: user@example.com please");
      expect(result).toBe("Contact: [REDACTED] please");
    });
  });

  describe("Circular reference handling", () => {
    it("handles a circular reference without throwing", () => {
      const obj: Record<string, unknown> = { name: "test" };
      obj.self = obj;
      expect(() => sanitizeValue(obj)).not.toThrow();
    });

    it("replaces circular reference with [Circular]", () => {
      const obj: Record<string, unknown> = { a: "safe" };
      obj.self = obj;
      const result = sanitizeValue(obj) as Record<string, string>;
      expect(result.self).toBe("[Circular]");
    });
  });

  describe("Primitive passthrough", () => {
    it("returns null as-is", () => {
      expect(sanitizeValue(null)).toBe(null);
    });

    it("returns undefined as-is", () => {
      expect(sanitizeValue(undefined)).toBe(undefined);
    });

    it("returns numbers as-is", () => {
      expect(sanitizeValue(42)).toBe(42);
      expect(sanitizeValue(0)).toBe(0);
      expect(sanitizeValue(-1.5)).toBe(-1.5);
    });

    it("returns booleans as-is", () => {
      expect(sanitizeValue(true)).toBe(true);
      expect(sanitizeValue(false)).toBe(false);
    });
  });

  describe("Sensitive key redaction", () => {
    it("redacts 'token' key", () => {
      const result = sanitizeValue({ token: "my-secret-token" }) as Record<string, string>;
      expect(result.token).toBe("[REDACTED]");
    });

    it("redacts 'password' key", () => {
      const result = sanitizeValue({ password: "hunter2" }) as Record<string, string>;
      expect(result.password).toBe("[REDACTED]");
    });

    it("redacts 'apikey' key (case-insensitive)", () => {
      const result = sanitizeValue({ apiKey: "someapikey" }) as Record<string, string>;
      expect(result.apiKey).toBe("[REDACTED]");
    });

    it("redacts 'secret' key", () => {
      const result = sanitizeValue({ secret: "topsecret" }) as Record<string, string>;
      expect(result.secret).toBe("[REDACTED]");
    });

    it("redacts 'cookie' key", () => {
      const result = sanitizeValue({ cookie: "session=abc123" }) as Record<string, string>;
      expect(result.cookie).toBe("[REDACTED]");
    });

    it("redacts 'email' key", () => {
      const result = sanitizeValue({ email: "user@example.com" }) as Record<string, string>;
      expect(result.email).toBe("[REDACTED]");
    });

    it("redacts 'phone' key", () => {
      const result = sanitizeValue({ phone: "+34 612 345 678" }) as Record<string, string>;
      expect(result.phone).toBe("[REDACTED]");
    });

    it("does not redact non-sensitive keys", () => {
      const result = sanitizeValue({ username: "publicuser", id: 42 }) as Record<string, unknown>;
      expect(result.username).toBe("publicuser");
      expect(result.id).toBe(42);
    });
  });

  describe("Array handling", () => {
    it("sanitizes each element of an array", () => {
      const result = sanitizeValue(["Bearer secret123", "safe text"]) as string[];
      expect(result[0]).toBe("Bearer [REDACTED]");
      expect(result[1]).toBe("safe text");
    });
  });

  describe("JSON string detection", () => {
    it("sanitizes embedded JSON object strings", () => {
      const embedded = JSON.stringify({ authorization: "Bearer token123" });
      const result = sanitizeValue(embedded) as string;
      const parsed = JSON.parse(result);
      expect(parsed.authorization).toBe("[REDACTED]");
    });
  });

  describe("Error handling", () => {
    it("sanitizes error messages", () => {
      const err = new Error("Failed with Bearer abc123token");
      const result = sanitizeValue(err) as { name: string; message: string };
      expect(result.message).toBe("Failed with Bearer [REDACTED]");
    });

    it("preserves error name", () => {
      const err = new TypeError("bad token sk_live_xyz");
      const result = sanitizeValue(err) as { name: string; message: string };
      expect(result.name).toBe("TypeError");
    });
  });

  describe("Date handling", () => {
    it("converts Date to ISO string", () => {
      const d = new Date("2024-01-15T12:00:00.000Z");
      expect(sanitizeValue(d)).toBe("2024-01-15T12:00:00.000Z");
    });
  });

  describe("BigInt handling", () => {
    it("converts BigInt to string", () => {
      // Use BigInt literal (n suffix) to avoid Number.MAX_SAFE_INTEGER precision loss
      expect(sanitizeValue(BigInt("9007199254740993"))).toBe("9007199254740993");
    });
  });

  describe("string-with-sensitive-key short-circuit", () => {
    it("redacts a string value when its key is sensitive", () => {
      const result = sanitizeValue({ password: "hunter2" }) as Record<string, string>;
      expect(result.password).toBe("[REDACTED]");
    });
  });

  describe("unknown-type fallback", () => {
    it("falls back to String() for symbol values", () => {
      const symbol = Symbol("trace-id");
      expect(sanitizeValue(symbol)).toBe("Symbol(trace-id)");
    });
  });
});

describe("sanitizeLogMessage", () => {
  it("redacts Bearer tokens in a log message string", () => {
    const result = sanitizeLogMessage("Request with Authorization: Bearer mysecrettoken");
    expect(result).toBe("Request with Authorization: Bearer [REDACTED]");
  });

  it("redacts email addresses in log messages", () => {
    const result = sanitizeLogMessage("User login: admin@example.com succeeded");
    expect(result).toBe("User login: [REDACTED] succeeded");
  });

  it("redacts Stripe keys in log messages", () => {
    const result = sanitizeLogMessage("Stripe key: sk_test_abcdef");
    expect(result).toBe("Stripe key: [REDACTED]");
  });

  it("returns safe strings unchanged", () => {
    const result = sanitizeLogMessage("Server started on port 3000");
    expect(result).toBe("Server started on port 3000");
  });
});
