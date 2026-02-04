import { NextResponse } from "next/server";

/**
 * MCP-compatible Places API endpoint for ElevenLabs voice agents.
 * Searches for restaurants, attractions, and points of interest in Asturias.
 *
 * GET /api/mcp/places?query=fabada&type=restaurant&city=Oviedo
 * POST /api/mcp/places (MCP tool call format)
 */

interface GooglePlacesResult {
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now?: boolean;
  };
  place_id: string;
}

interface GooglePlacesResponse {
  results: GooglePlacesResult[];
  status: string;
  error_message?: string;
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

function transformPlace(result: GooglePlacesResult): Place {
  return {
    name: result.name,
    address: result.formatted_address,
    rating: result.rating ?? null,
    reviews_count: result.user_ratings_total ?? 0,
    price_level: result.price_level ?? null,
    types: result.types.filter((t) => !t.includes("_") || VALID_TYPES.includes(t)),
    location: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    },
    is_open: result.opening_hours?.open_now ?? null,
    place_id: result.place_id,
  };
}

async function searchPlaces(
  query: string,
  type?: string,
  city?: string
): Promise<PlacesResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

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

  // Build URL
  const baseUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json";
  const params = new URLSearchParams({
    query: `${query} Asturias`,
    key: apiKey,
    location: `${location.lat},${location.lng}`,
    radius: String(radius),
    language: "es",
  });

  if (type && VALID_TYPES.includes(type)) {
    params.set("type", type);
  }

  const url = `${baseUrl}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Places API error: ${response.status}`);
  }

  const data: GooglePlacesResponse = await response.json();

  if (data.status === "REQUEST_DENIED") {
    throw new Error(data.error_message || "API request denied");
  }

  if (data.status === "ZERO_RESULTS" || !data.results?.length) {
    return {
      places: [],
      query,
      city: city || null,
      type: type || null,
    };
  }

  // Transform and limit results
  const places = data.results.slice(0, 5).map(transformPlace);

  return {
    places,
    query,
    city: city || null,
    type: type || null,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const type = searchParams.get("type") || undefined;
  const city = searchParams.get("city") || undefined;

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter is required" },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  try {
    const results = await searchPlaces(query, type, city);
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    // Support both flat format and MCP format
    let query: string | undefined;
    let type: string | undefined;
    let city: string | undefined;

    if (body.query) {
      // Flat format from ElevenLabs webhook
      query = body.query;
      type = body.type;
      city = body.city;
    } else if (body.arguments?.query) {
      // MCP tool call format
      query = body.arguments.query;
      type = body.arguments.type;
      city = body.arguments.city;
    }

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    const results = await searchPlaces(query, type, city);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
