"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PLATFORM_SERVICES } from "@/types/costs-analytics";
import type {
  AddCostModalProps,
  EditCostModalProps,
  CreateManualCostRequest,
  CostCategory,
} from "./types";

export function AddCostModal({ onClose, onSubmit, dateRange }: AddCostModalProps) {
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

export function EditCostModal({ cost, onClose, onSave }: EditCostModalProps) {
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
