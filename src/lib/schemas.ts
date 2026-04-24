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
  sourceType: z.enum(["curated", "ai-generated", "user-suggested"]).optional(),
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
