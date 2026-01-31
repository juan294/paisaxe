import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { supabase } from "@/lib/supabase";
import { getEnvironment } from "@/lib/environment";
import type { MaintenanceConfig } from "@/types/feature-flags";

export const metadata: Metadata = {
  title: "Paisaxe | Próximamente",
  description: "Paisaxe llegará pronto. Look. Ask. Discover.",
  robots: {
    index: false,
    follow: false,
  },
};

// Default config if none is set
const DEFAULT_CONFIG: MaintenanceConfig = {
  title: "Próximamente",
  message: "",
  show_tagline: true,
};

async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  try {
    const environment = getEnvironment();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("config")
      .eq("flag_key", "maintenance_mode")
      .eq("environment", environment)
      .single();

    if (error || !data?.config) {
      return DEFAULT_CONFIG;
    }

    const config = data.config as Partial<MaintenanceConfig>;
    return {
      title: config.title ?? DEFAULT_CONFIG.title,
      message: config.message ?? DEFAULT_CONFIG.message,
      show_tagline: config.show_tagline ?? DEFAULT_CONFIG.show_tagline,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default async function ComingSoonPage() {
  const config = await getMaintenanceConfig();

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
        {config.show_tagline && (
          <p className="text-lg md:text-xl text-white/60 tracking-widest uppercase mb-16 opacity-0 animate-fade-in-up-delay-2">
            Look. Ask. Discover.
          </p>
        )}

        {/* Coming Soon / Maintenance Message */}
        <div className={`opacity-0 ${config.show_tagline ? 'animate-fade-in-up-delay-3' : 'animate-fade-in-up-delay-2 mt-12'}`}>
          <div className="relative">
            {/* Glassmorphism card */}
            <div className="px-10 py-5 rounded-full bg-white/[0.03] backdrop-blur-sm border border-white/10 shadow-2xl">
              <span className="text-sm md:text-base tracking-[0.3em] uppercase text-white/80">
                {config.title}
              </span>
            </div>
            {/* Subtle glow effect */}
            <div className="absolute inset-0 -z-10 blur-2xl opacity-30 bg-gradient-to-r from-blue-500/20 via-white/10 to-emerald-500/20 rounded-full" />
          </div>

          {/* Additional message */}
          {config.message && (
            <p className="mt-6 text-center text-sm text-white/50 max-w-md">
              {config.message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
