/**
 * Credential management utilities for marketing accounts
 *
 * Handles encryption/decryption of OAuth credentials for social media platforms.
 * Credentials are stored encrypted in the database and decrypted only when
 * needed for API calls.
 */

import { decryptJson, isEncryptionConfigured } from "./encryption";
import type {
  MarketingCredentials,
  EncryptedCredentials,
  MarketingAccountRow,
} from "@/types/marketing";

/**
 * Type guard to check if credentials are in encrypted format
 */
export function isEncryptedCredentials(
  credentials: unknown
): credentials is EncryptedCredentials {
  return (
    typeof credentials === "object" &&
    credentials !== null &&
    "encrypted" in credentials &&
    typeof credentials.encrypted === "string" &&
    credentials.encrypted.length > 0
  );
}

/**
 * Get decrypted credentials from an account row.
 *
 * @throws Error if encryption is not configured and credentials are encrypted
 * @throws Error if decryption fails (e.g., wrong key)
 * @throws Error if credentials are present but not encrypted
 */
export function getDecryptedCredentials(
  row: MarketingAccountRow
): MarketingCredentials | null {
  if (!row.credentials) {
    return null;
  }

  // Handle encrypted credentials
  if (isEncryptedCredentials(row.credentials)) {
    if (!isEncryptionConfigured()) {
      throw new Error(
        "Cannot decrypt credentials: CREDENTIALS_ENCRYPTION_KEY not configured"
      );
    }
    return decryptJson<MarketingCredentials>(row.credentials.encrypted);
  }

  throw new Error(`Marketing account credentials must be encrypted: ${row.id}`);
}

/**
 * Check if an account has valid credentials (without decrypting them)
 */
export function hasValidCredentials(row: MarketingAccountRow): boolean {
  return isEncryptedCredentials(row.credentials);
}
