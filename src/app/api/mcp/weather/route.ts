import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateMcpSecret } from "@/lib/mcp-auth";

/**
 * MCP-compatible Weather API endpoint for ElevenLabs voice agents.
 * Provides current weather data for cities in Asturias.
 *
 * GET /api/mcp/weather?city=Oviedo
 * POST /api/mcp/weather (MCP tool call format)
 */

// Rate limit: 30 requests per minute per IP (weather API is relatively cheap)
const WEATHER_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
  maxEntries: 10_000,
};

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
  const apiKey = process.env.OPENWEATHERMAP_API_KEY?.trim();

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

  const response = await fetch(url);

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

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`mcp-weather:${ip}`, WEATHER_RATE_LIMIT);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json(
      { error: "City parameter is required" },
      { status: 400 }
    );
  }

  if (!process.env.OPENWEATHERMAP_API_KEY) {
    return NextResponse.json(
      { error: "Weather API not configured" },
      { status: 500 }
    );
  }

  try {
    const weather = await fetchWeather(city);
    return NextResponse.json(weather, {
      headers: {
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "City not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`mcp-weather:${ip}`, WEATHER_RATE_LIMIT);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter) },
      }
    );
  }

  if (!process.env.OPENWEATHERMAP_API_KEY) {
    return NextResponse.json(
      { error: "Weather API not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    // Support both flat format { city: "..." } and MCP format { tool, arguments: { city } }
    let city: string | undefined;

    if (body.city) {
      // Flat format from ElevenLabs webhook
      city = body.city;
    } else if (body.arguments?.city) {
      // MCP tool call format
      city = body.arguments.city;
    }

    if (!city) {
      return NextResponse.json(
        { error: "City parameter is required" },
        { status: 400 }
      );
    }

    const weather = await fetchWeather(city);
    return NextResponse.json(weather);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "City not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
