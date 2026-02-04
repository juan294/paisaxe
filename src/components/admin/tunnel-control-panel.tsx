"use client";

import { useState, useEffect, useCallback } from "react";
import { Cloud, CloudOff, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TunnelStatus {
  running: boolean;
  url: string | null;
}

/**
 * Control panel for the Cloudflare tunnel (development only).
 * Allows starting/stopping the tunnel from the admin panel.
 */
export function TunnelControlPanel() {
  const [status, setStatus] = useState<TunnelStatus>({ running: false, url: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tunnel");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setError(null);
      } else if (response.status === 403) {
        // Production environment - tunnel control not available
        setError("Only available in development");
      }
    } catch {
      setError("Failed to check tunnel status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const method = status.running ? "DELETE" : "POST";
      const response = await fetch("/api/admin/tunnel", { method });

      if (response.ok) {
        const data = await response.json();
        setStatus({ running: data.running, url: data.url });
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[#a39e98]">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking tunnel status...</span>
      </div>
    );
  }

  if (error === "Only available in development") {
    return null; // Don't show in production
  }

  return (
    <div className="flex items-center justify-between py-5">
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          status.running
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-[#f5f3ee] text-[#a39e98] dark:bg-[#3d3a36]"
        )}>
          {status.running ? (
            <Cloud className="h-5 w-5" />
          ) : (
            <CloudOff className="h-5 w-5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              Dev Tunnel
            </span>
            {status.running && status.url && (
              <a
                href={status.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              >
                {status.url.replace("https://", "")}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-sm text-[#6b6560] dark:text-[#a39e98]">
            {status.running
              ? "Exposes localhost:3000 for webhook testing"
              : "Start tunnel to test ElevenLabs webhooks locally"}
          </p>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className={cn(
          "font-mono text-xs uppercase tracking-widest",
          status.running
            ? "text-[#2d2a26] dark:text-[#f5f3ee]"
            : "text-[#a39e98]"
        )}>
          {status.running ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              On
            </span>
          ) : (
            "Off"
          )}
        </span>

        <button
          onClick={handleToggle}
          disabled={isUpdating}
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
      </div>
    </div>
  );
}
