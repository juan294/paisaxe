/**
 * Shared Zod schemas for runtime validation across API routes.
 *
 * Design goals:
 * - UUID validation for foreign-key fields
 * - String length limits on all user-supplied text
 * - Numeric bounds checks (party_size, etc.)
 * - Phone-number shape validation (Spanish E.164 / national)
 * - Deny arbitrary metadata objects: require explicit shape
 *
 * Import pattern:
 *   import { bookingSchema, favoriteSchema, ... } from "@/lib/schemas";
 */

import { z } from "zod";
import { STORY_SOURCE_TYPES } from "@/types/immersive";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Any valid UUID v4 string. */
const uuidSchema = z.string().uuid();

/** Non-empty string trimmed to at most `max` characters. */
const boundedString = (max: number, min = 1) =>
  z.string().trim().min(min).max(max);

/**
 * Phone number field — basic bounds only.
 * Format validation (Spanish E.164 / national) is handled by isValidSpanishPhone()
 * in the route, which supports flexible space/dash separators.
 */
const spanishPhoneSchema = z.string().trim().min(9).max(20);

// ---------------------------------------------------------------------------
// make-booking
// ---------------------------------------------------------------------------

const makeBookingSchema = z.object({
  venue_name: boundedString(200),
  phone_number: spanishPhoneSchema,
  party_size: z
    .number()
    .int("party_size must be an integer")
    .min(1, "party_size must be at least 1")
    .max(50, "party_size must not exceed 50"),
  date: boundedString(100),
  time: boundedString(100),
  customer_name: boundedString(200),
  customer_phone: spanishPhoneSchema,
  special_requests: boundedString(500, 0).optional(),
  language: z.enum(["es", "en"]).optional(),
});

/** Wraps flat and MCP-nested payloads. */
export const makeBookingRequestSchema = z.union([
  makeBookingSchema,
  z.object({ arguments: makeBookingSchema }).transform((v) => v.arguments),
]);

// ---------------------------------------------------------------------------
// favorites
// ---------------------------------------------------------------------------

export const favoritesPostSchema = z.object({
  storyIds: z
    .array(uuidSchema)
    .min(1, "storyIds array must not be empty"),
});

// ---------------------------------------------------------------------------
// admin/stories POST (create)
// ---------------------------------------------------------------------------

export const createStorySchema = z.object({
  title: boundedString(300),
  category: z.enum(["nature", "cities", "food", "culture", "activities"]),
  slug: boundedString(300).optional(),
  subtitle: boundedString(500).optional(),
  description: boundedString(5000).optional(),
  location: z.enum(["eastern", "central", "western"]).optional(),
  duration: z.enum(["day-trip", "weekend", "week"]).optional(),
  sourcePdf: boundedString(500).optional(),
  bestMonths: z.array(z.number().int().min(1).max(12)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  displayOrder: z.number().int().min(0).optional(),
  sourceType: z.enum(STORY_SOURCE_TYPES).optional(),
  suggestionId: uuidSchema.optional(),
});

// ---------------------------------------------------------------------------
// suggestions POST
// ---------------------------------------------------------------------------

export const createSuggestionSchema = z.object({
  placeName: boundedString(100, 3),
  comment: boundedString(500).optional(),
  location: z.enum(["eastern", "central", "western"]).optional(),
  attribution: boundedString(100).optional(),
  /** Honeypot field: bots fill this, humans never see it (display:none in form). */
  website: z.string().optional(),
});

// ---------------------------------------------------------------------------
// webhooks/translate
// ---------------------------------------------------------------------------

export const translateWebhookSchema = z.object({
  storyId: uuidSchema,
  locales: z
    .array(z.enum(["en", "fr", "de", "pt", "ast"]))
    .optional(),
  forceRetranslate: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// admin/stories/[id] PATCH (update)
// ---------------------------------------------------------------------------

/**
 * Nullable bounded string — allows empty/whitespace-only values (converted to
 * null by the route handler) while still enforcing an upper length limit.
 */
const nullableBoundedString = (max: number) => z.string().trim().max(max).optional().nullable();

export const updateStorySchema = z.object({
  title: boundedString(300).optional(),
  slug: boundedString(300).optional(),
  subtitle: nullableBoundedString(500),
  description: nullableBoundedString(5000),
  category: z.enum(["nature", "cities", "food", "culture", "activities"]).optional(),
  location: z.enum(["eastern", "central", "western"]).optional().nullable(),
  duration: z.enum(["day-trip", "weekend", "week"]).optional().nullable(),
  sourcePdf: nullableBoundedString(500),
  bestMonths: z.array(z.number().int().min(1).max(12)).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// admin/stories/bulk-delete DELETE
// ---------------------------------------------------------------------------

export const bulkDeleteStoriesSchema = z.object({
  storyIds: z.array(uuidSchema).min(1, "storyIds must contain at least one ID"),
});

// ---------------------------------------------------------------------------
// admin/stories/bulk-status PUT
// ---------------------------------------------------------------------------

export const bulkStatusStoriesSchema = z.object({
  storyIds: z.array(uuidSchema).min(1, "storyIds must contain at least one ID"),
  status: z.enum(["needs_curation", "approved"]),
});

// ---------------------------------------------------------------------------
// admin/marketing/agent POST (agent chat)
// ---------------------------------------------------------------------------

const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000, "History message content must not exceed 4000 characters"),
});

export const agentChatRequestSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  message: z.string().trim().min(1, "Message is required").max(4000, "Message must not exceed 4000 characters"),
  conversationHistory: z
    .array(conversationMessageSchema)
    .max(20, "conversationHistory must not exceed 20 items")
    .optional(),
});

