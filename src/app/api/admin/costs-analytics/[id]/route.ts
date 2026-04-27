import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  getManualCost,
  updateManualCost,
  deleteManualCost,
} from "@/lib/costs";
import type { UpdateManualCostRequest } from "@/types/costs-analytics";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/costs-analytics/[id]
 * Gets a single manual cost entry.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  try {
    const entry = await getManualCost(id);

    if (!entry) {
      return NextResponse.json(
        { error: "Cost entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    logger.error("Get manual cost error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch cost entry" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/costs-analytics/[id]
 * Updates a manual cost entry.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  try {
    const body: UpdateManualCostRequest = await request.json();

    const entry = await updateManualCost(id, body);

    if (!entry) {
      return NextResponse.json(
        { error: "Failed to update cost entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    logger.error("Update manual cost error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to update cost entry" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/costs-analytics/[id]
 * Deletes a manual cost entry.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  try {
    const success = await deleteManualCost(id);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete cost entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    logger.error("Delete manual cost error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to delete cost entry" },
      { status: 500 }
    );
  }
}
