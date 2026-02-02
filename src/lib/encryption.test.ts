import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  isEncryptionConfigured,
} from "./encryption";

describe("encryption", () => {
  // Generate a valid 32-byte key encoded as base64
  const validKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  const originalEnv = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = validKey;
  });

  afterEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = originalEnv;
  });

  describe("encrypt/decrypt", () => {
    it("encrypts and decrypts a string correctly", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext for the same plaintext (due to random IV)", () => {
      const plaintext = "Test message";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("handles empty strings", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      const plaintext = "Hello 世界 🌍 مرحبا";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("throws error when decrypting with wrong key", () => {
      const plaintext = "Secret message";
      const encrypted = encrypt(plaintext);

      // Change the key
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from(
        "abcdefghijklmnopabcdefghijklmnop"
      ).toString("base64");

      expect(() => decrypt(encrypted)).toThrow();
    });

    it("throws error when decrypting tampered ciphertext", () => {
      const plaintext = "Secret message";
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext
      const buffer = Buffer.from(encrypted, "base64");
      buffer[buffer.length - 1] ^= 0xff; // Flip bits in last byte
      const tampered = buffer.toString("base64");

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("encryptJson/decryptJson", () => {
    it("encrypts and decrypts JSON objects", () => {
      const data = { accessToken: "token123", refreshToken: "refresh456" };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("handles nested objects", () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: "Test",
            email: "test@example.com",
          },
        },
        tokens: ["a", "b", "c"],
      };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("handles arrays", () => {
      const data = [1, 2, 3, "four", { five: 5 }];
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });
  });

  describe("isEncryptionConfigured", () => {
    it("returns true when key is set correctly", () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("returns false when key is not set", () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("returns false when key is wrong length", () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws error when key is not set for encrypt", () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("CREDENTIALS_ENCRYPTION_KEY environment variable is not set");
    });

    it("throws error when key is not set for decrypt", () => {
      const encrypted = encrypt("test");
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      expect(() => decrypt(encrypted)).toThrow("CREDENTIALS_ENCRYPTION_KEY environment variable is not set");
    });

    it("throws error when key is wrong length", () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
      expect(() => encrypt("test")).toThrow("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes");
    });
  });
});