// ---------------------------------------------------------------------------
// admin/marketing/posts POST (create draft)
// ---------------------------------------------------------------------------

export const marketingDraftSchema = z.object({
  platform: z.enum(["x", "instagram", "pinterest"]),
  content: z.string().min(1, "content is required").max(5000),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string().max(100)).optional(),
  linkUrl: z.string().url().optional(),
  scheduledFor: z.string().optional(),
  storyId: uuidSchema.optional(),
  contentTheme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// admin/marketing/posts PATCH (update draft)
// ---------------------------------------------------------------------------

export const marketingDraftPatchSchema = z.object({
  platform: z.enum(["x", "instagram", "pinterest"]).optional(),
  content: z.string().min(1).max(5000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string().max(100)).optional(),
  linkUrl: z.string().url().optional(),
  scheduledFor: z.string().optional(),
  storyId: uuidSchema.optional(),
  contentTheme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// admin/feature-flags/[key] PUT
// ---------------------------------------------------------------------------

export const updateFeatureFlagSchema = z
  .object({
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.enabled !== undefined || data.config !== undefined, {
    message: "Must provide enabled (boolean) or config (object)",
  });

// ---------------------------------------------------------------------------
// chat POST (shared by /api/chat and /api/chat/stream)
// ---------------------------------------------------------------------------

export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(500, "Message exceeds maximum length of 500 characters"),
  context: z.string().max(600, "Context exceeds maximum length of 600 characters").optional(),
  messageIndex: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// admin/agent-config PUT
// ---------------------------------------------------------------------------

/** Toggle master switch. */
export const agentConfigMasterSchema = z.object({
  master_enabled: z.boolean(),
});

/** Enable/disable an individual agent. */
export const agentConfigEnableSchema = z.object({
  key: z.string().min(1).max(200),
  enabled: z.boolean().optional(),
  config_key: z.string().min(1).max(200).optional(),
  value: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// admin/suggestions/[id] PUT
// ---------------------------------------------------------------------------

export const updateSuggestionSchema = z.object({
  status: z.enum(["pending", "reviewed", "converted", "rejected"]).optional(),
  adminNotes: z.string().max(2000).optional(),
}).refine((data) => data.status !== undefined || data.adminNotes !== undefined, {
  message: "No updates provided",
});

// ---------------------------------------------------------------------------
// checkout (day-pass and embedded) POST
// ---------------------------------------------------------------------------

export const checkoutBodySchema = z.object({
  returnTo: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i).max(100).optional(),
});

// ---------------------------------------------------------------------------
// mcp/places GET query params
// ---------------------------------------------------------------------------

export const placesQuerySchema = z.object({
  query: z
    .string()
    .min(1, "Query parameter is required")
    .max(200)
    .describe("query"),
  type: z.string().max(100).optional(),
  city: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// mcp/weather GET query params
// ---------------------------------------------------------------------------

export const weatherQuerySchema = z.object({
  city: z
    .string()
    .min(1, "City parameter is required")
    .max(200)
    .describe("city"),
});
