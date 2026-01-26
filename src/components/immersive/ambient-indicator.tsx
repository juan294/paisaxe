"use client";

export function AmbientIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white/60" />
      </span>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">Ambient</span>
    </div>
  );
}
