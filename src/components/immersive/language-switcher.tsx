"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const languages: { code: Locale; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "pt", label: "PT" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0];

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isExpanded]);

  const handleLanguageSelect = (langCode: Locale) => {
    setLocale(langCode);
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t("accessibility.language_switcher")}
      className="relative"
    >
      {/* Toggle Button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        whileTap={{ scale: 0.95 }}
        aria-expanded={isExpanded}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "text-xs font-medium text-white",
          "bg-white/10 backdrop-blur-sm border border-white/10",
          "transition-colors duration-200",
          "hover:bg-white/15",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        )}
      >
        <span>{currentLanguage.label}</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.65, 0, 0.35, 1] }}
        >
          <ChevronDown className="h-3 w-3 text-white/70" />
        </motion.div>
      </motion.button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.65, 0, 0.35, 1] }}
            className={cn(
              "absolute top-full right-0 mt-2 p-1.5 rounded-xl",
              "bg-white/10 backdrop-blur-xl border border-white/20"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              {languages.map((lang, index) => (
                <motion.button
                  key={lang.code}
                  initial={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.05 + index * 0.03, duration: 0.2, ease: [0.65, 0, 0.35, 1] }}
                  whileHover={{ backgroundColor: locale === lang.code ? undefined : "rgba(255, 255, 255, 0.15)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLanguageSelect(lang.code);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left",
                    locale === lang.code
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/80 hover:text-white"
                  )}
                >
                  {lang.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
