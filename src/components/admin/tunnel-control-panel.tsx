"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

interface TunnelStatus {
  running: boolean;
  url: string | null;
}

interface TunnelTableRowProps {
  rowNumber: number;
  onRunningChange?: (running: boolean) => void;
}

/**
 * Tunnel control rendered as a table row for the System category.
 * Development-only - discloses unavailable capability in production.
 *
 * Renders the full UI immediately with default OFF state,
 * then updates in background when status is fetched.
 */
export function TunnelTableRow({ rowNumber, onRunningChange }: TunnelTableRowProps) {
  const [status, setStatus] = useState<TunnelStatus>({ running: false, url: null });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProduction, setIsProduction] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tunnel");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
        onRunningChange?.(data.running);
      } else if (response.status === 403 || response.status === 404) {
        // Production environment - tunnel control not available
        setIsProduction(true);
      }
    } catch {
      setError("Failed to check tunnel status");
    }
  }, [onRunningChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (isProduction) return;
    setIsUpdating(true);
    setError(null);

    try {
      const method = status.running ? "DELETE" : "POST";
      const response = await fetch("/api/admin/tunnel", { method, headers: csrfHeaders() });

      if (response.ok) {
        const data = await response.json();
        setStatus({ running: data.running, url: data.url });
        onRunningChange?.(data.running);
      } else if (response.status === 403 || response.status === 404) {
        setIsProduction(true);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to toggle tunnel");
      }
    } catch {
      setError("Failed to toggle tunnel");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <tr className={cn("group", status.running && "bg-[#f5f3ee]/50 dark:bg-[#252320]/50")}>
      <td className="py-5 text-center align-top font-mono text-sm tabular-nums text-[#a39e98]">
        {String(rowNumber).padStart(2, "0")}
      </td>
      <td className="py-5 align-top">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
          Dev Tunnel
          {status.running && status.url && (
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </td>
      <td className="py-5 pr-4 align-top text-sm text-[#6b6560] dark:text-[#a39e98]">
        {isProduction ? "Solo disponible en desarrollo local. Inicia la aplicación con npm run dev." : status.running && status.url ? (
          <span>
            Exposes localhost:3000 at{" "}
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2d2a26] hover:underline dark:text-[#f5f3ee]"
            >
              {status.url.replace("https://", "")}
            </a>
          </span>
        ) : (
          "Start tunnel to test ElevenLabs webhooks locally"
        )}
        {error && <span className="ml-2 text-xs text-red-500">({error})</span>}
      </td>
      <td className="py-5 align-top">
        <span className="text-xs text-[#a39e98]">—</span>
      </td>
      <td className="py-5 text-center align-top">
        {status.running ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[#2d2a26] dark:text-[#f5f3ee]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            On
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-widest text-[#a39e98]">
            Off
          </span>
        )}
      </td>
      <td className="py-5 text-center align-top">
        <button
          onClick={handleToggle}
          disabled={isUpdating || isProduction}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            status.running
              ? "bg-[#2d2a26] dark:bg-[#f5f3ee]"
              : "bg-[#e5e3de] dark:bg-[#3d3a36]",
            isUpdating && "cursor-wait opacity-50"
          )}
          role="switch"
          aria-checked={status.running}
          aria-label="Toggle dev tunnel"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full transition-all",
              status.running
                ? "left-[22px] bg-white dark:bg-[#2d2a26]"
                : "left-0.5 bg-white dark:bg-[#6b6560]"
            )}
          />
        </button>
      </td>
    </tr>
  );
}
