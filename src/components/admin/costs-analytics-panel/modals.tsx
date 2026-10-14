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
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-admin-ink">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
            Add Manual Cost
          </h3>
          <button
            onClick={onClose}
            aria-label="Close add cost modal"
            className="rounded-full p-1 text-admin-subtle hover:bg-admin-paper dark:hover:bg-admin-depth"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cost-service" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Service
            </label>
            <select
              id="cost-service"
              value={formData.serviceId}
              onChange={(e) => handleServiceSelect(e.target.value)}
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
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
                <label htmlFor="cost-service-id" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                  Service ID
                </label>
                <input
                  id="cost-service-id"
                  type="text"
                  value={formData.serviceId === "custom" ? "" : formData.serviceId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
                  placeholder="e.g., my-service"
                  required
                />
              </div>
              <div>
                <label htmlFor="cost-service-name" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                  Service Name
                </label>
                <input
                  id="cost-service-name"
                  type="text"
                  value={formData.serviceName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceName: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
                  placeholder="e.g., My Service"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="cost-category" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Category
            </label>
            <select
              id="cost-category"
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value as CostCategory,
                }))
              }
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
            >
              <option value="ai">AI</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="communications">Communications</option>
              <option value="analytics">Analytics</option>
              <option value="payments">Payments</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div>
            <label htmlFor="cost-amount" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Cost (USD)
            </label>
            <input
              id="cost-amount"
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
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cost-billing-start" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                Period Start
              </label>
              <input
                id="cost-billing-start"
                type="date"
                value={formData.billingPeriodStart}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billingPeriodStart: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
                required
              />
            </div>
            <div>
              <label htmlFor="cost-billing-end" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
                Period End
              </label>
              <input
                id="cost-billing-end"
                type="date"
                value={formData.billingPeriodEnd}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billingPeriodEnd: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="cost-notes" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Notes (optional)
            </label>
            <textarea
              id="cost-notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
              rows={2}
              placeholder="e.g., Invoice #12345"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-admin-muted hover:bg-admin-paper dark:text-admin-subtle dark:hover:bg-admin-depth"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-admin-ink px-4 py-2 text-sm font-medium text-admin-paper hover:bg-admin-depth disabled:opacity-50 dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
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
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-admin-ink">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
            Edit Cost: {cost.serviceName}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close edit cost modal"
            className="rounded-full p-1 text-admin-subtle hover:bg-admin-paper dark:hover:bg-admin-depth"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-cost-amount" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Cost (USD)
            </label>
            <input
              id="edit-cost-amount"
              type="number"
              step="0.01"
              min="0"
              value={costUsd}
              onChange={(e) => setCostUsd(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-cost-notes" className="mb-1 block font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
              Notes
            </label>
            <textarea
              id="edit-cost-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-admin-line bg-white px-3 py-2 text-sm dark:border-admin-depth dark:bg-admin-panel"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-admin-muted hover:bg-admin-paper dark:text-admin-subtle dark:hover:bg-admin-depth"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-admin-ink px-4 py-2 text-sm font-medium text-admin-paper hover:bg-admin-depth disabled:opacity-50 dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
