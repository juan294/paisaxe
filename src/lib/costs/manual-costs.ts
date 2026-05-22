import "server-only";
import { createAdminClient } from "@/lib/supabase";
import type {
  ManualCostEntry,
  CreateManualCostRequest,
  UpdateManualCostRequest,
  ServiceCost,
  CostCategory,
} from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

/**
 * Fetches all manual cost entries for a date range.
 */
export async function fetchManualCosts(
  startDate: string,
  endDate: string
): Promise<ServiceCost[]> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("platform_costs")
      .select("*")
      .gte("billing_period_start", startDate)
      .lte("billing_period_end", endDate)
      .order("billing_period_start", { ascending: false });

    if (error) {
      console.error("Error fetching manual costs:", error);
      return [];
    }

    return (data || []).map((entry: ManualCostEntry) => ({
      serviceId: entry.serviceId,
      serviceName: entry.serviceName,
      category: entry.category as CostCategory,
      costUsd: entry.costUsd,
      costFormatted: formatUsd(entry.costUsd),
      source: "manual" as const,
      billingPeriodStart: entry.billingPeriodStart,
      billingPeriodEnd: entry.billingPeriodEnd,
      dashboardUrl: getServiceDashboardUrl(entry.serviceId),
      notes: entry.notes || undefined,
    }));
  } catch (error) {
    console.error("Error in fetchManualCosts:", error);
    return [];
  }
}

/**
 * Creates a new manual cost entry.
 */
export async function createManualCost(
  request: CreateManualCostRequest,
  userId?: string
): Promise<ManualCostEntry | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("platform_costs")
      .insert({
        service_id: request.serviceId,
        service_name: request.serviceName,
        category: request.category,
        cost_usd: request.costUsd,
        billing_period_start: request.billingPeriodStart,
        billing_period_end: request.billingPeriodEnd,
        notes: request.notes || null,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating manual cost:", error);
      return null;
    }

    return mapDbToManualCostEntry(data);
  } catch (error) {
    console.error("Error in createManualCost:", error);
    return null;
  }
}

/**
 * Updates an existing manual cost entry.
 */
export async function updateManualCost(
  id: string,
  request: UpdateManualCostRequest
): Promise<ManualCostEntry | null> {
  try {
    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (request.costUsd !== undefined) {
      updates.cost_usd = request.costUsd;
    }
    if (request.notes !== undefined) {
      updates.notes = request.notes;
    }

    const { data, error } = await supabase
      .from("platform_costs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating manual cost:", error);
      return null;
    }

    return mapDbToManualCostEntry(data);
  } catch (error) {
    console.error("Error in updateManualCost:", error);
    return null;
  }
}

/**
 * Deletes a manual cost entry.
 */
export async function deleteManualCost(id: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("platform_costs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting manual cost:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteManualCost:", error);
    return false;
  }
}

/**
 * Gets a single manual cost entry by ID.
 */
export async function getManualCost(id: string): Promise<ManualCostEntry | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("platform_costs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching manual cost:", error);
      return null;
    }

    return mapDbToManualCostEntry(data);
  } catch (error) {
    console.error("Error in getManualCost:", error);
    return null;
  }
}

// Helper to map database record to TypeScript type
function mapDbToManualCostEntry(data: Record<string, unknown>): ManualCostEntry {
  return {
    id: data.id as string,
    serviceId: data.service_id as string,
    serviceName: data.service_name as string,
    category: data.category as CostCategory,
    costUsd: data.cost_usd as number,
    billingPeriodStart: data.billing_period_start as string,
    billingPeriodEnd: data.billing_period_end as string,
    notes: data.notes as string | null,
    createdBy: data.created_by as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function getServiceDashboardUrl(serviceId: string): string | undefined {
  const service = Object.values(PLATFORM_SERVICES).find(
    (s) => s.id === serviceId
  );
  return service?.dashboardUrl;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
