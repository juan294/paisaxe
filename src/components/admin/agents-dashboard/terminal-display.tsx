"use client";

import { useRef, useState, useEffect } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentLogLine } from "@/types/agents-dashboard";
import { formatElapsed } from "./constants";

export function AgentTerminal({
  agentKey: _agentKey,
  agentName,
  logs,
  finished,
  exitCode,
  stoppedByUser,
  startedAt,
  onClose,
}: {
  agentKey: string;
  agentName: string;
  logs: AgentLogLine[];
  finished: boolean;
  exitCode: number | null;
  stoppedByUser: boolean;
  startedAt: string | null;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  // Update elapsed time every second while running.
  // PE-L1 (#537): pause the interval when the tab is hidden to avoid waking the
  // page for a timer no one can see; resume (and catch up) on visibilitychange.
  useEffect(() => {
    if (!startedAt || finished) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = () => setElapsed(formatElapsed(startedAt));

    const start = () => {
      if (interval !== null) return;
      tick(); // immediate catch-up when (re)starting
      interval = setInterval(tick, 1_000);
    };

    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    // Only run the interval if the tab is currently visible.
    if (!document.hidden) {
      start();
    } else {
      tick(); // render an initial value even when starting hidden
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startedAt, finished]);

  // Compute final elapsed when finished
  useEffect(() => {
    if (finished && startedAt) {
      setElapsed(formatElapsed(startedAt));
    }
  }, [finished, startedAt]);

  const failed = finished && exitCode !== null && exitCode !== 0;
  const statusLabel = !finished
    ? "Running..."
    : stoppedByUser
      ? "Stopped"
      : failed
        ? `Failed (exit ${exitCode})`
        : "Completed";
  const statusColor = !finished
    ? "text-admin-warning"
    : stoppedByUser
      ? "text-admin-warning"
      : failed
        ? "text-admin-health-error"
        : "text-admin-health-success";

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-admin-depth">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-admin-line">{agentName}</span>
            <span className={cn("flex items-center gap-1.5 font-mono text-xs", statusColor)}>
              {!finished && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-admin-warning" />}
              {statusLabel}
            </span>
            <span className="font-mono text-xs text-admin-muted">{elapsed}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const text = logs.map((l) => `${new Date(l.timestamp).toLocaleTimeString()}  ${l.text}`).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="rounded p-1 text-admin-muted transition-colors hover:bg-admin-depth hover:text-admin-line"
              aria-label="Copy terminal output"
            >
              {copied ? <Check className="h-4 w-4 text-admin-health-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-admin-muted transition-colors hover:bg-admin-depth hover:text-admin-line"
              aria-label="Close terminal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Log content */}
        <div
          ref={scrollRef}
          className="max-h-[400px] overflow-y-auto bg-[#111] p-4 font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="text-admin-muted">Waiting for output...</p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 select-none text-[#4a4540]">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  "whitespace-pre-wrap break-all",
                  line.text.startsWith("[stderr]") ? "text-admin-health-error" : "text-[#d4d0ca]",
                )}>
                  {line.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
