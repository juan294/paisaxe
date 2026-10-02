import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, retryAfter: 0 }),
}));

import { GET, POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
const originalEnv = process.env;

describe("/api/mcp/weather", () => {
  const MCP_SECRET = "test-mcp-secret";

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish default rate-limit mock after resetAllMocks clears it
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 29, limit: 30, resetAt: Date.now() + 60000 });
    process.env = {
      ...originalEnv,
      OPENWEATHERMAP_API_KEY: "test-api-key",
      MCP_API_SECRET: MCP_SECRET,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET", () => {
    it("should return 401 when x-mcp-secret header is missing", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo"
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when x-mcp-secret header is wrong", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": "wrong-secret" } }
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when MCP_API_SECRET env var is not set", async () => {
      delete process.env.MCP_API_SECRET;

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": "any-value" } }
      );
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

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
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
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
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        headers: { "x-mcp-secret": MCP_SECRET },
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("City parameter is required");
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
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
        "http://localhost:3000/api/mcp/weather?city=InvalidCity123",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).not.toBe("City not found");
      expect(data.code).toBe("WEATHER_CITY_NOT_FOUND");
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
        "http://localhost:3000/api/mcp/weather?city=Gijón",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("units=metric"),
        expect.any(Object)
      );
    });
  });

  describe("POST", () => {
    it("should return 401 when x-mcp-secret header is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when x-mcp-secret header is wrong", async () => {
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": "wrong-secret" },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
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

    it("sets the same Cache-Control header as GET (#614)", async () => {
      const mockWeatherResponse = {
        name: "Oviedo",
        main: { temp: 14, feels_like: 13, humidity: 80 },
        weather: [{ description: "light rain", icon: "10d" }],
        wind: { speed: 3.2 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    });

    it("should return 400 for invalid MCP request", async () => {
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ invalid: "request" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it.each([
      {
        name: "oversized flat city",
        body: { city: "a".repeat(201) },
      },
      {
        name: "malformed flat city",
        body: { city: { name: "Oviedo" } },
      },
      {
        name: "oversized MCP-nested city",
        body: { arguments: { city: "a".repeat(201) } },
      },
      {
        name: "malformed MCP-nested city",
        body: { arguments: { city: ["Oviedo"] } },
      },
    ])("should reject $name before fetching weather", async ({ body }) => {
      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify(body),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should support flat format from ElevenLabs", async () => {
      const mockWeatherResponse = {
        name: "Oviedo",
        main: { temp: 15, feels_like: 14, humidity: 70 },
        weather: [{ description: "scattered clouds", icon: "03d" }],
        wind: { speed: 3.5 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.city).toBe("Oviedo");
      expect(data.temperature).toBe(15);
    });

    it("should return 500 if API key is not configured", async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Weather API not configured");
    });

    it("should return 404 if city not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "InvalidCity123" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).not.toBe("City not found");
      expect(data.code).toBe("WEATHER_CITY_NOT_FOUND");
    });

    it("should handle general API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);

      // BE-M8 (#789): the upstream status/vendor detail must not be spoken
      // back to the visitor verbatim.
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).not.toContain("Weather API error");
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
    });

    it("should handle fetch throwing", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).not.toContain("Network error");
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
    });

    it("should return 429 when rate limited on POST", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 15,
        limit: 10,
        resetAt: Date.now() + 15000,
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("15");
    });
  });

  describe("BE-M1 (#782) - rate-limit key differentiation", () => {
    it("keys the per-caller bucket on the conversationId when the request supplies one", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 15, feels_like: 14, humidity: 70 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 1 },
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo", conversationId: "conv-alpha" }),
      });
      await POST(request);

      const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[0]);
      expect(keys.some((key) => key.includes("conv-alpha"))).toBe(true);
    });

    it("keys two different conversations into two different per-caller buckets even from the same IP", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 15, feels_like: 14, humidity: 70 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 1 },
          }),
      });

      const makeRequest = (conversationId: string) =>
        new Request("http://localhost:3000/api/mcp/weather", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mcp-secret": MCP_SECRET,
            "x-vercel-forwarded-for": "1.2.3.4",
          },
          body: JSON.stringify({ city: "Oviedo", conversationId }),
        });

      await POST(makeRequest("conv-a"));
      await POST(makeRequest("conv-b"));

      const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[0]);
      const convAKeys = keys.filter((key) => key.includes("conv-a") && !key.includes("conv-b"));
      const convBKeys = keys.filter((key) => key.includes("conv-b"));
      expect(convAKeys.length).toBeGreaterThan(0);
      expect(convBKeys.length).toBeGreaterThan(0);
      expect(convAKeys).not.toEqual(convBKeys);
    });

    it("falls back to the IP-keyed bucket when no conversationId is supplied", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 15, feels_like: 14, humidity: 70 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 1 },
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "x-vercel-forwarded-for": "9.9.9.9",
        },
        body: JSON.stringify({ city: "Oviedo" }),
      });
      await POST(request);

      const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[0]);
      expect(keys.some((key) => key.includes("9.9.9.9"))).toBe(true);
    });

    it("checks a separate global cost-cap bucket independent of the per-caller key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 15, feels_like: 14, humidity: 70 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 1 },
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo", conversationId: "conv-global-check" }),
      });
      await POST(request);

      const keys = vi.mocked(checkRateLimit).mock.calls.map((call) => call[0]);
      expect(keys.some((key) => key.includes("global"))).toBe(true);
      const globalKey = keys.find((key) => key.includes("global"));
      expect(globalKey).not.toContain("conv-global-check");
    });

    it("returns 429 when only the global bucket is exhausted, even with a fresh conversationId", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 12,
        limit: 180,
        resetAt: Date.now() + 12000,
      });

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo", conversationId: "conv-brand-new" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("12");
    });
  });

  describe("GET - additional coverage", () => {
    it("should handle general Weather API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).not.toContain("Weather API error");
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
    });

    it("should return 429 when rate limited on GET", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 20,
        limit: 10,
        resetAt: Date.now() + 20000,
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("Too many requests");
      expect(response.headers.get("Retry-After")).toBe("20");
    });

    it("should return 500 via fetchWeather when OPENWEATHERMAP_API_KEY is set but empty after trim", async () => {
      // The env var exists (so the early check passes) but fetchWeather trims to empty
      process.env.OPENWEATHERMAP_API_KEY = "   ";

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Weather API not configured");
    });

    it("should use coordinates for known Asturias cities", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 15, feels_like: 14, humidity: 70 },
            weather: [{ description: "scattered clouds", icon: "03d" }],
            wind: { speed: 3.5 },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      // Should use coordinates endpoint, not city name search
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain("lat=43.3619");
      expect(fetchUrl).toContain("lon=-5.8494");
      expect(fetchUrl).not.toContain("q=oviedo");
    });
  });

  describe("fetchWeather - empty weather array fallbacks", () => {
    it("should fall back to 'Unknown' description and '01d' icon when weather array is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Oviedo",
            main: { temp: 12, feels_like: 10, humidity: 80 },
            weather: [], // empty weather array
            wind: { speed: 2.0 },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.description).toBe("Unknown");
      expect(data.icon).toBe("01d");
    });
  });

  describe("GET - non-Error throw coverage", () => {
    it("should return the safe generic message when GET catch receives a non-Error object", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
    });
  });

  describe("POST - non-Error throw coverage", () => {
    it("should return the safe generic message when POST catch receives a non-Error object", async () => {
      mockFetch.mockRejectedValueOnce(null);

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
    });
  });

  describe("BE-M8 (#789) - safe error messages", () => {
    const INTERNAL_DETAIL = "connect ECONNREFUSED internal-weather-cache.paisaxe.internal:6379";

    it("does not leak internal error detail in production mode (GET)", async () => {
      mockFetch.mockRejectedValueOnce(new Error(INTERNAL_DETAIL));

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(JSON.stringify(data)).not.toContain("internal-weather-cache");
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
      expect(data.debug).toBeUndefined();
    });

    it("reveals internal error detail only in development mode (POST)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockFetch.mockRejectedValueOnce(new Error(INTERNAL_DETAIL));

      const request = new Request("http://localhost:3000/api/mcp/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({ city: "Oviedo" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe("WEATHER_LOOKUP_FAILED");
      expect(data.debug?.message).toContain("internal-weather-cache");
      expect(data.error).not.toContain("internal-weather-cache");
    });
  });

  describe("fetchWeather - unknown city fallback to city name search", () => {
    it("should use q= parameter for unknown cities not in ASTURIAS_CITIES", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "Santander",
            main: { temp: 16, feels_like: 15, humidity: 75 },
            weather: [{ description: "cloudy", icon: "04d" }],
            wind: { speed: 5.0 },
          }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Santander",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      await GET(request);

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain("q=Santander");
      expect(fetchUrl).toContain(",ES");
      expect(fetchUrl).not.toContain("lat=");
    });
  });

  // NOTE on route.ts lines 156 and 221 (`firstIssue?.message ?? "Invalid query parameters"`):
  // This `??` fallback is unreachable given the current schemas (weatherQuerySchema /
  // weatherPostRequestSchema, see src/lib/schemas.ts). `safeParse` failing guarantees
  // `error.issues.length >= 1`, and every issue this schema can produce (min(1), max(200),
  // or a base type mismatch) carries a Zod-generated message, so `firstIssue` is never
  // `undefined` when `!success`. The `?? "..."` exists purely to satisfy
  // `ZodIssue[number] | undefined` typing from array indexing, not a reachable runtime
  // path. No test is added for it to avoid faking an artificial issues[] shape that Zod
  // itself would never produce.
  describe("GET - Zod query parameter validation", () => {
    it("should return 400 with 'City parameter is required' for empty city string", async () => {
      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("City parameter is required");
    });

    it("should return 400 when city exceeds 200 characters", async () => {
      const longCity = "a".repeat(201);
      const request = new Request(
        `http://localhost:3000/api/mcp/weather?city=${longCity}`,
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("should pass through valid city parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: "Oviedo",
          main: { temp: 15, feels_like: 13, humidity: 75 },
          weather: [{ description: "nublado", icon: "04d" }],
          wind: { speed: 3.5 },
        }),
      });

      const request = new Request(
        "http://localhost:3000/api/mcp/weather?city=Oviedo",
        { headers: { "x-mcp-secret": MCP_SECRET } }
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });
});
