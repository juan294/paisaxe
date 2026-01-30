import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Paisaxe | Próximamente",
  description: "Paisaxe llegará pronto. Look. Ask. Explore.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComingSoonPage() {
  return (
    <main className="relative min-h-screen bg-[#030303] overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-emerald-900/30 animate-gradient-shift" />
        <div className="absolute inset-0 bg-gradient-to-tl from-purple-900/20 via-transparent to-blue-800/20 animate-gradient-shift-reverse" />
      </div>

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {/* Logo */}
        <div className="w-24 h-24 md:w-32 md:h-32 mb-8 text-white/90 opacity-0 animate-fade-in-up">
          <Logo primaryColor="currentColor" />
        </div>

        {/* Brand name */}
        <h1 className="text-4xl md:text-6xl font-light tracking-[0.2em] text-white/95 mb-4 opacity-0 animate-fade-in-up-delay-1">
          PAISAXE
        </h1>

        {/* Tagline */}
        <p className="text-lg md:text-xl text-white/60 tracking-widest uppercase mb-16 opacity-0 animate-fade-in-up-delay-2">
          Look. Ask. Explore.
        </p>

        {/* Coming Soon */}
        <div className="opacity-0 animate-fade-in-up-delay-3">
          <div className="relative">
            {/* Glassmorphism card */}
            <div className="px-10 py-5 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 shadow-2xl">
              <span className="text-sm md:text-base tracking-[0.3em] uppercase text-white/80">
                Próximamente
              </span>
            </div>
            {/* Subtle glow effect */}
            <div className="absolute inset-0 -z-10 blur-2xl opacity-30 bg-gradient-to-r from-blue-500/20 via-white/10 to-emerald-500/20 rounded-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
