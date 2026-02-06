import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/costs", () => ({
  getManualCost: vi.fn(),
  updateManualCost: vi.fn(),
  deleteManualCost: vi.fn(),
}));

import { validateAdminAuth } from "@/lib/admin-auth";
import { getManualCost, updateManualCost, deleteManualCost } from "@/lib/costs";
import type { CostCategory } from "@/types/costs-analytics";
import { GET, PUT, DELETE } from "./route";

const mockEntry = {
  id: "entry-1",
  serviceId: "custom-service",
  serviceName: "Custom Service",
  category: "infrastructure" as CostCategory,
  costUsd: 25.0,
  billingPeriodStart: "2026-02-01",
  billingPeriodEnd: "2026-02-28",
  notes: null,
  createdBy: "user-1",
  createdAt: "2026-02-06T10:00:00Z",
  updatedAt: "2026-02-06T10:00:00Z",
};

function makeRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/costs-analytics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1");
    const response = await GET(request, makeRouteParams("entry-1"));

    expect(response.status).toBe(401);
  });

  it("should return a cost entry by id", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(getManualCost).mockResolvedValue(mockEntry);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1");
    const response = await GET(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe("entry-1");
    expect(data.data.serviceId).toBe("custom-service");
    expect(getManualCost).toHaveBeenCalledWith("entry-1");
  });

  it("should return 404 when entry not found", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(getManualCost).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/nonexistent");
    const response = await GET(request, makeRouteParams("nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Cost entry not found");
  });

  it("should return 500 when getManualCost throws", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(getManualCost).mockRejectedValue(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1");
    const response = await GET(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch cost entry");
  });
});

describe("PUT /api/admin/costs-analytics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "PUT",
      body: JSON.stringify({ costUsd: 30 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request, makeRouteParams("entry-1"));

    expect(response.status).toBe(401);
  });

  it("should update a cost entry", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const updatedEntry = { ...mockEntry, costUsd: 30.0 };
    vi.mocked(updateManualCost).mockResolvedValue(updatedEntry);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "PUT",
      body: JSON.stringify({ costUsd: 30 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.costUsd).toBe(30.0);
    expect(updateManualCost).toHaveBeenCalledWith("entry-1", { costUsd: 30 });
  });

  it("should return 500 when updateManualCost returns null", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(updateManualCost).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "PUT",
      body: JSON.stringify({ costUsd: 30 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update cost entry");
  });

  it("should return 500 when updateManualCost throws", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(updateManualCost).mockRejectedValue(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "PUT",
      body: JSON.stringify({ costUsd: 30 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update cost entry");
  });
});

describe("DELETE /api/admin/costs-analytics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeRouteParams("entry-1"));

    expect(response.status).toBe(401);
  });

  it("should delete a cost entry", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(deleteManualCost).mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe("entry-1");
    expect(data.data.deleted).toBe(true);
    expect(deleteManualCost).toHaveBeenCalledWith("entry-1");
  });

  it("should return 500 when deleteManualCost returns false", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(deleteManualCost).mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete cost entry");
  });

  it("should return 500 when deleteManualCost throws", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });
    vi.mocked(deleteManualCost).mockRejectedValue(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/admin/costs-analytics/entry-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, makeRouteParams("entry-1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete cost entry");
  });
});
