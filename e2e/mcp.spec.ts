import { test, expect } from "./fixtures/base-test";
import { E2E_MCP_SECRET } from "./fixtures/mcp-secret";

/**
 * Playwright API tests for MCP routes.
 *
 * Routes under test:
 *   GET  /api/mcp/places              — search Asturias places (Google Places)
 *   POST /api/mcp/places              — MCP tool-call format
 *   GET  /api/mcp/weather             — weather lookup (OpenWeatherMap)
 *   POST /api/mcp/weather             — MCP tool-call format
 *   POST /api/mcp/make-booking        — ElevenLabs outbound call booking
 *   GET  /api/mcp/make-booking        — endpoint documentation / health
 *   POST /api/mcp/make-booking/status — Twilio status callback (no auth required)
 *
 * Auth: all routes except /status require `x-mcp-secret` header.
 * Missing or wrong secret → 401.
 *
 * Upstream dependencies (Google Places, OpenWeatherMap, ElevenLabs, Supabase)
 * are NOT available in test environments, so authenticated probes assert
 * routing, validation and auth behaviour rather than live upstream results.
 *
 * Nothing here skips. These probes previously opted out whenever MCP_API_SECRET
 * was unset — which in CI was always, leaving 16 of 31 probes unexercised
 * behind a green suite. The runner and the app under test now share
 * E2E_MCP_SECRET, so every probe runs on every CI run.
 */

const WRONG_SECRET = "definitely-wrong-secret-value-12345";

// ---------------------------------------------------------------------------
// GET /api/mcp/places
// ---------------------------------------------------------------------------

