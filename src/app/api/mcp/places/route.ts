import { NextResponse } from "next/server";

/**
 * MCP-compatible Places API endpoint for ElevenLabs voice agents.
 * Searches for restaurants, attractions, and points of interest in Asturias.
 * Uses Google Places API (New) - the modern version.
 *
 * GET /api/mcp/places?query=fabada&type=restaurant&city=Oviedo
 * POST /api/mcp/places (MCP tool call format)
 */

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

  // Build request for Places API (New)
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
