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

  // Update elapsed time every second while running
  useEffect(() => {
    if (!startedAt || finished) return;

    const tick = () => setElapsed(formatElapsed(startedAt));
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
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
    ? "text-[#c9a55c]"
    : stoppedByUser
      ? "text-[#c9a55c]"
      : failed
        ? "text-[#c97a7a]"
        : "text-[#7a9e7a]";

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-[#3d3a36]">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#e5e3de]">{agentName}</span>
            <span className={cn("flex items-center gap-1.5 font-mono text-xs", statusColor)}>
              {!finished && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#c9a55c]" />}
              {statusLabel}
            </span>
            <span className="font-mono text-xs text-[#6b6560]">{elapsed}</span>
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
              className="rounded p-1 text-[#6b6560] transition-colors hover:bg-[#3d3a36] hover:text-[#e5e3de]"
              aria-label="Copy terminal output"
            >
              {copied ? <Check className="h-4 w-4 text-[#7a9e7a]" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-[#6b6560] transition-colors hover:bg-[#3d3a36] hover:text-[#e5e3de]"
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
            <p className="text-[#6b6560]">Waiting for output...</p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 select-none text-[#4a4540]">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  "whitespace-pre-wrap break-all",
                  line.text.startsWith("[stderr]") ? "text-[#c97a7a]" : "text-[#d4d0ca]",
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
