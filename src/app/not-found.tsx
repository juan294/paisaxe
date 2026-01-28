"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <h1 className="text-6xl font-bold text-white">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        Página no encontrada
      </h2>
      <p className="mt-4 max-w-md text-white/70">
        La página que buscas no existe o ha sido movida.
      </p>
      <Link
        href="/"
        className="mt-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-6 py-3 text-white transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
