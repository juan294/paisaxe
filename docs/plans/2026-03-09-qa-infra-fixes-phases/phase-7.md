# Phase 7: MCP Endpoint E2E Tests `[batch-eligible]`

> **Files**: `e2e/mcp.spec.ts` (new)
> **Estimated effort**: Medium

## Problem

`/api/mcp/*` endpoints accept external input from ElevenLabs with 0% E2E coverage. These are the only external-facing API routes besides chat — they need at minimum smoke tests for auth rejection and response shape validation.

## Architecture Context

All MCP endpoints:
- Auth: `validateMcpSecret()` via `x-mcp-secret` header (constant-time comparison with `MCP_API_SECRET` env var)
- CSRF exempt (in `CSRF_EXEMPT_PREFIXES`)
- Support dual request formats: flat JSON (ElevenLabs webhook) and `{ arguments: {...} }` (MCP tool call)

| Endpoint | Method | Rate Limit | External API |
|----------|--------|------------|-------------|
| `/api/mcp/places` | GET/POST | 20/min | Google Places |
| `/api/mcp/weather` | GET/POST | 30/min | OpenWeatherMap |
| `/api/mcp/make-booking` | POST | None | ElevenLabs outbound |
| `/api/mcp/make-booking/status` | POST | None | Twilio callback |

## Changes

### Create `e2e/mcp.spec.ts`

```pseudo
import { test, expect } from "@playwright/test";

test.describe("MCP endpoint smoke tests", () => {

  // --- Auth rejection tests ---

  test("GET /api/mcp/places rejects without secret", async ({ request }) => {
    const response = await request.get("/api/mcp/places?query=restaurants");
    expect(response.status()).toBe(401);
  });

  test("POST /api/mcp/weather rejects without secret", async ({ request }) => {
    const response = await request.post("/api/mcp/weather", {
      data: { city: "Oviedo" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/mcp/make-booking rejects without secret", async ({ request }) => {
    const response = await request.post("/api/mcp/make-booking", {
      data: { venue_name: "Test" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/mcp/make-booking/status rejects without secret", async ({ request }) => {
    const response = await request.post("/api/mcp/make-booking/status", {
      data: {},
    });
    // This endpoint may not validate auth the same way — verify during implementation
    expect([401, 400]).toContain(response.status());
  });

  // --- Input validation tests (with mock secret if MCP_API_SECRET is set) ---

  test("GET /api/mcp/places rejects invalid type", async ({ request }) => {
    const secret = process.env.MCP_API_SECRET;
    test.skip(!secret, "MCP_API_SECRET not set");

    const response = await request.get("/api/mcp/places?query=test&type=invalid_type", {
      headers: { "x-mcp-secret": secret! },
    });
    // Should reject invalid place type or return empty results
    expect([200, 400]).toContain(response.status());
  });

  test("POST /api/mcp/make-booking rejects invalid phone", async ({ request }) => {
    const secret = process.env.MCP_API_SECRET;
    test.skip(!secret, "MCP_API_SECRET not set");

    const response = await request.post("/api/mcp/make-booking", {
      headers: { "x-mcp-secret": secret! },
      data: {
        venue_name: "Test Restaurant",
        phone_number: "+34123456789",
        party_size: 2,
        date: "tomorrow",
        time: "21:00",
        customer_name: "Test",
        customer_phone: "invalid-phone",  // Invalid format
      },
    });
    expect(response.status()).toBe(400);
  });
});
```

### Update Playwright config — add MCP to excluded patterns

The `desktop` and `mobile` projects exclude `qa-journey` and `visual-regression`. MCP tests should run in both or have their own project. During implementation, check if they need special config or can run with the default projects.

## Verification

```bash
# Run MCP tests specifically
npx playwright test mcp.spec.ts

# Auth rejection tests should pass without MCP_API_SECRET
# Input validation tests skip gracefully without the secret
```

## Notes

- Auth rejection tests work without any env vars — they verify the 401 response
- Input validation tests are conditional on `MCP_API_SECRET` being set
- These tests do NOT call external APIs (Google Places, OpenWeatherMap) — they test auth and input validation only
- The make-booking endpoint also checks `booking_system` feature flag — if disabled, it returns 503
- During implementation, read each route handler to verify exact error codes
