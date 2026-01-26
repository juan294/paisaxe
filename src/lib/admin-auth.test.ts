import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { validateAdminAuth } from "./admin-auth";

describe("admin-auth", () => {
  const originalEnv = process.env.ADMIN_SECRET_KEY;

  beforeEach(() => {
    process.env.ADMIN_SECRET_KEY = "test-secret-key";
  });

  afterEach(() => {
    process.env.ADMIN_SECRET_KEY = originalEnv;
  });

  describe("validateAdminAuth", () => {
    it("should return valid true for correct authorization", () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "Bearer test-secret-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(true);
      expect("error" in result).toBe(false);
    });

    it("should return 500 when ADMIN_SECRET_KEY is not configured", async () => {
      delete process.env.ADMIN_SECRET_KEY;

      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "Bearer some-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        const errorData = await result.error.json();
        expect(result.error.status).toBe(500);
        expect(errorData.error).toBe("Server configuration error");
      }
    });

    it("should return 401 when authorization header is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories");

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        const errorData = await result.error.json();
        expect(result.error.status).toBe(401);
        expect(errorData.error).toBe("Authorization header required");
      }
    });

    it("should return 401 for invalid authorization format - missing Bearer", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "test-secret-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        const errorData = await result.error.json();
        expect(result.error.status).toBe(401);
        expect(errorData.error).toBe("Invalid authorization format. Expected: Bearer {token}");
      }
    });

    it("should return 401 for invalid authorization format - wrong scheme", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "Basic test-secret-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(401);
      }
    });

    it("should return 403 for invalid admin key", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "Bearer wrong-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        const errorData = await result.error.json();
        expect(result.error.status).toBe(403);
        expect(errorData.error).toBe("Invalid admin key");
      }
    });

    it("should be case-insensitive for Bearer scheme", () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "bearer test-secret-key",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(true);
    });

    it("should reject keys that differ only in length", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/stories", {
        headers: {
          authorization: "Bearer test-secret-key-extra",
        },
      });

      const result = validateAdminAuth(request);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.status).toBe(403);
      }
    });
  });
});
