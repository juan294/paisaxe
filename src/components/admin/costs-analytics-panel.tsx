"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
} from "@/lib/admin-api";
import {
  AlertCircle,
  Receipt,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type {
  CostsAnalyticsDashboardData,
  ServiceCost,
  CostsByDay,
  CostCategory,
  CreateManualCostRequest,
} from "@/types/costs-analytics";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";

export function CostsAnalyticsPanel() {
  const [data, setData] = useState<CostsAnalyticsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchCostsAnalytics(dateRange.from, dateRange.to);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setData(result.data);
    }
    setIsLoading(false);
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCost = async (formData: CreateManualCostRequest) => {
    const result = await createManualCostEntry(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setShowAddModal(false);
      loadData();
    }
  };

  const handleDeleteCost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cost entry?")) {
      return;
    }
    const result = await deleteManualCostEntry(id);
    if (result.error) {
      setError(result.error);
    } else {
      loadData();
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
            onClick={loadData}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-[#6b6560] transition-colors hover:text-[#2d2a26] disabled:opacity-50 dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading && !data ? (
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

          {/* External Dashboard Links */}
          <div className="flex justify-center pt-8">
            <div className="flex flex-wrap gap-3">
              {Object.values(PLATFORM_SERVICES)
                .slice(0, 4)
                .map((service) => (
                  <a
                    key={service.id}
                    href={service.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-[#e5e3de] bg-white px-4 py-2 text-xs font-medium text-[#6b6560] transition-colors hover:border-[#2d2a26] hover:text-[#2d2a26] dark:border-[#3d3a36] dark:bg-[#252320] dark:text-[#a39e98] dark:hover:border-[#f5f3ee] dark:hover:text-[#f5f3ee]"
                  >
                    {service.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
            </div>
          </div>
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
              setError(result.error);
            } else {
              setEditingCost(null);
              loadData();
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
          <th className="pb-2 font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Source
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
            </td>
            <td className="py-2">
              <CategoryBadge category={service.category} />
            </td>
            <td className="py-2 text-right font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {service.costFormatted}
            </td>
            <td className="py-2">
              <SourceBadge source={service.source} />
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

function SourceBadge({ source }: { source: ServiceCost["source"] }) {
  const styles: Record<
    ServiceCost["source"],
    { bg: string; text: string; label: string }
  > = {
    api: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "API",
    },
    estimate: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      label: "Est.",
    },
    manual: {
      bg: "bg-slate-100 dark:bg-slate-900/30",
      text: "text-slate-700 dark:text-slate-400",
      label: "Manual",
    },
  };

  const style = styles[source];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
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
