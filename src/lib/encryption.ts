/**
 * Encryption utilities for sensitive data
 *
 * Uses AES-256-GCM for authenticated encryption.
 * The encryption key must be stored as an environment variable,
 * NOT in the database.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment variable.
 * Key must be 32 bytes (256 bits) encoded as base64.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (256 bits) encoded as base64"
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64 string containing: IV + AuthTag + Ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a string encrypted with the encrypt function.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  // Extract IV, AuthTag, and Ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt a JSON object.
 */
export function encryptJson<T>(data: T): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt a JSON object.
 */
export function decryptJson<T>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext));
}

/**
 * Check if encryption is properly configured.
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
