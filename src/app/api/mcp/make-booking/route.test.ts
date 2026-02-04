import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock feature flag
const mockIsFeatureFlagEnabled = vi.fn();
vi.mock("@/lib/feature-flags-server", () => ({
  isFeatureFlagEnabled: () => mockIsFeatureFlagEnabled(),
}));

// Mock environment variable
const originalEnv = process.env;

describe("/api/mcp/make-booking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: Feature flag enabled, ElevenLabs outbound not configured
    mockIsFeatureFlagEnabled.mockResolvedValue(true);
    process.env = { ...originalEnv };
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_PHONE_NUMBER_ID;
    delete process.env.ELEVENLABS_BOOKING_AGENT_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET", () => {
    it("should return endpoint documentation", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe("/api/mcp/make-booking");
      expect(data.required_fields).toContain("venue_name");
      expect(data.required_fields).toContain("phone_number");
      expect(data.required_fields).toContain("party_size");
      expect(data.required_fields).toContain("customer_name");
      expect(data.required_fields).toContain("customer_phone");
      expect(data.outbound_configured).toBe(false);
      expect(data.agent).toBe("Pelayo (Booking)");
    });

    it("should report outbound as configured when env vars are set", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-agent-id";

      const response = await GET();
      const data = await response.json();

      expect(data.outbound_configured).toBe(true);
    });
  });

  describe("POST", () => {
    it("should return fallback message when booking_system flag is disabled", async () => {
      mockIsFeatureFlagEnabled.mockResolvedValue(false);

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.status).toBe("not_configured");
      expect(data.message).toContain("Booking is temporarily unavailable");
      expect(data.message).toContain("Casa Gerardo");
      expect(data.message).toContain("+34 985 88 77 97");
      expect(data.fallback_action).toContain("I can't make calls right now");
    });

    it("should return 400 for missing required fields", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          // Missing other required fields
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Missing required fields");
    });

    it("should return 400 for invalid Spanish phone number", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "123-456-7890", // US format, not Spanish
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Invalid Spanish phone number");
    });

    it("should accept valid Spanish phone number in national format", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "985 88 77 97", // National format
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should not fail on phone validation - will return not_configured since ElevenLabs isn't set up
      expect(data.status).toBe("not_configured");
      expect(data.message).toContain("Outbound calling is not configured");
      expect(data.fallback_action).toContain("call Casa Gerardo directly");
    });

    it("should accept valid Spanish phone number in international format", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97", // International format
          party_size: 4,
          date: "mañana",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34 612 345 678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.status).toBe("not_configured");
    });

    it("should support MCP tool call format", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "make_booking",
          arguments: {
            venue_name: "Casa Gerardo",
            phone_number: "+34985887797",
            party_size: 4,
            date: "hoy",
            time: "21:00",
            customer_name: "Juan García López",
            customer_phone: "612345678",
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should process MCP format correctly
      expect(data.status).toBe("not_configured");
      expect(data.fallback_action).toContain("Casa Gerardo");
    });

    it("should initiate ElevenLabs call when configured", async () => {
      // Configure ElevenLabs
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock successful ElevenLabs response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            conversation_id: "conv_123456789",
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612 345 678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe("initiated");
      expect(data.call_sid).toBe("conv_123456789");
      expect(data.message).toContain("Calling Casa Gerardo");

      // Verify ElevenLabs API was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("elevenlabs.io");
      expect(url).toContain("outbound-call");
      expect(options.method).toBe("POST");
      expect(options.headers["xi-api-key"]).toBe("test-api-key");
    });

    it("should handle ElevenLabs API errors gracefully", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock ElevenLabs error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: { message: "Invalid phone number format" },
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.status).toBe("failed");
      expect(data.fallback_action).toContain("call the restaurant directly");
    });

    it("should pass dynamic variables to ElevenLabs correctly", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "mañana",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34 612 345 678",
          special_requests: "Trona para bebé",
        }),
      });

      await POST(request);

      // Verify request body includes dynamic variables
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.agent_id).toBe("test-booking-agent-id");
      expect(body.agent_phone_number_id).toBe("test-phone-id");
      expect(body.to_number).toBe("+34985887797");
      expect(body.conversation_initiation_client_data.dynamic_variables).toEqual({
        customer_name: "Juan García López",
        customer_phone: "612 345 678", // +34 stripped
        party_size: "4",
        date: "mañana",
        time: "nueve de la noche", // Converted from 21:00
        special_requests: "Trona para bebé",
      });
    });

    it("should strip +34 prefix from customer phone for natural reading", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34672172383", // International format with +34
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      // Verify +34 was stripped from customer_phone
      expect(body.conversation_initiation_client_data.dynamic_variables.customer_phone).toBe(
        "672172383"
      );
    });
  });
});
