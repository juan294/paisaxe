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
  credentials: MarketingCredentials | EncryptedCredentials | null
): credentials is EncryptedCredentials {
  return (
    credentials !== null &&
    "encrypted" in credentials &&
    typeof credentials.encrypted === "string"
  );
}

/**
 * Type guard to check if credentials are in plain format (legacy)
 */
export function isPlainCredentials(
  credentials: MarketingCredentials | EncryptedCredentials | null
): credentials is MarketingCredentials {
  return (
    credentials !== null &&
    "accessToken" in credentials &&
    typeof credentials.accessToken === "string"
  );
}

/**
 * Get decrypted credentials from an account row.
 * Handles both encrypted and legacy plain formats.
 *
 * @throws Error if encryption is not configured and credentials are encrypted
 * @throws Error if decryption fails (e.g., wrong key)
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

  // Handle legacy plain credentials (backwards compatibility)
  if (isPlainCredentials(row.credentials)) {
    return row.credentials;
  }

  // Unknown format
  console.warn("Unknown credentials format for account:", row.id);
  return null;
}

/**
 * Check if an account has valid credentials (without decrypting them)
 */
export function hasValidCredentials(row: MarketingAccountRow): boolean {
  return isEncryptedCredentials(row.credentials) || isPlainCredentials(row.credentials);
}