test.describe("GET /api/mcp/places", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.get("/api/mcp/places?query=fabada");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({ request }) => {
    const response = await request.get("/api/mcp/places?query=fabada", {
      headers: { "x-mcp-secret": WRONG_SECRET },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when query param is missing", async ({ request }) => {
    // No MCP_API_SECRET in test env → 401, but if secret IS set we get 400.
    // This test only exercises the validation branch; skip when secret absent.
    const response = await request.get("/api/mcp/places", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when query param is empty string", async ({ request }) => {
    const response = await request.get("/api/mcp/places?query=", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test(
    "returns JSON response with correct shape when secret is valid",
    async ({ request }) => {
      const response = await request.get("/api/mcp/places?query=fabada", {
        headers: { "x-mcp-secret": E2E_MCP_SECRET },
      });
      // With no GOOGLE_PLACES_API_KEY in test env: 500 with { error: "..." }
      // With a real key: 200 with { places, query, city, type }
      expect([200, 500]).toContain(response.status());
      const body = await response.json();
      if (response.status() === 200) {
        expect(body).toHaveProperty("places");
        expect(body).toHaveProperty("query");
        expect(Array.isArray(body.places)).toBe(true);
      } else {
        expect(body).toHaveProperty("error");
      }
    }
  );
});

// ---------------------------------------------------------------------------
// POST /api/mcp/places
// ---------------------------------------------------------------------------

test.describe("POST /api/mcp/places", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/places", {
      data: { query: "sidra" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({ request }) => {
    const response = await request.post("/api/mcp/places", {
      headers: { "x-mcp-secret": WRONG_SECRET },
      data: { query: "sidra" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when query is missing from body", async ({ request }) => {
    const response = await request.post("/api/mcp/places", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("accepts flat format { query } with valid secret", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/places", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { query: "restaurante", city: "Oviedo" },
    });
    // 500 = upstream not configured, 200 = success
    expect([200, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty(response.status() === 200 ? "places" : "error");
  });

  test("accepts MCP tool-call format { arguments: { query } } with valid secret", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/places", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { arguments: { query: "museo", city: "Gijón" } },
    });
    expect([200, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty(response.status() === 200 ? "places" : "error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/mcp/weather
// ---------------------------------------------------------------------------

test.describe("GET /api/mcp/weather", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.get("/api/mcp/weather?city=Oviedo");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({ request }) => {
    const response = await request.get("/api/mcp/weather?city=Oviedo", {
      headers: { "x-mcp-secret": WRONG_SECRET },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when city param is missing", async ({ request }) => {
    const response = await request.get("/api/mcp/weather", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when city param is empty string", async ({ request }) => {
    const response = await request.get("/api/mcp/weather?city=", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test(
    "returns JSON response with correct shape when secret is valid",
    async ({ request }) => {
      const response = await request.get("/api/mcp/weather?city=Oviedo", {
        headers: { "x-mcp-secret": E2E_MCP_SECRET },
      });
      // 500 = upstream not configured, 200 = success
      expect([200, 500]).toContain(response.status());
      const body = await response.json();
      if (response.status() === 200) {
        expect(body).toHaveProperty("city");
        expect(body).toHaveProperty("temperature");
        expect(body).toHaveProperty("description");
        expect(body.units).toBe("metric");
      } else {
        expect(body).toHaveProperty("error");
      }
    }
  );
});

// ---------------------------------------------------------------------------
// POST /api/mcp/weather
// ---------------------------------------------------------------------------

test.describe("POST /api/mcp/weather", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/weather", {
      data: { city: "Oviedo" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({ request }) => {
    const response = await request.post("/api/mcp/weather", {
      headers: { "x-mcp-secret": WRONG_SECRET },
      data: { city: "Oviedo" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when city is missing from body", async ({ request }) => {
    const response = await request.post("/api/mcp/weather", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  test("accepts flat format { city } with valid secret", async ({ request }) => {
    const response = await request.post("/api/mcp/weather", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { city: "Gijón" },
    });
    expect([200, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty(
      response.status() === 200 ? "temperature" : "error"
    );
  });

  test("accepts MCP tool-call format { arguments: { city } } with valid secret", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/weather", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { arguments: { city: "Llanes" } },
    });
    expect([200, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty(
      response.status() === 200 ? "temperature" : "error"
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/make-booking
// ---------------------------------------------------------------------------

// Minimal valid booking payload
const VALID_BOOKING_PAYLOAD = {
  venue_name: "Casa Gerardo",
  phone_number: "985887797",
  party_size: 2,
  date: "mañana",
  time: "21:00",
  customer_name: "Ana García",
  customer_phone: "612345678",
};

test.describe("POST /api/mcp/make-booking", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/make-booking", {
      data: VALID_BOOKING_PAYLOAD,
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    // make-booking 401 uses { success, message } shape (not { error })
    expect(body).toHaveProperty("message");
    expect(body.success).toBe(false);
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({ request }) => {
    const response = await request.post("/api/mcp/make-booking", {
      headers: { "x-mcp-secret": WRONG_SECRET },
      data: VALID_BOOKING_PAYLOAD,
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("message");
    expect(body.success).toBe(false);
  });

  test("returns 400 when required fields are missing", async ({ request }) => {
    const response = await request.post("/api/mcp/make-booking", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { venue_name: "Test Restaurant" }, // missing required fields
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body).toHaveProperty("message");
  });

  test("returns 400 for invalid Spanish phone number", async ({ request }) => {
    const response = await request.post("/api/mcp/make-booking", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: {
        ...VALID_BOOKING_PAYLOAD,
        phone_number: "123", // too short / invalid
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("returns a booking response with valid secret and payload", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/make-booking", {
      headers: {
        "x-mcp-secret": E2E_MCP_SECRET,
        "Idempotency-Key": `test-${Date.now()}`,
      },
      data: VALID_BOOKING_PAYLOAD,
    });
    // Possible outcomes when ElevenLabs is not configured:
    //   200 not_configured (feature flag off or ElevenLabs env missing)
    //   400 idempotency key required (edge: flag on, ElevenLabs env set, no key in headers)
    //   500 upstream error
    expect([200, 400, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("message");
    // status field is present on all non-401 responses
    if (body.status) {
      expect([
        "initiated",
        "queued",
        "failed",
        "not_configured",
        "duplicate",
      ]).toContain(body.status);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/mcp/make-booking  (documentation / health — no auth required)
// ---------------------------------------------------------------------------

test.describe("GET /api/mcp/make-booking", () => {
  test("returns endpoint documentation without auth", async ({ request }) => {
    const response = await request.get("/api/mcp/make-booking");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("endpoint");
    expect(body).toHaveProperty("required_fields");
    expect(body).toHaveProperty("required_headers");
    expect(body).toHaveProperty("outbound_configured");
    expect(Array.isArray(body.required_fields)).toBe(true);
    // Spot-check: customer_phone must be listed as required
    expect(body.required_fields).toContain("customer_phone");
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/make-booking/status  (Twilio callback — no auth required)
// ---------------------------------------------------------------------------

test.describe("POST /api/mcp/make-booking/status", () => {
  test("returns 200 { received: true } with no auth header", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/make-booking/status", {
      data: {
        CallSid: "CA1234567890abcdef",
        CallStatus: "completed",
        To: "+34985887797",
        From: "+34000000000",
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
  });

  test("returns 200 { received: true } with an empty body", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/make-booking/status", {
      data: {},
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
  });
});

// ---------------------------------------------------------------------------
// POST /api/mcp/save-favorite
// ---------------------------------------------------------------------------

test.describe("POST /api/mcp/save-favorite", () => {
  test("returns 401 when x-mcp-secret header is missing", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/save-favorite", {
      data: { placeName: "Casa Marcial" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, message: "Unauthorized" });
  });

  test("returns 401 when x-mcp-secret header is wrong", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/save-favorite", {
      headers: { "x-mcp-secret": WRONG_SECRET },
      data: { placeName: "Casa Marcial" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, message: "Unauthorized" });
  });

  test("succeeds with valid secret and minimal { placeName } body", async ({
    request,
  }) => {
    const response = await request.post("/api/mcp/save-favorite", {
      headers: { "x-mcp-secret": E2E_MCP_SECRET },
      data: { placeName: "Casa Marcial" },
    });
    // With a reachable Supabase test project: 200 with { success: true }.
    // With a DB error in the test env: 500 with { success: false }.
    expect([200, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("message");
  });
});
