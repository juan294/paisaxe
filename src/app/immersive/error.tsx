"use client";

import { useEffect } from "react";

export default function ImmersiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black px-4 text-center">
      <h1 className="text-2xl font-bold text-white">
        No se pudo cargar la experiencia
      </h1>
      <p className="mt-4 max-w-md text-white/70">
        Algo falló al cargar las historias. Inténtalo de nuevo.
      </p>
      <button
        onClick={reset}
        className="mt-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
