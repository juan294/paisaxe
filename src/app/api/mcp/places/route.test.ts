import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19, retryAfter: 0 }),
}));

import { GET, POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
const originalEnv = process.env;

// Helper to create Places API (New) response format
function createPlacesApiResponse(places: Array<{
  name: string;
  address: string;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: string;
  types?: string[];
  lat: number;
  lng: number;
  openNow?: boolean;
  weekdayDescriptions?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  id: string;
}>) {
  return {
    places: places.map((p) => ({
      id: p.id,
      displayName: { text: p.name, languageCode: "es" },
      formattedAddress: p.address,
      rating: p.rating,
      userRatingCount: p.reviewsCount,
      priceLevel: p.priceLevel,
      types: p.types || ["restaurant", "food", "establishment"],
      location: { latitude: p.lat, longitude: p.lng },
      regularOpeningHours: p.openNow !== undefined
        ? { openNow: p.openNow, weekdayDescriptions: p.weekdayDescriptions }
        : undefined,
      nationalPhoneNumber: p.nationalPhoneNumber,
      internationalPhoneNumber: p.internationalPhoneNumber,
      websiteUri: p.websiteUri,
    })),
  };
}

describe("/api/mcp/places", () => {
  const MCP_SECRET = "test-mcp-secret";

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish default rate-limit mock after resetAllMocks clears it
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 19, limit: 20, resetAt: Date.now() + 60000 });
    process.env = {
      ...originalEnv,
      GOOGLE_PLACES_API_KEY: "test-api-key",
      MCP_API_SECRET: MCP_SECRET,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET", () => {
    it("should return 401 when x-mcp-secret header is missing", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=fabada"
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when x-mcp-secret header is wrong", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=fabada",
        { headers: { "x-mcp-secret": "wrong-secret" } }
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when MCP_API_SECRET env var is not set", async () => {
      delete process.env.MCP_API_SECRET;

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=fabada",
        { headers: { "x-mcp-secret": "any-value" } }
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return places for a valid search query", async () => {
      const mockPlacesResponse = createPlacesApiResponse([
        {
          name: "Casa Gerardo",
          address: "Carretera AS-19, Prendes, Asturias",
          rating: 4.5,
          reviewsCount: 1200,
          priceLevel: "PRICE_LEVEL_EXPENSIVE",
          lat: 43.5234,
          lng: -5.7891,
          openNow: true,
          weekdayDescriptions: ["Monday: 1:00 - 4:00 PM", "Tuesday: Closed"],
          nationalPhoneNumber: "985 88 77 97",
          internationalPhoneNumber: "+34 985 88 77 97",
          websiteUri: "https://casagerardo.com",
          id: "ChIJ123abc",
        },
        {
          name: "El Molín de la Pedrera",
          address: "Gijón, Asturias",
          rating: 4.3,
          reviewsCount: 800,
          priceLevel: "PRICE_LEVEL_MODERATE",
          lat: 43.5453,
          lng: -5.6619,
          openNow: false,
          id: "ChIJ456def",
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlacesResponse),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=fabada+asturias",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(2);
      expect(data.places[0]).toMatchObject({
        name: "Casa Gerardo",
        rating: 4.5,
        price_level: 3, // PRICE_LEVEL_EXPENSIVE = 3
        phone_number: "985 88 77 97",
        international_phone: "+34 985 88 77 97",
        website: "https://casagerardo.com",
        opening_hours: ["Monday: 1:00 - 4:00 PM", "Tuesday: Closed"],
      });
      // Second place has no phone number
      expect(data.places[1].phone_number).toBeNull();
    });

    it("should return null price_level when place has no priceLevel", async () => {
      const mockPlacesResponse = createPlacesApiResponse([
        {
          name: "Free Beach",
          address: "Playa del Silencio, Asturias",
          rating: 4.8,
          reviewsCount: 200,
          lat: 43.5600,
          lng: -6.2100,
          id: "ChIJfree",
          // priceLevel intentionally omitted
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlacesResponse),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=playa",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(1);
      expect(data.places[0].price_level).toBeNull();
    });

    it("should return 400 if query parameter is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        headers: { "x-mcp-secret": MCP_SECRET },
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // Zod returns the custom min(1) message when query is absent
      expect(data.error).toBe("Query parameter is required");
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Places API not configured");
    });

    it("should filter by type when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=cider&type=bar",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      // Places API (New) uses POST with JSON body
      expect(mockFetch).toHaveBeenCalledWith(
        "https://places.googleapis.com/v1/places:searchText",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"includedType":"bar"'),
        })
      );
    });

    it("should default search to Asturias region", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      // Should include Asturias center coordinates in locationBias
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.locationBias.circle.center.latitude).toBeCloseTo(43.3619, 2);
    });

    it("should support location-specific searches", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants&city=Gijón",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      // Should use Gijón coordinates
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.locationBias.circle.center.latitude).toBeCloseTo(43.5453, 2);
    });
  });

  describe("POST", () => {
    it("should return 401 when x-mcp-secret header is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "sidra" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when x-mcp-secret header is wrong", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": "wrong-secret" },
        body: JSON.stringify({ query: "sidra" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should support MCP tool call format", async () => {
      const mockPlacesResponse = createPlacesApiResponse([
        {
          name: "Sidrería Tierra Astur",
          address: "Oviedo, Asturias",
          rating: 4.2,
          reviewsCount: 500,
          priceLevel: "PRICE_LEVEL_MODERATE",
          lat: 43.3619,
          lng: -5.8494,
          id: "ChIJ789ghi",
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlacesResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({
          tool: "search_places",
          arguments: {
            query: "sidra",
            type: "restaurant",
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(1);
      expect(data.places[0].name).toBe("Sidrería Tierra Astur");
    });

    it("sets the same Cache-Control header as GET (#614)", async () => {
      const mockPlacesResponse = createPlacesApiResponse([
        {
          name: "Sidrería Tierra Astur",
          address: "Oviedo, Asturias",
          rating: 4.2,
          reviewsCount: 500,
          priceLevel: "PRICE_LEVEL_MODERATE",
          lat: 43.3619,
          lng: -5.8494,
          id: "ChIJcache",
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlacesResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "sidra", type: "restaurant" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should return 400 for invalid MCP request", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ invalid: "request" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 when POST body is an array (normalizeMcpParams null-guard, schemas.ts line 293)", async () => {
      // When body is an array, normalizeMcpParams hits the `Array.isArray(input)` branch
      // and returns { query: "" }, which fails the min(1) Zod check → 400.
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify([]),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it.each([
      {
        name: "oversized flat query",
        body: { query: "a".repeat(201) },
      },
      {
        name: "malformed flat query",
        body: { query: { value: "sidra" } },
      },
      {
        name: "oversized flat city",
        body: { query: "sidra", city: "a".repeat(201) },
      },
      {
        name: "malformed flat city",
        body: { query: "sidra", city: ["Oviedo"] },
      },
      {
        name: "oversized MCP-nested query",
        body: { arguments: { query: "a".repeat(201) } },
      },
      {
        name: "malformed MCP-nested query",
        body: { arguments: { query: ["sidra"] } },
      },
      {
        name: "oversized MCP-nested city",
        body: { arguments: { query: "sidra", city: "a".repeat(201) } },
      },
      {
        name: "malformed MCP-nested city",
        body: { arguments: { query: "sidra", city: { name: "Oviedo" } } },
      },
    ])("should reject $name before searching", async ({ body }) => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify(body),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should support flat format from ElevenLabs", async () => {
      const mockPlacesResponse = createPlacesApiResponse([
        {
          name: "Sidrería Tierra Astur",
          address: "Oviedo, Asturias",
          rating: 4.2,
          reviewsCount: 500,
          priceLevel: "PRICE_LEVEL_MODERATE",
          lat: 43.3619,
          lng: -5.8494,
          id: "ChIJ789ghi",
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlacesResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({
          query: "sidra",
          type: "restaurant",
          city: "Oviedo",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(1);
      expect(data.places[0].name).toBe("Sidrería Tierra Astur");
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "restaurants" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Places API not configured");
    });

    it("should handle fetch throwing", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "restaurants" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Network error");
    });
  });

  describe("GET - rate limiting", () => {
    it("should return 429 when rate limited on GET", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 30,
        limit: 10,
        resetAt: Date.now() + 30000,
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("30");
    });
  });

  describe("POST - rate limiting", () => {
    it("should return 429 when rate limited on POST", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 45,
        limit: 10,
        resetAt: Date.now() + 45000,
      });

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "restaurants" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("45");
    });
  });

  describe("GET - Places API HTTP errors", () => {
    it("should return 500 when Places API returns non-ok HTTP response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden: API key invalid"),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Places API error: 403");
      expect(data.error).toContain("Forbidden");
    });
  });

  describe("searchPlaces - API key trim check", () => {
    it("should return 500 when GOOGLE_PLACES_API_KEY is whitespace-only (POST)", async () => {
      // Set to whitespace so the route-level `if (!process.env.GOOGLE_PLACES_API_KEY)` passes,
      // but inside searchPlaces() the `.trim()` produces an empty string, hitting line 166.
      process.env.GOOGLE_PLACES_API_KEY = "   ";

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "restaurants" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Places API not configured");
    });

    it("should return 500 when GOOGLE_PLACES_API_KEY is whitespace-only (GET)", async () => {
      process.env.GOOGLE_PLACES_API_KEY = "   ";

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Places API not configured");
    });
  });

  describe("GET - additional coverage", () => {
    it("should handle API returning error in response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: {
              message: "API quota exceeded",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("API quota exceeded");
    });

    it("should handle no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=nonexistent+place+xyz",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toEqual([]);
    });

    it("should handle fetch throwing", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain("Network error");
    });
  });

  describe("GET - non-Error throw coverage", () => {
    it("should return 'Unknown error' when GET catch receives a non-Error object", async () => {
      // Simulate a non-Error throw (e.g., a string or number)
      mockFetch.mockRejectedValueOnce("string error");

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Unknown error");
    });
  });

  describe("POST - non-Error throw coverage", () => {
    it("should return 'Unknown error' when POST catch receives a non-Error object", async () => {
      mockFetch.mockRejectedValueOnce(42);

      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ query: "restaurants" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Unknown error");
    });
  });

  describe("searchPlaces - API error without message", () => {
    it("should fall back to 'API request denied' when error.message is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: {
              message: "",
              status: "PERMISSION_DENIED",
            },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("API request denied");
    });
  });

  describe("transformPlace - missing optional fields", () => {
    it("should handle place with no displayName, no formattedAddress, no location", async () => {
      // A place with minimal fields to cover the fallback branches in transformPlace
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            places: [
              {
                id: "ChIJminimal",
                // displayName omitted → name should be "Unknown"
                // formattedAddress omitted → address should be ""
                // location omitted → lat/lng should be 0
                // rating omitted → should be null
                // types omitted → should be empty array
                // regularOpeningHours omitted → is_open/opening_hours should be null
              },
            ],
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=test",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(1);
      expect(data.places[0]).toMatchObject({
        name: "Unknown",
        address: "",
        rating: null,
        reviews_count: 0,
        price_level: null,
        types: [],
        location: { lat: 0, lng: 0 },
        is_open: null,
        opening_hours: null,
        phone_number: null,
        international_phone: null,
        website: null,
        place_id: "ChIJminimal",
      });
    });

    it("should return null for unrecognized priceLevel string", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            places: [
              {
                id: "ChIJunknownprice",
                displayName: { text: "Test Place", languageCode: "es" },
                formattedAddress: "Test address",
                priceLevel: "PRICE_LEVEL_UNKNOWN",
              },
            ],
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=test",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places[0].price_level).toBeNull();
    });
  });

  describe("searchPlaces - city not in coordinates list", () => {
    it("should fall back to Asturias center for unknown city", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants&city=UnknownVillage",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      // Unknown city should use Asturias center (default) with 50km radius
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.locationBias.circle.center.latitude).toBeCloseTo(43.3619, 2);
      expect(body.locationBias.circle.radius).toBe(50000);
    });
  });

  describe("GET - type filtering with underscore types", () => {
    it("should keep types with underscore that are in VALID_TYPES (line 143 VALID_TYPES branch)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            places: [
              {
                id: "ChIJtypetest",
                displayName: { text: "Test Place", languageCode: "es" },
                formattedAddress: "Test Address",
                types: [
                  "restaurant",           // no underscore → kept
                  "meal_delivery",         // underscore + in VALID_TYPES → kept
                  "tourist_attraction",    // underscore + in VALID_TYPES → kept
                  "point_of_interest",     // underscore + in VALID_TYPES → kept
                  "some_random_type",      // underscore + NOT in VALID_TYPES → filtered out
                ],
                location: { latitude: 43.36, longitude: -5.85 },
              },
            ],
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=test",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places[0].types).toContain("restaurant");
      expect(data.places[0].types).toContain("meal_delivery");
      expect(data.places[0].types).toContain("tourist_attraction");
      expect(data.places[0].types).toContain("point_of_interest");
      expect(data.places[0].types).not.toContain("some_random_type");
      expect(data.places[0].types).toHaveLength(4);
    });
  });

  describe("GET - invalid type ignored", () => {
    it("should not include includedType for invalid type values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=test&type=invalid_type",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.includedType).toBeUndefined();
    });
  });

  describe("GET - Zod query parameter validation", () => {
    it("should return 400 with 'Query parameter is required' for empty query string", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Query parameter is required");
    });

    it("should return 400 when query exceeds 200 characters", async () => {
      const longQuery = "a".repeat(201);
      const request = new Request(
        `http://localhost:3000/api/mcp/places?query=${longQuery}`,
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should accept valid query with optional type and city", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=sidra&type=bar&city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });
});
