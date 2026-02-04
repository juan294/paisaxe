import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
const originalEnv = process.env;

describe("/api/mcp/weather", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, OPENWEATHERMAP_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET", () => {
    it("should return weather data for a valid city", async () => {
      const mockWeatherResponse = {
        name: "Oviedo",
        main: {
          temp: 15,
          feels_like: 14,
          humidity: 70,
        },
        weather: [{ description: "scattered clouds", icon: "03d" }],
        wind: { speed: 3.5 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        city: "Oviedo",
        temperature: 15,
        feels_like: 14,
        humidity: 70,
        description: "scattered clouds",
        wind_speed: 3.5,
      });
    });

    it("should return 400 if city parameter is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/weather");
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("City parameter is required");
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo"
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Weather API not configured");
    });

    it("should return 404 if city is not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=InvalidCity123"
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("City not found");
    });

    it("should default to Spanish units (metric)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Gijón",
            main: { temp: 18, feels_like: 17, humidity: 65 },
            weather: [{ description: "clear sky", icon: "01d" }],
            wind: { speed: 2.0 },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Gijón"
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("units=metric")
      );
    });
  });

  describe("POST", () => {
    it("should support MCP tool call format", async () => {
      const mockWeatherResponse = {
        name: "Avilés",
        main: {
          temp: 16,
          feels_like: 15,
          humidity: 72,
        },
        weather: [{ description: "overcast clouds", icon: "04d" }],
        wind: { speed: 4.0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_weather",
          arguments: { city: "Avilés" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.city).toBe("Avilés");
    });

    it("should return 400 for invalid MCP request", async () => {
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "request" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
