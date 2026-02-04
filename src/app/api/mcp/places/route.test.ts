import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
const originalEnv = process.env;

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
      const mockPlacesResponse = {
        results: [
          {
            name: "Casa Gerardo",
            formatted_address: "Carretera AS-19, Prendes, Asturias",
            rating: 4.5,
            user_ratings_total: 1200,
            price_level: 3,
            types: ["restaurant", "food", "establishment"],
            geometry: { location: { lat: 43.5234, lng: -5.7891 } },
            opening_hours: { open_now: true },
            place_id: "ChIJ123abc",
          },
          {
            name: "El Molín de la Pedrera",
            formatted_address: "Gijón, Asturias",
            rating: 4.3,
            user_ratings_total: 800,
            price_level: 2,
            types: ["restaurant", "food", "establishment"],
            geometry: { location: { lat: 43.5453, lng: -5.6619 } },
            opening_hours: { open_now: false },
            place_id: "ChIJ456def",
          },
        ],
        status: "OK",
      };

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
        price_level: 3,
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
        json: () =>
          Promise.resolve({
            results: [],
            status: "ZERO_RESULTS",
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=cider&type=bar"
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("type=bar")
      );
    });

    it("should default search to Asturias region", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            status: "ZERO_RESULTS",
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants"
      );
      await GET(request);

      // Should include Asturias center coordinates
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("location=43.36")
      );
    });

    it("should support location-specific searches", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            status: "ZERO_RESULTS",
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/places?query=restaurants&city=Gijón"
      );
      await GET(request);

      // Should use Gijón coordinates
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("location=43.5453")
      );
    });
  });

  describe("POST", () => {
    it("should support MCP tool call format", async () => {
      const mockPlacesResponse = {
        results: [
          {
            name: "Sidrería Tierra Astur",
            formatted_address: "Oviedo, Asturias",
            rating: 4.2,
            user_ratings_total: 500,
            price_level: 2,
            types: ["restaurant", "bar"],
            geometry: { location: { lat: 43.3619, lng: -5.8494 } },
            place_id: "ChIJ789ghi",
          },
        ],
        status: "OK",
      };

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
