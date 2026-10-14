import { rateLimitResponse } from "@/lib/request-rate-limit";
import { getEnv } from "@/lib/env";
import { NextResponse } from "next/server";
import { checkRateLimit, normalizeIpForRateLimit } from "@/lib/rate-limit";
import { validateMcpSecret } from "@/lib/mcp-auth";
import { getClientIp } from "@/lib/request-utils";
import { withRouteContext } from "@/lib/request-validation";
import { logger } from "@/lib/logger";
import { weatherPostRequestSchema, weatherQuerySchema } from "@/lib/schemas";

/**
 * MCP-compatible Weather API endpoint for ElevenLabs voice agents.
 * Provides current weather data for cities in Asturias.
 *
 * GET /api/mcp/weather?city=Oviedo
 * POST /api/mcp/weather (MCP tool call format)
 */

// Rate limit: 30 requests per minute per caller (weather API is relatively cheap).
// BE-M1 (#782): every caller here is ElevenLabs' own backend, not an individual
// visitor device, so this bucket is keyed on a per-conversation identifier when
// the request supplies one (falling back to IP) purely for fairness between
// concurrent voice conversations. That identifier is caller-supplied and
// unverified — see WEATHER_GLOBAL_RATE_LIMIT below for the real abuse ceiling.
const WEATHER_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
  maxEntries: 10_000,
};

// BE-M1 (#782): a single shared bucket that caps total tool-call volume across
// every caller regardless of conversation/IP. This is the real cost/abuse
// control — it cannot be bypassed by supplying a fresh conversationId — sized
// well above WEATHER_RATE_LIMIT so several concurrent voice conversations
// don't starve each other.
const WEATHER_GLOBAL_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 180,
  maxEntries: 10,
};
const WEATHER_GLOBAL_RATE_LIMIT_KEY = "mcp-weather:global";

interface OpenWeatherResponse {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
}

interface WeatherResponse {
  city: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  wind_speed: number;
  icon: string;
  units: "metric";
}


// Asturias and Picos de Europa region cities with their coordinates
// Note: Picos de Europa spans Asturias, Cantabria, and León - all within our tourism scope
const ASTURIAS_CITIES: Record<string, { lat: number; lon: number }> = {
  oviedo: { lat: 43.3619, lon: -5.8494 },
  gijón: { lat: 43.5453, lon: -5.6619 },
  gijon: { lat: 43.5453, lon: -5.6619 },
  avilés: { lat: 43.5547, lon: -5.9245 },
  aviles: { lat: 43.5547, lon: -5.9245 },
  llanes: { lat: 43.4214, lon: -4.7562 },
  "cangas de onís": { lat: 43.3497, lon: -5.1303 },
  "cangas de onis": { lat: 43.3497, lon: -5.1303 },
  cudillero: { lat: 43.5636, lon: -6.1461 },
  luarca: { lat: 43.5444, lon: -6.5369 },
  "tapia de casariego": { lat: 43.5686, lon: -6.9428 },
  ribadesella: { lat: 43.4608, lon: -5.0589 },
  villaviciosa: { lat: 43.4803, lon: -5.4381 },
  mieres: { lat: 43.2506, lon: -5.7667 },
  langreo: { lat: 43.3069, lon: -5.6958 },
  "pola de siero": { lat: 43.3939, lon: -5.6572 },
  covadonga: { lat: 43.3103, lon: -5.0531 },
  "picos de europa": { lat: 43.1986, lon: -4.8417 },
  // Fuente Dé - technically Cantabria but part of Picos de Europa tourism
  "fuente dé": { lat: 43.1486, lon: -4.8089 },
  "fuente de": { lat: 43.1486, lon: -4.8089 },
  teleférico: { lat: 43.1486, lon: -4.8089 },
  "teleférico de fuente dé": { lat: 43.1486, lon: -4.8089 },
  // Ruta del Cares - spans Asturias/León
  cares: { lat: 43.2167, lon: -4.8667 },
  "ruta del cares": { lat: 43.2167, lon: -4.8667 },
  caín: { lat: 43.2056, lon: -4.9167 },
  cain: { lat: 43.2056, lon: -4.9167 },
  poncebos: { lat: 43.2611, lon: -4.8333 },
};

