/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isEncryptedCredentials,
  isPlainCredentials,
  getDecryptedCredentials,
  hasValidCredentials,
} from "./credentials";
import type { MarketingAccountRow } from "@/types/marketing";

// Mock encryption module
vi.mock("./encryption", () => ({
  decryptJson: vi.fn((ciphertext: string) => {
    if (ciphertext === "valid-encrypted-data") {
      return { accessToken: "decrypted-token", refreshToken: "decrypted-refresh" };
    }
    throw new Error("Decryption failed");
  }),
  isEncryptionConfigured: vi.fn(() => true),
}));

describe("credentials", () => {
  describe("isEncryptedCredentials", () => {
    it("returns true for encrypted credentials", () => {
      const credentials = { encrypted: "some-encrypted-string" };
      expect(isEncryptedCredentials(credentials)).toBe(true);
    });

    it("returns false for plain credentials", () => {
      const credentials = { accessToken: "token", refreshToken: "refresh" };
      expect(isEncryptedCredentials(credentials)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isEncryptedCredentials(null)).toBe(false);
    });

    it("returns false when encrypted is not a string", () => {
      const credentials = { encrypted: 123 };
      expect(isEncryptedCredentials(credentials as any)).toBe(false);
    });
  });

  describe("isPlainCredentials", () => {
    it("returns true for plain credentials", () => {
      const credentials = { accessToken: "token", refreshToken: "refresh" };
      expect(isPlainCredentials(credentials)).toBe(true);
    });

    it("returns false for encrypted credentials", () => {
      const credentials = { encrypted: "some-encrypted-string" };
      expect(isPlainCredentials(credentials)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isPlainCredentials(null)).toBe(false);
    });

    it("returns false when accessToken is not a string", () => {
      const credentials = { accessToken: 123 };
      expect(isPlainCredentials(credentials as any)).toBe(false);
    });
  });

  describe("getDecryptedCredentials", () => {
    it("returns null when credentials are null", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: null,
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(getDecryptedCredentials(row)).toBeNull();
    });

    it("returns plain credentials directly", () => {
      const credentials = { accessToken: "plain-token", refreshToken: "plain-refresh" };
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials,
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(getDecryptedCredentials(row)).toEqual(credentials);
    });

    it("decrypts encrypted credentials", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { encrypted: "valid-encrypted-data" },
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = getDecryptedCredentials(row);
      expect(result).toEqual({
        accessToken: "decrypted-token",
        refreshToken: "decrypted-refresh",
      });
    });

    it("returns null and logs warning for unknown format", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { unknown: "format" } as any,
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(getDecryptedCredentials(row)).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Unknown credentials format for account:",
        "acc-1"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getDecryptedCredentials with encryption not configured", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("throws error when encryption not configured for encrypted credentials", async () => {
      // Re-mock with isEncryptionConfigured returning false
      vi.doMock("./encryption", () => ({
        decryptJson: vi.fn(),
        isEncryptionConfigured: vi.fn(() => false),
      }));

      const { getDecryptedCredentials: getDecryptedCredentialsNoCrypto } = await import(
        "./credentials"
      );

      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { encrypted: "some-data" },
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(() => getDecryptedCredentialsNoCrypto(row)).toThrow(
        "Cannot decrypt credentials: CREDENTIALS_ENCRYPTION_KEY not configured"
      );
    });
  });

  describe("hasValidCredentials", () => {
    it("returns true for encrypted credentials", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { encrypted: "data" },
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(hasValidCredentials(row)).toBe(true);
    });

    it("returns true for plain credentials", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { accessToken: "token", refreshToken: "refresh" },
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(hasValidCredentials(row)).toBe(true);
    });

    it("returns false for null credentials", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: null,
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(hasValidCredentials(row)).toBe(false);
    });

    it("returns false for unknown format", () => {
      const row: MarketingAccountRow = {
        id: "acc-1",
        platform: "x",
        account_name: "test",
        credentials: { unknown: "format" } as any,
        account_handle: null,
        platform_user_id: null,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(hasValidCredentials(row)).toBe(false);
    });
  });
});
