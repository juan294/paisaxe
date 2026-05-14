import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route";

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock feature flag
const mockIsFeatureFlagEnabled = vi.fn();
vi.mock("@/lib/feature-flags-server", () => ({
  isFeatureFlagEnabled: (key: string) => mockIsFeatureFlagEnabled(key),
}));

// Mock Supabase
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
    })),
  })),
}));

// Mock environment variable
const originalEnv = process.env;

describe("/api/mcp/make-booking", () => {
  const MCP_SECRET = "test-mcp-secret";

  beforeEach(() => {
    vi.resetAllMocks();
    // Default: Feature flags enabled, ElevenLabs outbound not configured
    mockIsFeatureFlagEnabled.mockImplementation((key: string) => {
      if (key === "booking_system") return Promise.resolve(true);
      if (key === "sms_booking_confirmation") return Promise.resolve(true);
      return Promise.resolve(false);
    });
    // Default: DB insert().select("id") chain returns the claimed booking row id
    mockSelect.mockResolvedValue({ data: [{ id: "pending-row-id" }], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    // Default: DB update succeeds
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    process.env = { ...originalEnv };
    process.env.MCP_API_SECRET = MCP_SECRET;
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
    it("should return 401 when x-mcp-secret header is missing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_name: "Test" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 when x-mcp-secret header is wrong", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": "wrong-secret" },
        body: JSON.stringify({ venue_name: "Test" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return fallback message when booking_system flag is disabled", async () => {
      mockIsFeatureFlagEnabled.mockImplementation((key: string) => {
        if (key === "booking_system") return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          // Missing other required fields
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      // Zod validation returns field errors for missing required fields
      expect(data.errors).toBeDefined();
    });

    it("should return 400 for invalid Spanish phone number", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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

      // Verify ElevenLabs API was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("elevenlabs.io");
      expect(url).toContain("outbound-call");
      expect(options.method).toBe("POST");
      expect(options.headers["xi-api-key"]).toBe("test-api-key");
    });

    it("should reject configured booking requests without an idempotency key", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Idempotency key");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not place a duplicate call when the idempotency key is already claimed", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "booking-dup-1",
        },
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

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toContain("already being processed");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fail before the call when the idempotency claim cannot be persisted", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "Database unavailable" },
        }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "booking-db-fail-1",
        },
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

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Could not persist");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should NOT say reservation is confirmed in initiated response", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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

      // The response must make clear this is NOT a confirmed reservation
      expect(data.message).toContain("NOT confirmed yet");
      expect(data.message).not.toContain("confirmed your reservation");
      // Must instruct the agent what to tell the user
      expect(data.message).toContain("DO NOT tell the user");
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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

    it("should store pending booking after successful call initiation", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
          special_requests: "Trona para bebé",
        }),
      });

      await POST(request);

      // Verify pending booking was initially inserted with status='initiating' (BE-B6 fix)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotency_key: "test-idempotency-key",
          venue_name: "Casa Gerardo",
          venue_phone: "+34985887797",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
          party_size: 4,
          booking_date: "hoy",
          booking_time: "21:00",
          special_requests: "Trona para bebé",
          status: "initiating",
        })
      );
      // After call completes, the row should be updated with conversation_id and status=pending
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: "conv_123456789",
          status: "pending",
        })
      );
    });

    it("should include SMS note in message when sms_booking_confirmation is enabled", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).toContain("SMS");
      expect(data.message).toContain("+34612345678");
    });

    it("should not include SMS note when sms_booking_confirmation is disabled", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockIsFeatureFlagEnabled.mockImplementation((key: string) => {
        if (key === "booking_system") return Promise.resolve(true);
        if (key === "sms_booking_confirmation") return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_123456789" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.message).not.toContain("SMS");
    });

    it("should fail when the pending booking claim cannot be persisted", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Simulate DB error on the insert().select("id") chain
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: "Database error" } }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Could not persist");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle fetch throwing a network error during ElevenLabs call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock fetch throwing a network error
      mockFetch.mockRejectedValueOnce(new Error("Network error: connection refused"));

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
    });

    it("#455 BE-H1: should mark the pending booking failed immediately when ElevenLabs initiation fails", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockRejectedValueOnce(new Error("Network error: connection refused"));

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "initiation-fails-row-failed",
        },
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
      expect(data.status).toBe("failed");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          outcome_message: expect.stringContaining("Network error"),
        })
      );
    });

    it("#456 BE-H2: should degrade when conversation_id persistence fails after the call is accepted", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_persist_failure" }),
      });

      const mockEq = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: "conversation_id unique violation" } })
        .mockResolvedValueOnce({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEq });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "conversation-id-update-fails",
        },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.success).toBe(false);
      expect(data.status).toBe("degraded");
      expect(data.recovery_action).toContain("manual");
      expect(mockUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          conversation_id: "conv_persist_failure",
          status: "pending",
        })
      );
      expect(mockUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          status: "failed",
          outcome_message: expect.stringContaining("conv_persist_failure"),
        })
      );
    });

    it("should handle ElevenLabs API error with message field (not detail)", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock ElevenLabs error with 'message' field instead of 'detail.message'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
      expect(data.message).toContain("Server error");
    });

    it("should use correct date formatting in dynamic variables", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Test with day of week - should get "el" prefix
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_111" }),
      });

      const request1 = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "viernes",
          time: "20:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request1);

      const [, options1] = mockFetch.mock.calls[0];
      const body1 = JSON.parse(options1.body);
      expect(body1.conversation_initiation_client_data.dynamic_variables.date).toBe("el viernes");

      // Test with "hoy" - should NOT get "el" prefix
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_222" }),
      });

      const request2 = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "hoy",
          time: "20:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request2);

      const [, options2] = mockFetch.mock.calls[1];
      const body2 = JSON.parse(options2.body);
      expect(body2.conversation_initiation_client_data.dynamic_variables.date).toBe("hoy");
    });

    it("should convert various time formats", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Test "14:30" → "dos y media de la tarde"
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_t1" }),
      });

      const request1 = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "hoy",
          time: "14:30",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request1);
      const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body1.conversation_initiation_client_data.dynamic_variables.time).toBe("dos y media de la tarde");

      // Test "9:15" → "nueve y cuarto de la mañana"
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_t2" }),
      });

      const request2 = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "hoy",
          time: "9:15",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request2);
      const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body2.conversation_initiation_client_data.dynamic_variables.time).toBe("nueve y cuarto de la mañana");

      // Test "12:45" → "una menos cuarto de la tarde"
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_t3" }),
      });

      const request3 = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "hoy",
          time: "12:45",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request3);
      const body3 = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(body3.conversation_initiation_client_data.dynamic_variables.time).toBe("una menos cuarto de la mañana");
    });

    it("should fail when the pending booking claim throws", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock insert().select() to throw an exception (not return an error object)
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockRejectedValueOnce(new Error("Connection timeout")),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Could not persist");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle missing booking agent ID", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      // ELEVENLABS_BOOKING_AGENT_ID is NOT set

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
      expect(data.message).toContain("not configured");
    });

    it("should normalize phone number starting with 34 without + prefix", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_norm" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "34985887797", // Starts with 34 but no +
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // normalizePhoneNumber should add + prefix
      expect(body.to_number).toBe("+34985887797");
    });

    it("should preserve date that already starts with 'el'", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_el" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "el viernes",
          time: "20:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // Should NOT double-prefix with "el el viernes"
      expect(body.conversation_initiation_client_data.dynamic_variables.date).toBe("el viernes");
    });

    it("should pass through natural language time formats unchanged", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_natural_time" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "esta noche",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // Non-clock format should be returned as-is
      expect(body.conversation_initiation_client_data.dynamic_variables.time).toBe("esta noche");
    });

    it("should convert odd-minute times like 14:20", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_odd" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "14:20",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // 14:20 → "dos y 20 de la tarde"
      expect(body.conversation_initiation_client_data.dynamic_variables.time).toBe("dos y 20 de la tarde");
    });

    it("should handle request.json() throwing", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: "not valid json{{{",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.status).toBe("failed");
    });

    it("should return 'Unknown error' when catch receives a non-Error object", async () => {
      // Override request.json to throw a non-Error value
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({}),
      });
      // Override json() to throw a non-Error
      request.json = () => { throw 42; };

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Unknown error");
    });

    it("should use callSid as conversationId fallback when conversationId is undefined", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock ElevenLabs returning callSid but no conversation_id
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            callSid: "CA_abc123",
            // conversation_id intentionally omitted
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.call_sid).toBe("CA_abc123");

      // Verify the row was updated with callSid as conversation_id (BE-B6 flow)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: "CA_abc123",
        })
      );
    });

    it("should skip pending booking insert when no conversationId or callSid", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock ElevenLabs returning neither conversation_id nor callSid
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            // no conversation_id and no callSid
          }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // BE-B6: insert is always called before the call (with status=initiating)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: "initiating" })
      );
      // update should NOT be called since there was no conversationId or callSid to set
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should return 400 with Zod errors when venue_name and phone_number are missing (Zod validates before feature flag check)", async () => {
      mockIsFeatureFlagEnabled.mockImplementation((key: string) => {
        if (key === "booking_system") return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          // No venue_name or phone_number provided
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Zod validates before the feature flag check — missing required fields → 400
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should handle ElevenLabs error with neither detail.message nor message", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock ElevenLabs error with no useful message fields
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ some_field: "unrelated" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
      // Should fall back to "ElevenLabs API error: 502"
      expect(data.message).toContain("ElevenLabs API error: 502");
    });

    it("should handle midnight time (0:00) correctly", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_midnight" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Late Night Bar",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "0:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // hour 0 → hour12 = 12 → "doce de la noche"
      expect(body.conversation_initiation_client_data.dynamic_variables.time).toBe("doce de la noche");
    });

    it("should handle formatDateNatural with pasado mañana", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_pasado" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "pasado mañana",
          time: "20:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // "pasado mañana" should NOT get "el" prefix
      expect(body.conversation_initiation_client_data.dynamic_variables.date).toBe("pasado mañana");
    });

    it("should handle :45 time at hour 12 wrapping to 1 (12:45 → una menos cuarto)", async () => {
      // This specifically tests the branch: hour12 === 12 ? 1 : hour12 + 1
      // For 12:45 → hour=12, hour12=12 → nextHour should be 1
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_1245" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "0:45",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // hour=0 → hour12=12 → nextHour = 1 → "una menos cuarto de la noche"
      expect(body.conversation_initiation_client_data.dynamic_variables.time).toBe("una menos cuarto de la noche");
    });

    it("should handle :45 time at non-12 hour (13:45 → dos menos cuarto)", async () => {
      // This tests lines 157-158: hour12 !== 12 branch → nextHour = hour12 + 1
      // 13:45 → hour=13, hour12=1, nextHour=2 → "dos menos cuarto de la tarde"
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_1345" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "13:45",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // hour=13 → hour12=1 → nextHour=2 → "dos menos cuarto de la tarde"
      expect(body.conversation_initiation_client_data.dynamic_variables.time).toBe("dos menos cuarto de la tarde");
    });

    it("should handle non-Error throw inside initiateCall catch", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Mock fetch to throw a non-Error value (string, number, etc.)
      mockFetch.mockRejectedValueOnce("non-error string");

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
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
      expect(data.message).toContain("Unknown error");
    });

    // === #386 (BE-B1): pre-call row must be nullable + fatal on failure ===

    it("#386 BE-B1: should insert pending_bookings row with NULL conversation_id BEFORE placing the call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      const insertedData: unknown[] = [];
      mockInsert.mockImplementation((data: unknown) => {
        insertedData.push(data);
        return { select: vi.fn().mockResolvedValue({ data: [{ id: "pre-call-row" }], error: null }) };
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_be_b1" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "be-b1-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      await POST(request);

      expect(insertedData.length).toBeGreaterThan(0);
      const firstInsert = insertedData[0] as Record<string, unknown>;
      // conversation_id MUST be null on the pre-call insert (nullable column)
      expect(firstInsert.conversation_id).toBeNull();
      // status must be 'initiating' (pre-call state)
      expect(firstInsert.status).toBe("initiating");
      // idempotency_key must be set
      expect(firstInsert.idempotency_key).toBe("be-b1-key");
    });

    it("#386 BE-B1: persistence failure must be fatal — ElevenLabs must NOT be called", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: null, error: { message: "connection timeout" } }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "be-b1-fatal-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Persistence failure MUST return 500 (fatal — not silently ignored)
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      // ElevenLabs call MUST NOT have been placed
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // === #398 (BE-H1): idempotency key required; duplicate key claims rejected ===

    it("#398 BE-H1: should require an idempotency key before placing the outbound call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // No Idempotency-Key header
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Idempotency key");
      // ElevenLabs call MUST NOT be placed without a key
      expect(mockFetch).not.toHaveBeenCalled();
      // DB insert MUST NOT be attempted without a key
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("#398 BE-H1: duplicate idempotency key must return 409 without placing a second call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Simulate Postgres UNIQUE constraint violation (23505) on the idempotency_key column
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "idempotent-key-already-claimed",
        },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Must return 409 Conflict — not 500
      expect(response.status).toBe(409);
      expect(data.status).toBe("duplicate");
      // Second outbound call MUST NOT be placed
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should default special_requests to 'ninguna' when not provided", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_no_special" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "20:00",
          customer_name: "Test User",
          customer_phone: "612345678",
          // No special_requests
        }),
      });

      await POST(request);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.conversation_initiation_client_data.dynamic_variables.special_requests).toBe("ninguna");
    });

    // === BE-B6: Race condition fix — insert BEFORE placing the call ===

    it("BE-B6: should insert pending_bookings with status=initiating BEFORE placing the ElevenLabs call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      const callOrder: string[] = [];

      mockInsert.mockImplementation(() => ({
        select: vi.fn().mockImplementation(async () => {
          callOrder.push("insert");
          return { data: [{ id: "pending-row-id" }], error: null };
        }),
      }));

      mockFetch.mockImplementation(async () => {
        callOrder.push("elevenlabs_call");
        return {
          ok: true,
          json: () => Promise.resolve({ conversation_id: "conv_race_test" }),
        };
      });

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockImplementation(async () => {
          callOrder.push("update");
          return { error: null };
        }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      await POST(request);

      // Insert must happen BEFORE the ElevenLabs call
      expect(callOrder.indexOf("insert")).toBeLessThan(callOrder.indexOf("elevenlabs_call"));
      // Update must happen AFTER the ElevenLabs call
      expect(callOrder.indexOf("update")).toBeGreaterThan(callOrder.indexOf("elevenlabs_call"));
    });

    it("BE-B6: should insert with status=initiating and no conversation_id before the call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_before_test" }),
      });

      const insertCalls: unknown[] = [];
      mockInsert.mockImplementation((data: unknown) => {
        insertCalls.push(data);
        return { select: vi.fn().mockResolvedValue({ data: [{ id: "pending-row-id" }], error: null }) };
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      await POST(request);

      // The first insert call should have status='initiating'
      expect(insertCalls.length).toBeGreaterThan(0);
      const firstInsert = insertCalls[0] as Record<string, unknown>;
      expect(firstInsert.status).toBe("initiating");
    });

    it("BE-B6: should update the pending_bookings row with conversation_id and status=pending after the call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_update_test" }),
      });

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEq });

      // Make insert().select("id") return a row with an id so the update can reference it
      mockInsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "pending-row-id" }], error: null }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      await POST(request);

      // After the call, update should set conversation_id and status=pending
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: "conv_update_test",
          status: "pending",
        })
      );
    });

    it("BE-B6: should stop before the call if the pre-call insert fails", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockInsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB insert failed" } }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_insert_fail" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Could not persist");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("BE-B6: should fail when pre-call insert returns empty data array (missing pendingRowId, lines 472-476)", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Insert succeeds but returns an empty array — no row id available
      mockInsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Could not persist");
      // ElevenLabs must NOT be called since no row ID was obtained
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("BE-B6: should degrade gracefully when conversation_id update throws a DB exception (lines 523-535)", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Pre-call insert succeeds with a valid row id
      mockInsert.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "pending-row-id" }], error: null }),
      });

      // ElevenLabs call succeeds with a conversation_id
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_update_throw" }),
      });

      // The conversation_id update throws (network/connection failure, not just an error object)
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error("DB connection lost during update")),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 4,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García López",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Call was initiated but conversation_id could not be persisted — degraded 202 response
      expect(response.status).toBe(202);
      expect(data.success).toBe(false);
      expect(data.status).toBe("degraded");
    });

    // -----------------------------------------------------------------------
    // Zod validation tests (issue #270)
    // -----------------------------------------------------------------------

    it("should return 400 with field errors when party_size is a non-numeric string", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: "abc",
          date: "hoy",
          time: "21:00",
          customer_name: "Juan",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should return 400 with field errors when party_size is NaN (passed as string '0abc')", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: "0abc",
          date: "hoy",
          time: "21:00",
          customer_name: "Juan",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 when party_size exceeds maximum of 50", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 999,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should return 400 when party_size is zero or negative", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 0,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 when venue_name exceeds 200 characters", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          venue_name: "A".repeat(201),
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return 400 when MCP-nested party_size is non-numeric string", async () => {
      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mcp-secret": MCP_SECRET, "idempotency-key": "test-idempotency-key" },
        body: JSON.stringify({
          tool: "make_booking",
          arguments: {
            venue_name: "Casa Gerardo",
            phone_number: "+34985887797",
            party_size: "twelve",
            date: "hoy",
            time: "21:00",
            customer_name: "Juan",
            customer_phone: "612345678",
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("line 98 — markPendingBookingFailed logs when its own DB update errors", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_mark_fail_test" }),
      });

      // First eq() call: conversation_id update fails → markPendingBookingFailed is called
      // Second eq() call: the update inside markPendingBookingFailed also returns an error → line 98
      const mockEq = vi
        .fn()
        .mockResolvedValueOnce({ error: { message: "conv_id persistence failed" } })
        .mockResolvedValueOnce({ error: { message: "marking failed also failed" } });
      mockUpdate.mockReturnValue({ eq: mockEq });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "line-98-coverage-key",
        },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34 985 88 77 97",
          party_size: 2,
          date: "hoy",
          time: "21:00",
          customer_name: "Juan García",
          customer_phone: "+34612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Still returns the degraded response — line 98 logged the error internally
      expect(response.status).toBe(202);
      expect(data.status).toBe("degraded");
      // Both update calls were made
      expect(mockEq).toHaveBeenCalledTimes(2);
    });

    // === BE-H4: AbortSignal.timeout on ElevenLabs fetch ===

    it("BE-H4: should pass AbortSignal.timeout(15000) to the ElevenLabs fetch call", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ conversation_id: "conv_timeout_test" }),
      });

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "be-h4-test-key",
        },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "21:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      // The fetch must include a signal for timeout
      expect(options.signal).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it("BE-H4: should return 500 with failed status when ElevenLabs fetch times out (AbortError)", async () => {
      process.env.ELEVENLABS_API_KEY = "test-api-key";
      process.env.ELEVENLABS_PHONE_NUMBER_ID = "test-phone-id";
      process.env.ELEVENLABS_BOOKING_AGENT_ID = "test-booking-agent-id";

      // Simulate a timeout by throwing a DOMException with name "TimeoutError"
      const abortError = new DOMException("The operation was aborted due to timeout", "TimeoutError");
      mockFetch.mockRejectedValueOnce(abortError);

      const request = new Request("http://localhost:3000/api/mcp/make-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mcp-secret": MCP_SECRET,
          "idempotency-key": "be-h4-timeout-key",
        },
        body: JSON.stringify({
          venue_name: "Casa Gerardo",
          phone_number: "+34985887797",
          party_size: 2,
          date: "hoy",
          time: "21:00",
          customer_name: "Test User",
          customer_phone: "612345678",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.status).toBe("failed");
    });
  });
});
