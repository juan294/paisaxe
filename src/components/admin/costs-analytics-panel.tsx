"use client";

import { useState, useCallback, useEffect } from "react";
import {
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
} from "@/lib/admin-api";
import { useAnalyticsData } from "./analytics-cache-context";
import {
  AlertCircle,
  Receipt,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import type {
  CostsAnalyticsDashboardData,
  ServiceCost,
  CostsByDay,
  CostCategory,
  CreateManualCostRequest,
  UsageMetrics,
  ForecastScenario,
} from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import { computeForecasts, computeTierAlerts } from "@/lib/costs";
import { SERVICE_TIERS } from "@/config/service-tiers";
import type { AlertLevel } from "@/config/service-tiers";
import type { TierAlert } from "@/lib/costs/tier-alerts";

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
        <h2 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Platform Costs
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[#6b6560] dark:text-[#a39e98]">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, from: e.target.value }))
              }
              className="bg-transparent outline-none"
            />
            <span>—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, to: e.target.value }))
              }
              className="bg-transparent outline-none"
            />
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
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
          <Receipt className="h-8 w-8 text-[#e5e3de]" />
          <p className="text-2xl font-extralight text-[#a39e98]">
            No cost data yet
          </p>
          <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
            Add manual costs or configure API keys
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 rounded-full bg-[#2d2a26] px-4 py-2 text-sm font-medium text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
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
              <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                Daily Costs
              </h2>
              <CostChart data={data.costsByDay} />
            </section>
          )}

          {/* Service Breakdown */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                Service Breakdown
              </h3>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 rounded-lg bg-[#f5f3ee] px-3 py-1.5 font-mono text-xs text-[#6b6560] transition-colors hover:bg-[#e5e3de] dark:bg-[#3d3a36] dark:text-[#a39e98] dark:hover:bg-[#4d4a44]"
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

interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "rose" | "orange";
}

const statColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  orange: "text-orange-600 dark:text-orange-400",
};

function StatCard({ value, label, color }: StatCardProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  const colorClass = color
    ? statColorClasses[color]
    : "text-[#2d2a26] dark:text-[#f5f3ee]";
  return (
    <div>
      <p
        className={`text-5xl font-extralight tabular-nums tracking-tighter lg:text-6xl ${colorClass}`}
      >
        {displayValue}
      </p>
      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
        {label}
      </p>
    </div>
  );
}

interface CostChartProps {
  data: CostsByDay[];
}

