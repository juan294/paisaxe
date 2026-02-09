import type {
  CostCategory,
  ServiceCost,
  CostsByDay,
  CreateManualCostRequest,
} from "@/types/costs-analytics";
import type { AlertLevel } from "@/config/service-tiers";
import type { TierAlert } from "@/lib/costs/tier-alerts";

export type { CostCategory, ServiceCost, CostsByDay, CreateManualCostRequest };
export type { AlertLevel, TierAlert };

export interface StatCardProps {
  value: number | string;
  label: string;
  color?: "blue" | "emerald" | "rose" | "orange";
}

export interface CostChartProps {
  data: CostsByDay[];
}

export interface ServiceBreakdownTableProps {
  services: ServiceCost[];
  onEdit: (cost: ServiceCost) => void;
  onDelete: (id: string) => void;
}

export interface AddCostModalProps {
  onClose: () => void;
  onSubmit: (data: CreateManualCostRequest) => void;
  dateRange: { from: string; to: string };
}

export interface EditCostModalProps {
  cost: ServiceCost;
  onClose: () => void;
  onSave: (id: string, updates: { costUsd?: number; notes?: string }) => void;
}

export interface ScalingForecastSectionProps {
  services: ServiceCost[];
  dateRange: { from: string; to: string };
}

export interface TierAlertsSectionProps {
  dateRange: { from: string; to: string };
}
