/**
 * Test X (Twitter) Credentials
 *
 * This script verifies that the stored X credentials work by:
 * 1. Fetching the encrypted credentials from the database
 * 2. Decrypting them
 * 3. Posting a test tweet
 * 4. Optionally deleting the tweet
 *
 * Usage:
 *   npx tsx scripts/test-x-credentials.ts
 *   npx tsx scripts/test-x-credentials.ts --delete <tweet_id>
 */

import { createClient } from "@supabase/supabase-js";
import { TwitterApi } from "twitter-api-v2";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY!;

// Encryption imports (inline to avoid module resolution issues)
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function decrypt(ciphertext: string): string {
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "base64");
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

interface Credentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  refreshToken: string; // This is actually the Access Token Secret for OAuth 1.0a
}

async function getXCredentials(): Promise<Credentials> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from("marketing_accounts")
    .select("credentials")
    .eq("platform", "x")
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch X account: ${error?.message}`);
  }

  const { credentials } = data;

  if (!credentials) {
    throw new Error("No credentials found for X account");
  }

  // Handle encrypted credentials
  if ("encrypted" in credentials) {
    const decrypted = decrypt(credentials.encrypted);
    return JSON.parse(decrypted);
  }

  // Legacy plain credentials
  return credentials as Credentials;
}

async function postTestTweet(credentials: Credentials): Promise<string> {
  // Create Twitter client with OAuth 1.0a User Context
  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.refreshToken, // Access Token Secret
  });

  const testMessage = `🔧 Test post from Paisaxe - verifying API credentials (${new Date().toISOString()})`;

  console.log("Posting test tweet...");
  console.log(`Message: "${testMessage}"`);

  const { data } = await client.v2.tweet(testMessage);

  console.log("\n✅ Tweet posted successfully!");
  console.log(`Tweet ID: ${data.id}`);
  console.log(`View at: https://x.com/elpaisaxe/status/${data.id}`);

  return data.id;
}

async function deleteTweet(credentials: Credentials, tweetId: string): Promise<void> {
  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.refreshToken,
  });

  console.log(`Deleting tweet ${tweetId}...`);

  await client.v2.deleteTweet(tweetId);

  console.log("✅ Tweet deleted successfully!");
}

async function verifyCredentials(credentials: Credentials): Promise<void> {
  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.refreshToken,
  });

  console.log("Verifying credentials with /users/me endpoint...");
  const { data } = await client.v2.me();
  console.log(`✅ Authenticated as: @${data.username} (${data.name})`);
  console.log(`   User ID: ${data.id}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const deleteMode = args[0] === "--delete";
  const verifyOnly = args[0] === "--verify";
  const tweetIdToDelete = args[1];

  try {
    // Validate environment
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }
    if (!ENCRYPTION_KEY) {
      throw new Error("Missing CREDENTIALS_ENCRYPTION_KEY");
    }

    console.log("Fetching X credentials from database...");
    const credentials = await getXCredentials();
    console.log("✅ Credentials decrypted successfully\n");

    // Always verify first
    await verifyCredentials(credentials);

    if (verifyOnly) {
      console.log("Verification complete. Use without --verify to post a test tweet.");
      return;
    }

    if (deleteMode) {
      if (!tweetIdToDelete) {
        throw new Error("Please provide tweet ID to delete: --delete <tweet_id>");
      }
      await deleteTweet(credentials, tweetIdToDelete);
    } else {
      const tweetId = await postTestTweet(credentials);
      console.log(`\nTo delete this tweet, run:`);
      console.log(`npx tsx scripts/test-x-credentials.ts --delete ${tweetId}`);
    }
  } catch (error: unknown) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);

    // Check for Twitter API specific errors
    if (error && typeof error === 'object' && 'data' in error) {
      const apiError = error as { data?: { detail?: string; title?: string; errors?: Array<{ message: string }> } };
      if (apiError.data) {
        console.error("\nAPI Error Details:");
        if (apiError.data.title) console.error(`  Title: ${apiError.data.title}`);
        if (apiError.data.detail) console.error(`  Detail: ${apiError.data.detail}`);
        if (apiError.data.errors) {
          apiError.data.errors.forEach((e, i) => {
            console.error(`  Error ${i + 1}: ${e.message}`);
          });
        }
      }
    }

    process.exit(1);
  }
}

main();
