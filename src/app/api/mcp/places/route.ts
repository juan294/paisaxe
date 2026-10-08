import { rateLimitResponse } from "@/lib/request-rate-limit";
import { getEnv } from "@/lib/env";
import { NextResponse } from "next/server";
import { checkRateLimit, normalizeIpForRateLimit } from "@/lib/rate-limit";
import { validateMcpSecret } from "@/lib/mcp-auth";
import { getClientIp } from "@/lib/request-utils";
import { withRouteContext } from "@/lib/request-validation";
import { logger } from "@/lib/logger";
import { placesPostRequestSchema, placesQuerySchema } from "@/lib/schemas";

/**
 * MCP-compatible Places API endpoint for ElevenLabs voice agents.
 * Searches for restaurants, attractions, and points of interest in Asturias.
 * Uses Google Places API (New) - the modern version.
 *
 * GET /api/mcp/places?query=fabada&type=restaurant&city=Oviedo
 * POST /api/mcp/places (MCP tool call format)
 */

// Rate limit: 20 requests per minute per caller (Google Places API is expensive).
// BE-M1 (#782): every caller here is ElevenLabs' own backend, not an individual
// visitor device, so this bucket is keyed on a per-conversation identifier when
// the request supplies one (falling back to IP) purely for fairness between
// concurrent voice conversations. That identifier is caller-supplied and
// unverified — see PLACES_GLOBAL_RATE_LIMIT below for the real abuse ceiling.
const PLACES_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 20,
  maxEntries: 10_000,
};

// BE-M1 (#782): a single shared bucket that caps total tool-call volume across
// every caller regardless of conversation/IP. This is the real cost/abuse
// control — it cannot be bypassed by supplying a fresh conversationId — sized
// well above PLACES_RATE_LIMIT so several concurrent voice conversations don't
// starve each other while still bounding worst-case Google Places spend.
const PLACES_GLOBAL_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 120,
  maxEntries: 10,
};
const PLACES_GLOBAL_RATE_LIMIT_KEY = "mcp-places:global";

// Places API (New) response types
interface PlacesApiPlace {
  id: string;
  displayName?: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

interface PlacesApiResponse {
  places?: PlacesApiPlace[];
  error?: {
    message: string;
    status: string;
  };
}

interface Place {
  name: string;
  address: string;
  rating: number | null;
  reviews_count: number;
  price_level: number | null;
  types: string[];
  location: {
    lat: number;
    lng: number;
  };
  is_open: boolean | null;
  opening_hours: string[] | null;
  phone_number: string | null;
  international_phone: string | null;
  website: string | null;
  place_id: string;
}

interface PlacesResponse {
  places: Place[];
  query: string;
  city: string | null;
  type: string | null;
}


// City coordinates for location-biased searches
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  oviedo: { lat: 43.3619, lng: -5.8494 },
  gijón: { lat: 43.5453, lng: -5.6619 },
  gijon: { lat: 43.5453, lng: -5.6619 },
  avilés: { lat: 43.5547, lng: -5.9245 },
  aviles: { lat: 43.5547, lng: -5.9245 },
  llanes: { lat: 43.4214, lng: -4.7562 },
  "cangas de onís": { lat: 43.3497, lng: -5.1303 },
  "cangas de onis": { lat: 43.3497, lng: -5.1303 },
  cudillero: { lat: 43.5636, lng: -6.1461 },
  luarca: { lat: 43.5444, lng: -6.5369 },
  ribadesella: { lat: 43.4608, lng: -5.0589 },
  villaviciosa: { lat: 43.4803, lng: -5.4381 },
  mieres: { lat: 43.2506, lng: -5.7667 },
  langreo: { lat: 43.3069, lng: -5.6958 },
  covadonga: { lat: 43.3103, lng: -5.0531 },
};

// Center of Asturias for default searches
const ASTURIAS_CENTER = { lat: 43.3619, lng: -5.8494 };
const DEFAULT_RADIUS = 50000; // 50km radius for Asturias-wide searches
const CITY_RADIUS = 10000; // 10km radius for city-specific searches

// Valid place types for Google Places API
const VALID_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_delivery",
  "meal_takeaway",
  "tourist_attraction",
  "museum",
  "park",
  "point_of_interest",
  "lodging",
  "spa",
];

// Convert priceLevel string to number (PRICE_LEVEL_FREE=0, PRICE_LEVEL_INEXPENSIVE=1, etc.)
function priceLevelToNumber(priceLevel?: string): number | null {
  if (!priceLevel) return null;
  const levels: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return levels[priceLevel] ?? null;
}