async function fetchWeather(city: string): Promise<WeatherResponse> {
  const apiKey = getEnv("OPENWEATHERMAP_API_KEY");

  if (!apiKey) {
    throw new Error("Weather API not configured");
  }

  // Check if it's a known Asturias city for better accuracy
  const normalizedCity = city.toLowerCase().trim();
  const knownCity = ASTURIAS_CITIES[normalizedCity];

  let url: string;
  if (knownCity) {
    // Use coordinates for known cities
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${knownCity.lat}&lon=${knownCity.lon}&appid=${apiKey}&units=metric&lang=es`;
  } else {
    // Fall back to city name search, biased towards Spain
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},ES&appid=${apiKey}&units=metric&lang=es`;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("City not found");
    }
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data: OpenWeatherResponse = await response.json();

  return {
    city: data.name,
    temperature: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0]?.description || "Unknown",
    wind_speed: Math.round(data.wind.speed * 10) / 10,
    icon: data.weather[0]?.icon || "01d",
    units: "metric",
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
    ? `mcp-weather:conv:${conversationId}`
    : `mcp-weather:ip:${normalizeIpForRateLimit(ip)}`;
}

interface RateLimitCheck {
  allowed: boolean;
  retryAfter?: number;
}

// BE-M1 (#782): check the global cost-cap bucket first (the real ceiling,
// immune to a spoofed conversationId), then the per-caller fairness bucket.
// Sequential and short-circuiting on purpose: a request already rejected by
// the global bucket must not also consume a slot from the per-caller bucket.
async function checkWeatherRateLimits(
  conversationId: string | null,
  ip: string
): Promise<RateLimitCheck> {
  const globalCheck = await checkRateLimit(WEATHER_GLOBAL_RATE_LIMIT_KEY, WEATHER_GLOBAL_RATE_LIMIT);
  if (!globalCheck.allowed) {
    return { allowed: false, retryAfter: globalCheck.retryAfter };
  }

  const perCallerKey = buildPerCallerRateLimitKey(conversationId, ip);
  return checkRateLimit(perCallerKey, WEATHER_RATE_LIMIT);
}

function tooManyRequestsResponse(retryAfter?: number): NextResponse {
  return rateLimitResponse({ error: "Too many requests" }, { retryAfter });
}

// BE-M8 (#789): a safe, stable response for any failure inside fetchWeather().
// The raw error (which can include upstream hostnames or other internal
// information) is logged server-side and, in development only, surfaced
// under `debug` — never spoken back to the visitor by Pelayo.
function weatherLookupFailedResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Unknown error";

  // This is our own static, non-sensitive config message (also returned
  // directly by the pre-flight env check above) — safe to pass through as-is.
  if (message === "Weather API not configured") {
    return NextResponse.json(
      { error: message, code: "WEATHER_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  if (message === "City not found") {
    return NextResponse.json(
      {
        error: "No se encontró esa ciudad. Prueba con otra localidad de Asturias.",
        code: "WEATHER_CITY_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  logger.error("[MCP_WEATHER_LOOKUP_FAILED]", { error: message });

  const body: { error: string; code: string; debug?: { message: string } } = {
    error:
      "No se pudo obtener el tiempo en este momento. Inténtalo de nuevo en unos segundos.",
    code: "WEATHER_LOOKUP_FAILED",
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
  const rateCheck = await checkWeatherRateLimits(conversationId, ip);
  if (!rateCheck.allowed) {
    return tooManyRequestsResponse(rateCheck.retryAfter);
  }

  // Normalise: absent params become empty string so Zod min(1) fires with
  // our custom message instead of "expected string, received undefined".
  const rawParams = { city: searchParams.get("city") ?? "" };
  const queryParsed = weatherQuerySchema.safeParse(rawParams);
  if (!queryParsed.success) {
    const firstIssue = queryParsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid query parameters" },
      { status: 400 }
    );
  }
  const { city } = queryParsed.data;

  if (!getEnv("OPENWEATHERMAP_API_KEY")) {
    return NextResponse.json(
      { error: "Weather API not configured" },
      { status: 500 }
    );
  }

  try {
    const weather = await fetchWeather(city);
    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": "private, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (err) {
    return weatherLookupFailedResponse(err);
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
  const rateCheck = await checkWeatherRateLimits(conversationId, ip);
  if (!rateCheck.allowed) {
    return tooManyRequestsResponse(rateCheck.retryAfter);
  }

  const paramsParsed = weatherPostRequestSchema.safeParse(body);

  // Validate before checking upstream configuration, matching GET above: a
  // malformed request is a 400 whether or not the server holds a weather key.
  if (!paramsParsed.success) {
    const firstIssue = paramsParsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid query parameters" },
      { status: 400 }
    );
  }

  if (!getEnv("OPENWEATHERMAP_API_KEY")) {
    return NextResponse.json(
      { error: "Weather API not configured" },
      { status: 500 }
    );
  }

  const { city } = paramsParsed.data;

  try {
    const weather = await fetchWeather(city);
    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": "private, max-age=300", // Cache for 5 minutes (matches GET)
      },
    });
  } catch (err) {
    return weatherLookupFailedResponse(err);
  }
}
