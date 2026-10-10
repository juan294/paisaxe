"use client";

import { useState, useCallback } from "react";
import {
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
} from "@/lib/admin-api";
import { useAnalyticsData } from "../analytics-cache-context";
import { AlertCircle, Receipt, Plus } from "lucide-react";
import type {
  CostsAnalyticsDashboardData,
  ServiceCost,
  CreateManualCostRequest,
} from "@/types/costs-analytics";
import { StatCard, CostChart, ServiceBreakdownTable } from "./chart";
import { AddCostModal, EditCostModal } from "./modals";
import { ScalingForecastSection } from "./forecast";
import { TierAlertsSection } from "./alerts";
import { SkeletonCostsDashboard } from "./skeletons";

export function CostsAnalyticsPanel() {
  const [mutationError, setMutationError] = useState("");
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: firstOfMonth.toISOString().split("T")[0],
      to: now.toISOString().split("T")[0],
    };
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCost, setEditingCost] = useState<ServiceCost | null>(null);

  const params = JSON.stringify({ from: dateRange.from, to: dateRange.to });
  const { data, isLoading, isRefreshing, error: fetchError, refresh } = useAnalyticsData(
    "costs",
    useCallback(() => fetchCostsAnalytics(dateRange.from, dateRange.to), [dateRange.from, dateRange.to]),
    params
  );

  const error = mutationError || fetchError;

  const handleAddCost = async (formData: CreateManualCostRequest) => {
    const result = await createManualCostEntry(formData);
    if (result.error) {
      setMutationError(result.error);
    } else {
      setShowAddModal(false);
      setMutationError("");
      refresh();
    }
  };

  const handleDeleteCost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cost entry?")) {
      return;
    }
    const result = await deleteManualCostEntry(id);
    if (result.error) {
      setMutationError(result.error);
    } else {
      setMutationError("");
      refresh();
    }
  };

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
          Platform Costs
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-admin-muted dark:text-admin-subtle">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, from: e.target.value }))
              }
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
            <span>—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, to: e.target.value }))
              }
              className="bg-transparent outline-none rounded focus-visible:ring-1 focus-visible:ring-white/40"
            />
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-muted transition-colors hover:text-admin-ink disabled:opacity-50 dark:text-admin-subtle dark:hover:text-admin-paper"
          >
            {isLoading ? "Loading..." : isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {isRefreshing && (
        <div className="h-0.5 w-full animate-pulse rounded-full bg-blue-500/30" />
      )}

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <SkeletonCostsDashboard />
      ) : data && isEmptyData(data) ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
          <Receipt className="h-8 w-8 text-admin-line" />
          <p className="text-2xl font-extralight text-admin-subtle">
            No cost data yet
          </p>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
            Add manual costs or configure API keys
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 rounded-full bg-admin-ink px-4 py-2 text-sm font-medium text-admin-paper hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
          >
            <Plus className="h-4 w-4" />
            Add Manual Cost
          </button>
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
            <StatCard
              value={data.summary.totalMonthlyFormatted}
              label="Total Monthly"
              color="rose"
            />
            <StatCard
              value={data.summary.thirtyDayFormatted}
              label="30-Day Costs"
              color="orange"
            />
            <StatCard
              value={data.summary.servicesTracked}
              label="Services Tracked"
              color="blue"
            />
            <StatCard
              value={data.summary.automatedServices}
              label="Auto-Tracked"
              color="emerald"
            />
          </section>

          {/* Cost Chart */}
          {data.costsByDay.length > 0 && (
            <section>
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                Daily Costs
              </h2>
              <CostChart data={data.costsByDay} />
            </section>
          )}

          {/* Service Breakdown */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
                Service Breakdown
              </h3>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 rounded-lg bg-admin-paper px-3 py-1.5 font-mono text-xs text-admin-muted transition-colors hover:bg-admin-line dark:bg-admin-depth dark:text-admin-subtle dark:hover:bg-[#4d4a44]"
              >
                <Plus className="h-3 w-3" />
                Add Cost
              </button>
            </div>
            <ServiceBreakdownTable
              services={data.services}
              onEdit={setEditingCost}
              onDelete={handleDeleteCost}
            />
          </section>

          {/* Scaling Forecast */}
          <ScalingForecastSection
            services={data.services}
            dateRange={dateRange}
          />

          {/* Tier Upgrade Alerts */}
          <TierAlertsSection dateRange={dateRange} />
        </>
      ) : null}

      {/* Add Cost Modal */}
      {showAddModal && (
        <AddCostModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddCost}
          dateRange={dateRange}
        />
      )}

      {/* Edit Cost Modal */}
      {editingCost && (
        <EditCostModal
          cost={editingCost}
          onClose={() => setEditingCost(null)}
          onSave={async (id, updates) => {
            const result = await updateManualCostEntry(id, updates);
            if (result.error) {
              setMutationError(result.error);
            } else {
              setEditingCost(null);
              setMutationError("");
              refresh();
            }
          }}
        />
      )}
    </div>
  );
}

function isEmptyData(data: CostsAnalyticsDashboardData): boolean {
  return data.services.length === 0;
}