function transformPlace(result: PlacesApiPlace): Place {
  return {
    name: result.displayName?.text || "Unknown",
    address: result.formattedAddress || "",
    rating: result.rating ?? null,
    reviews_count: result.userRatingCount ?? 0,
    price_level: priceLevelToNumber(result.priceLevel),
    types: (result.types || []).filter(
      (t) => !t.includes("_") || VALID_TYPES.includes(t)
    ),
    location: {
      lat: result.location?.latitude || 0,
      lng: result.location?.longitude || 0,
    },
    is_open: result.regularOpeningHours?.openNow ?? null,
    opening_hours: result.regularOpeningHours?.weekdayDescriptions ?? null,
    phone_number: result.nationalPhoneNumber ?? null,
    international_phone: result.internationalPhoneNumber ?? null,
    website: result.websiteUri ?? null,
    place_id: result.id,
  };
}

async function searchPlaces(
  query: string,
  type?: string,
  city?: string
): Promise<PlacesResponse> {
  const apiKey = getEnv("GOOGLE_PLACES_API_KEY");

  if (!apiKey) {
    throw new Error("Places API not configured");
  }

  // Determine location and radius based on city
  let location = ASTURIAS_CENTER;
  let radius = DEFAULT_RADIUS;

  if (city) {
    const normalizedCity = city.toLowerCase().trim();
    const cityCoords = CITY_COORDINATES[normalizedCity];
    if (cityCoords) {
      location = cityCoords;
      radius = CITY_RADIUS;
    }
  }

  // Build request for Places API (New)
  //
  // SE-L1 (SSRF guard): baseUrl MUST remain a hardcoded constant pointing to the
  // official Google Places API. It MUST NOT be derived from, influenced by, or
  // interpolated with any value sourced from the incoming request (query params,
  // body, headers). All user-supplied input goes into the JSON body (textQuery,
  // locationBias) which is sent to this fixed endpoint — never into the URL itself.
  // Any future refactor that parameterises this URL MUST undergo security review.
  const baseUrl = "https://places.googleapis.com/v1/places:searchText";

  // Build the request body
  const requestBody: {
    textQuery: string;
    languageCode: string;
    maxResultCount: number;
    locationBias: {
      circle: {
        center: { latitude: number; longitude: number };
        radius: number;
      };
    };
    includedType?: string;
  } = {
    textQuery: `${query} Asturias`,
    languageCode: "es",
    maxResultCount: 5,
    locationBias: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radius,
      },
    },
  };

  // Add type filter if valid
  if (type && VALID_TYPES.includes(type)) {
    requestBody.includedType = type;
  }

  // Fields to request (controls billing)
  // Note: nationalPhoneNumber, internationalPhoneNumber, websiteUri are Contact fields
  // weekdayDescriptions requires regularOpeningHours to be included
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.types",
    "places.location",
    "places.regularOpeningHours",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
  ].join(",");

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Places API error: ${response.status} - ${errorText}`);
  }

  const data: PlacesApiResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "API request denied");
  }

  if (!data.places?.length) {
    return {
      places: [],
      query,
      city: city || null,
      type: type || null,
    };
  }

  // Transform results
  const places = data.places.map(transformPlace);

  return {
    places,
    query,
    city: city || null,
    type: type || null,
  };
}


// BE-M1 (#782): pull a caller-supplied conversation identifier out of the
// request body, tolerating both the camelCase and snake_case spellings
// ElevenLabs uses elsewhere (see src/app/api/mcp/save-favorite/route.ts).
// Absence is expected and safe — callers fall back to IP-keyed rate limiting.
function extractConversationId(source: unknown): string | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const raw = record.conversationId ?? record.conversation_id;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  return trimmed;
}

function buildPerCallerRateLimitKey(conversationId: string | null, ip: string): string {
  return conversationId
    ? `mcp-places:conv:${conversationId}`
    : `mcp-places:ip:${normalizeIpForRateLimit(ip)}`;
}

interface RateLimitCheck {
  allowed: boolean;
  retryAfter?: number;
}

// BE-M1 (#782): check the global cost-cap bucket first (the real ceiling,
// immune to a spoofed conversationId), then the per-caller fairness bucket.
// Sequential and short-circuiting on purpose: a request already rejected by
// the global bucket must not also consume a slot from the per-caller bucket.
async function checkPlacesRateLimits(
  conversationId: string | null,
  ip: string
): Promise<RateLimitCheck> {
  const globalCheck = await checkRateLimit(PLACES_GLOBAL_RATE_LIMIT_KEY, PLACES_GLOBAL_RATE_LIMIT);
  if (!globalCheck.allowed) {
    return { allowed: false, retryAfter: globalCheck.retryAfter };
  }

  const perCallerKey = buildPerCallerRateLimitKey(conversationId, ip);
  return checkRateLimit(perCallerKey, PLACES_RATE_LIMIT);
}

function tooManyRequestsResponse(retryAfter?: number): NextResponse {
  return rateLimitResponse({ error: "Too many requests" }, { retryAfter });
}

// BE-M8 (#789): a safe, stable response for any failure inside searchPlaces().
// The raw error (which can include upstream hostnames, quota detail, or other
// internal information) is logged server-side and, in development only,
// surfaced under `debug` — never spoken back to the visitor by Pelayo.
function placesLookupFailedResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Unknown error";

  // This is our own static, non-sensitive config message (also returned
  // directly by the pre-flight env check above) — safe to pass through as-is.
  if (message === "Places API not configured") {
    return NextResponse.json(
      { error: message, code: "PLACES_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  logger.error("[MCP_PLACES_LOOKUP_FAILED]", { error: message });

  const body: { error: string; code: string; debug?: { message: string } } = {
    error:
      "No se pudo completar la búsqueda de lugares en este momento. Inténtalo de nuevo en unos segundos.",
    code: "PLACES_LOOKUP_FAILED",
  };
  if (process.env.NODE_ENV === "development") {
    body.debug = { message };
  }

  return NextResponse.json(body, { status: 500 });
}

export async function GET(request: Request): Promise<NextResponse> {
  return withRouteContext(request, () => handleGet(request));
}

async function handleGet(request: Request): Promise<NextResponse> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const conversationId = extractConversationId({
    conversationId: searchParams.get("conversationId") ?? undefined,
    conversation_id: searchParams.get("conversation_id") ?? undefined,
  });
  const ip = getClientIp(request);
  const rateCheck = await checkPlacesRateLimits(conversationId, ip);
  if (!rateCheck.allowed) {
    return tooManyRequestsResponse(rateCheck.retryAfter);
  }

  // Normalise: absent params become empty string so Zod min(1) fires with
  // our custom message instead of "expected string, received undefined".
  const rawParams = {
    query: searchParams.get("query") ?? "",
    type: searchParams.get("type") ?? undefined,
    city: searchParams.get("city") ?? undefined,
  };
  const queryParsed = placesQuerySchema.safeParse(rawParams);
  if (!queryParsed.success) {
    const firstIssue = queryParsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid query parameters" },
      { status: 400 }
    );
  }
  const { query, type, city } = queryParsed.data;

  if (!getEnv("GOOGLE_PLACES_API_KEY")) {
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  try {
    const results = await searchPlaces(query, type, city);
    return NextResponse.json(results, {
      headers: {
        // BE-L6 (#799): this response is only reachable with a valid
        // x-mcp-secret header. `public` would let any shared/CDN cache store
        // and replay it to a requester who never presented the secret.
        // `private` still lets the authenticated caller's own HTTP client
        // reuse the response for 1 hour (avoiding a repeat Google Places
        // charge for the same caller/query), just not via a shared cache.
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour (caller-private)
      },
    });
  } catch (err) {
    return placesLookupFailedResponse(err);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return withRouteContext(request, () => handlePost(request));
}

async function handlePost(request: Request): Promise<NextResponse> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Malformed JSON falls through to schema validation below, which
    // rejects it with a 400 rather than leaking a JSON-parser error message.
  }

  const conversationId = extractConversationId(body);
  const ip = getClientIp(request);
  const rateCheck = await checkPlacesRateLimits(conversationId, ip);
  if (!rateCheck.allowed) {
    return tooManyRequestsResponse(rateCheck.retryAfter);
  }

  const paramsParsed = placesPostRequestSchema.safeParse(body);

  // Validate the request before checking upstream configuration, matching GET
  // above. A malformed request is the caller's error whatever the server's
  // Google credentials look like; answering 500 hid this from the probe that
  // asserts the contract — a probe that had never run.
  if (!paramsParsed.success) {
    const firstIssue = paramsParsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid query parameters" },
      { status: 400 }
    );
  }

  if (!getEnv("GOOGLE_PLACES_API_KEY")) {
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  const { query, type, city } = paramsParsed.data;

  try {
    const results = await searchPlaces(query, type, city);
    return NextResponse.json(results, {
      headers: {
        // BE-L6 (#799): see the Cache-Control comment in handleGet above —
        // same authenticated audience, same reasoning, kept identical
        // between GET/POST intentionally (#614).
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour (matches GET)
      },
    });
  } catch (err) {
    return placesLookupFailedResponse(err);
  }
}
