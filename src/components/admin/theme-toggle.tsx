"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl">
        <div className="h-4 w-4 animate-pulse rounded bg-admin-subtle/30" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
        "text-admin-muted hover:bg-white hover:text-admin-ink",
        "dark:text-admin-subtle dark:hover:bg-admin-panel dark:hover:text-admin-paper"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
