"use client";

export function RateLimitNotice({ retryAfter, onRetry }: { retryAfter?: number | null; onRetry: () => void }) {
  if (retryAfter == null) return null;
  return (
    <div role="alert" className="relative z-50 rounded-lg bg-neutral-950 p-3 text-sm text-white">
      <p>Límite temporal. Espera {retryAfter} segundos y vuelve a intentarlo.</p>
      <button type="button" onClick={onRetry} className="mt-2 rounded px-3 py-2 underline focus-visible:outline focus-visible:outline-2">Volver a intentar</button>
    </div>
  );
}
