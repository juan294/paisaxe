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
      regularOpeningHours: p.openNow !== undefined ? { openNow: p.openNow } : undefined,
    })),
  };
}

describe("/api/mcp/places", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, GOOGLE_PLACES_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET", () => {
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
        "http://localhost:3000/api/mcp/places?query=fabada+asturias"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.places).toHaveLength(2);
      expect(data.places[0]).toMatchObject({
        name: "Casa Gerardo",
        rating: 4.5,
        price_level: 3, // PRICE_LEVEL_EXPENSIVE = 3
      });
    });

    it("should return 400 if query parameter is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/places");
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Query parameter is required");
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants"
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
        "http://localhost:3000/api/mcp/places?query=cider&type=bar"
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
        "http://localhost:3000/api/mcp/places?query=restaurants"
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
        "http://localhost:3000/api/mcp/places?query=restaurants&city=Gijón"
      );
      await GET(request);

      // Should use Gijón coordinates
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.locationBias.circle.center.latitude).toBeCloseTo(43.5453, 2);
    });
  });

  describe("POST", () => {
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "request" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