function CostChart({ data }: CostChartProps) {
  if (data.length === 0) return null;

  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.01);

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = Math.max(2, chartWidth / data.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-3xl"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - ratio)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - ratio)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.costUsd / maxCost) * chartHeight;
          const x = padding.left + (i * chartWidth) / data.length;
          const y = padding.top + chartHeight - barHeight;

          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              className="fill-rose-500 dark:fill-rose-400"
              rx={1}
            />
          );
        })}

        {/* X-axis labels (dates) */}
        {data.map((d, i) => {
          const showLabel =
            data.length <= 7 || i % Math.ceil(data.length / 7) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`label-${i}`}
              x={padding.left + (i * chartWidth) / data.length + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-[#a39e98] font-mono text-[10px]"
            >
              {formatDateShort(d.date)}
            </text>
          );
        })}

        {/* Y-axis labels */}
        <text
          x={padding.left - 10}
          y={padding.top + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          {formatCurrencyShort(maxCost)}
        </text>
        <text
          x={padding.left - 10}
          y={padding.top + chartHeight + 4}
          textAnchor="end"
          className="fill-[#a39e98] font-mono text-[10px]"
        >
          $0
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-rose-500 dark:bg-rose-400" />
          <span className="text-rose-600 dark:text-rose-400">Daily Cost</span>
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCurrencyShort(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

interface ServiceBreakdownTableProps {
  services: ServiceCost[];
  onEdit: (cost: ServiceCost) => void;
  onDelete: (id: string) => void;
}

function ServiceBreakdownTable({
  services,
  onEdit,
  onDelete,
}: ServiceBreakdownTableProps) {
  if (services.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-[#a39e98]">
        No cost data available
      </p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Service
          </th>
          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Category
          </th>
          <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Cost
          </th>
          <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
        {services.map((service) => (
          <tr key={`${service.serviceId}-${service.billingPeriodStart}`}>
            <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {service.serviceName}
                  {service.dashboardUrl && (
                    <a
                      href={service.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a39e98] hover:text-[#6b6560]"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {service.notes && (
                  <span className="text-xs text-[#a39e98]">
                    {service.notes}
                  </span>
                )}
              </div>
            </td>
            <td className="py-2">
              <CategoryBadge category={service.category} />
            </td>
            <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {service.costFormatted}
            </td>
            <td className="py-2 text-right">
              {service.source === "manual" ? (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(service)}
                    className="rounded p-1 text-[#a39e98] hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() =>
                      onDelete(
                        `${service.serviceId}-${service.billingPeriodStart}`
                      )
                    }
                    className="rounded p-1 text-[#a39e98] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[#a39e98]">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryBadge({ category }: { category: CostCategory }) {
  const styles: Record<CostCategory, { bg: string; text: string }> = {
    ai: {
      bg: "bg-violet-100 dark:bg-violet-900/30",
      text: "text-violet-700 dark:text-violet-400",
    },
    infrastructure: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
    },
    communications: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    analytics: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
    },
    payments: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
    },
  };

  const style = styles[category];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      {category}
    </span>
  );
}

// Add Cost Modal
interface AddCostModalProps {
  onClose: () => void;
  onSubmit: (data: CreateManualCostRequest) => void;
  dateRange: { from: string; to: string };
}

function AddCostModal({ onClose, onSubmit, dateRange }: AddCostModalProps) {
  const [formData, setFormData] = useState<CreateManualCostRequest>({
    serviceId: "",
    serviceName: "",
    category: "infrastructure",
    costUsd: 0,
    billingPeriodStart: dateRange.from,
    billingPeriodEnd: dateRange.to,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  // Pre-fill service name when selecting a known service
  const handleServiceSelect = (serviceId: string) => {
    const service = Object.values(PLATFORM_SERVICES).find(
      (s) => s.id === serviceId
    );
    if (service) {
      setFormData((prev) => ({
        ...prev,
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        serviceId,
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#2d2a26]">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            Add Manual Cost
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#a39e98] hover:bg-[#f5f3ee] dark:hover:bg-[#3d3a36]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Service
            </label>
            <select
              value={formData.serviceId}
              onChange={(e) => handleServiceSelect(e.target.value)}
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
              required
            >
              <option value="">Select a service...</option>
              {Object.values(PLATFORM_SERVICES).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
              <option value="custom">Custom Service...</option>
            </select>
          </div>

          {formData.serviceId === "custom" && (
            <>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                  Service ID
                </label>
                <input
                  type="text"
                  value={formData.serviceId === "custom" ? "" : formData.serviceId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
                  placeholder="e.g., my-service"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                  Service Name
                </label>
                <input
                  type="text"
                  value={formData.serviceName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceName: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
                  placeholder="e.g., My Service"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value as CostCategory,
                }))
              }
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
            >
              <option value="ai">AI</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="communications">Communications</option>
              <option value="analytics">Analytics</option>
              <option value="payments">Payments</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Cost (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.costUsd}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  costUsd: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                Period Start
              </label>
              <input
                type="date"
                value={formData.billingPeriodStart}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billingPeriodStart: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                Period End
              </label>
              <input
                type="date"
                value={formData.billingPeriodEnd}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billingPeriodEnd: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
              rows={2}
              placeholder="e.g., Invoice #12345"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#6b6560] hover:bg-[#f5f3ee] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#2d2a26] px-4 py-2 text-sm font-medium text-[#f5f3ee] hover:bg-[#3d3a36] disabled:opacity-50 dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              {isSubmitting ? "Adding..." : "Add Cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Cost Modal
interface EditCostModalProps {
  cost: ServiceCost;
  onClose: () => void;
  onSave: (id: string, updates: { costUsd?: number; notes?: string }) => void;
}

function EditCostModal({ cost, onClose, onSave }: EditCostModalProps) {
  const [costUsd, setCostUsd] = useState(cost.costUsd);
  const [notes, setNotes] = useState(cost.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(`${cost.serviceId}-${cost.billingPeriodStart}`, {
      costUsd,
      notes,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-[#2d2a26]">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
            Edit Cost: {cost.serviceName}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#a39e98] hover:bg-[#f5f3ee] dark:hover:bg-[#3d3a36]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Cost (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costUsd}
              onChange={(e) => setCostUsd(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[#e5e3de] bg-white px-3 py-2 text-sm dark:border-[#3d3a36] dark:bg-[#252320]"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#6b6560] hover:bg-[#f5f3ee] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#2d2a26] px-4 py-2 text-sm font-medium text-[#f5f3ee] hover:bg-[#3d3a36] disabled:opacity-50 dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Scaling Forecast Section
interface ScalingForecastSectionProps {
  services: ServiceCost[];
  dateRange: { from: string; to: string };
}

function ScalingForecastSection({ services, dateRange }: ScalingForecastSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [forecasts, setForecasts] = useState<ForecastScenario[] | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const loadUsageData = useCallback(async () => {
    setIsLoadingUsage(true);
    try {
      const result = await fetchCostsAnalytics(dateRange.from, dateRange.to, {
        includeUsage: true,
      });
      if (result.data?.usageMetrics) {
        setUsageMetrics(result.data.usageMetrics);
        setForecasts(computeForecasts(services, result.data.usageMetrics));
      }
    } catch {
      // Silently fail — forecast is optional
    } finally {
      setIsLoadingUsage(false);
    }
  }, [dateRange.from, dateRange.to, services]);

  // Auto-load usage data on mount (expanded by default)
  useEffect(() => {
    if (!usageMetrics && !isLoadingUsage) {
      loadUsageData();
    }
  }, [loadUsageData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    if (willExpand && !usageMetrics && !isLoadingUsage) {
      loadUsageData();
    }
  };

  const formatNum = (n: number) => n.toLocaleString();
  const formatUsd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <section>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-[#f5f3ee] dark:hover:bg-[#2d2a26]"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#a39e98]" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Scaling Forecast
          </h3>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#a39e98] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-8">
          {isLoadingUsage ? (
            <div className="flex items-center justify-center py-8">
              <p className="animate-pulse font-mono text-xs text-[#a39e98]">
                Loading usage data...
              </p>
            </div>
          ) : !usageMetrics ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="font-mono text-xs text-[#a39e98]">
                No usage data available yet
              </p>
              <p className="font-mono text-xs text-[#6b6560]">
                Chat events will appear after users interact with the chat
              </p>
            </div>
          ) : (
            <>
              {/* Reality Table */}
              <div>
                <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                  Current Period Reality
                  {usageMetrics.periodDays < 30 && (
                    <span className="ml-2 normal-case text-[#a39e98]">
                      (based on {usageMetrics.periodDays} days of data)
                    </span>
                  )}
                </h4>
                <table className="w-full max-w-lg">
                  <thead>
                    <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                      <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        Metric
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        This Period
                      </th>
                      <th className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                        Monthly Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                    <RealityRow
                      label="Visitors"
                      actual={usageMetrics.visitors}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Chat Conversations"
                      actual={usageMetrics.chatConversations}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Voice Sessions"
                      actual={usageMetrics.voiceConversations}
                      periodDays={usageMetrics.periodDays}
                    />
                    <RealityRow
                      label="Voice Minutes"
                      actual={usageMetrics.voiceMinutes}
                      periodDays={usageMetrics.periodDays}
                      decimals={1}
                    />
                  </tbody>
                </table>
              </div>

              {/* Forecast Table */}
              {forecasts && forecasts.length > 0 && (
                <div>
                  <h4 className="mb-3 font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                    Growth Projections
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]" />
                          {forecasts.map((f) => (
                            <th
                              key={f.label}
                              className="pb-2 text-right font-mono text-xs uppercase tracking-widest text-[#a39e98]"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                        <ForecastRow
                          label="Monthly Visitors"
                          values={forecasts.map((f) => formatNum(f.visitors))}
                        />
                        <ForecastRow
                          label="Chats"
                          values={forecasts.map((f) => formatNum(f.chats))}
                        />
                        <ForecastRow
                          label="Voice Minutes"
                          values={forecasts.map((f) => formatNum(f.voiceMinutes))}
                        />
                        <ForecastRow
                          label="Infrastructure"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.infrastructure)
                          )}
                          isCost
                        />
                        <ForecastRow
                          label="AI (Claude)"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.ai)
                          )}
                          isCost
                        />
                        <ForecastRow
                          label="Voice (ElevenLabs)"
                          values={forecasts.map((f) =>
                            formatUsd(f.breakdown.voice)
                          )}
                          isCost
                        />
                        <tr className="border-t-2 border-[#e5e3de] dark:border-[#3d3a36]">
                          <td className="py-2 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                            Est. Monthly
                          </td>
                          {forecasts.map((f) => (
                            <td
                              key={f.label}
                              className="py-2 text-right font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400"
                            >
                              {formatUsd(f.estimatedMonthlyCost)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RealityRow({
  label,
  actual,
  periodDays,
  decimals = 0,
}: {
  label: string;
  actual: number;
  periodDays: number;
  decimals?: number;
}) {
  const monthlyRate = Math.round((actual * (30 / Math.max(periodDays, 1))) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const formatted = decimals > 0 ? actual.toFixed(decimals) : actual.toLocaleString();
  const monthlyFormatted = decimals > 0 ? monthlyRate.toFixed(decimals) : monthlyRate.toLocaleString();

  return (
    <tr>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {label}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-[#2d2a26] dark:text-[#f5f3ee]">
        {formatted}
      </td>
      <td className="py-2 text-right font-mono text-sm tabular-nums text-[#6b6560] dark:text-[#a39e98]">
        {monthlyFormatted}
      </td>
    </tr>
  );
}

function ForecastRow({
  label,
  values,
  isCost = false,
}: {
  label: string;
  values: string[];
  isCost?: boolean;
}) {
  return (
    <tr>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-2 text-right font-mono text-sm tabular-nums ${
            isCost
              ? "text-rose-600 dark:text-rose-400"
              : "text-[#2d2a26] dark:text-[#f5f3ee]"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

// Tier Upgrade Alerts Section
interface TierAlertsSectionProps {
  dateRange: { from: string; to: string };
}

function TierAlertsSection({ dateRange }: TierAlertsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [alerts, setAlerts] = useState<TierAlert[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchCostsAnalytics(dateRange.from, dateRange.to, {
        includeUsage: true,
      });
      if (result.data?.usageMetrics) {
        const metrics = result.data.usageMetrics;
        setUsageMetrics(metrics);

        const usageMap: Record<string, number> = {
          voiceMinutes: metrics.voiceMinutes,
          visitors: metrics.visitors,
          posthogEvents: metrics.posthogEvents ?? 0,
        };

        setAlerts(
          computeTierAlerts(SERVICE_TIERS, usageMap, metrics.periodDays)
        );
      }
    } catch {
      // Tier alerts are optional — fail silently
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  // Auto-load usage data on mount (expanded by default)
  useEffect(() => {
    if (!usageMetrics && !isLoading) {
      loadData();
    }
  }, [loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    if (willExpand && !usageMetrics && !isLoading) {
      loadData();
    }
  };

  const nonSafeAlerts = alerts?.filter((a) => a.alertLevel !== "safe") ?? [];
  const displayAlerts = showAll ? (alerts ?? []) : nonSafeAlerts;

  return (
    <section>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 transition-colors hover:bg-[#f5f3ee] dark:hover:bg-[#2d2a26]"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#a39e98]" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Tier Upgrade Alerts
          </h3>
          {!isExpanded && nonSafeAlerts.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {nonSafeAlerts.length}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[#a39e98] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="animate-pulse font-mono text-xs text-[#a39e98]">
                Analyzing usage patterns...
              </p>
            </div>
          ) : !alerts ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="font-mono text-xs text-[#a39e98]">
                No usage data available yet
              </p>
            </div>
          ) : (
            <>
              {usageMetrics && usageMetrics.periodDays < 30 && (
                <p className="mb-3 font-mono text-xs text-[#a39e98]">
                  Based on {usageMetrics.periodDays} days of data
                </p>
              )}

              {displayAlerts.length === 0 && !showAll ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    All services within safe limits
                  </p>
                  <button
                    onClick={() => setShowAll(true)}
                    className="font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                  >
                    Show all services
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e5e3de] text-left dark:border-[#3d3a36]">
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Service
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Metric
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Usage
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Projected Limit
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Status
                          </th>
                          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f3ee] dark:divide-[#3d3a36]">
                        {displayAlerts.map((alert) => (
                          <TierAlertRow
                            key={`${alert.serviceId}-${alert.metricLabel}`}
                            alert={alert}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!showAll && alerts.length > nonSafeAlerts.length && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="mt-3 font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                    >
                      Show all ({alerts.length - nonSafeAlerts.length} safe)
                    </button>
                  )}
                  {showAll && nonSafeAlerts.length < (alerts?.length ?? 0) && (
                    <button
                      onClick={() => setShowAll(false)}
                      className="mt-3 font-mono text-xs text-[#a39e98] underline hover:text-[#6b6560]"
                    >
                      Hide safe services
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TierAlertRow({ alert }: { alert: TierAlert }) {
  const formatNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

  const platformService = Object.values(PLATFORM_SERVICES).find(
    (s) => s.id === alert.serviceId
  );

  return (
    <tr>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            {alert.serviceName}
            {platformService?.dashboardUrl && (
              <a
                href={platformService.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a39e98] hover:text-[#4d4944] dark:hover:text-[#f5f3ee]"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <span className="text-xs text-[#a39e98]">{alert.currentTierName}</span>
        </div>
      </td>
      <td className="py-2 text-sm text-[#4d4944] dark:text-[#a39e98]">
        {alert.metricLabel}
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs tabular-nums text-[#4d4944] dark:text-[#a39e98]">
            {formatNum(alert.currentUsage)} / {formatNum(alert.monthlyLimit)}{" "}
            {alert.unit}
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e5e3de] dark:bg-[#3d3a36]">
            <div
              className={`h-full rounded-full transition-all ${alertBarColor(alert.alertLevel)}`}
              style={{ width: `${Math.min(alert.usagePercent, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="py-2 font-mono text-xs tabular-nums text-[#4d4944] dark:text-[#a39e98]">
        {alert.projectedDate ? (
          <span>
            {alert.projectedDaysToLimit === 0
              ? "Exceeded"
              : `~${alert.projectedDaysToLimit}d (${formatDateShort(alert.projectedDate)})`}
          </span>
        ) : (
          <span className="text-[#a39e98]">—</span>
        )}
      </td>
      <td className="py-2">
        <AlertLevelBadge level={alert.alertLevel} />
      </td>
      <td className="py-2 text-xs text-[#4d4944] dark:text-[#a39e98]">
        {alert.recommendation ? (
          <span>
            → {alert.recommendation.tierName} ($
            {alert.recommendation.monthlyCostUsd}/mo
            {alert.recommendation.costDelta > 0 &&
              `, +$${alert.recommendation.costDelta}`}
            )
          </span>
        ) : (
          <span className="text-[#a39e98]">—</span>
        )}
      </td>
    </tr>
  );
}

function alertBarColor(level: AlertLevel): string {
  switch (level) {
    case "critical":
      return "bg-rose-500 dark:bg-rose-400";
    case "warning":
      return "bg-amber-500 dark:bg-amber-400";
    case "watch":
      return "bg-blue-500 dark:bg-blue-400";
    case "safe":
      return "bg-emerald-500 dark:bg-emerald-400";
  }
}

function AlertLevelBadge({ level }: { level: AlertLevel }) {
  const styles: Record<AlertLevel, { bg: string; text: string }> = {
    critical: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-400",
    },
    warning: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
    },
    watch: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
    },
    safe: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
    },
  };

  const style = styles[level];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      {level}
    </span>
  );
}

// Skeleton Components
function SkeletonCostsDashboard() {
  return (
    <>
      <section className="grid grid-cols-2 gap-16 lg:grid-cols-4">
        {["rose", "orange", "blue", "emerald"].map((color) => (
          <SkeletonStatCard key={color} color={color as "rose" | "orange" | "blue" | "emerald"} />
        ))}
      </section>

      <section>
        <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonChart />
      </section>

      <section>
        <div className="mb-4 h-3 w-40 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        <SkeletonTable />
      </section>
    </>
  );
}

const skeletonColorClasses: Record<string, string> = {
  rose: "bg-rose-200 dark:bg-rose-900/30",
  orange: "bg-orange-200 dark:bg-orange-900/30",
  blue: "bg-blue-200 dark:bg-blue-900/30",
  emerald: "bg-emerald-200 dark:bg-emerald-900/30",
};

function SkeletonStatCard({ color }: { color: "rose" | "orange" | "blue" | "emerald" }) {
  return (
    <div>
      <div
        className={`h-12 w-28 animate-pulse rounded lg:h-16 lg:w-36 ${skeletonColorClasses[color]}`}
      />
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-[200px] w-full max-w-3xl animate-pulse rounded bg-[#f5f3ee] dark:bg-[#2d2a26]" />
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
          <div className="h-4 w-16 animate-pulse rounded bg-rose-200 dark:bg-rose-900/30" />
          <div className="h-4 w-16 animate-pulse rounded bg-[#e5e3de] dark:bg-[#3d3a36]" />
        </div>
      ))}
    </div>
  );
}
