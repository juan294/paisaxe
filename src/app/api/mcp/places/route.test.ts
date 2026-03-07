import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

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

    it("should return 400 if query parameter is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        headers: { "x-mcp-secret": MCP_SECRET },
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
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

    it("should return 400 for invalid MCP request", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ invalid: "request" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
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
});
