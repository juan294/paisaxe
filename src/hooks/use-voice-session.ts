"use client";

import { useState, useCallback, useMemo } from "react";

const STORAGE_KEY = "paisaxe_voice_session";

type TimeOfDay = "morning" | "afternoon" | "evening";

interface VoiceSessionState {
  conversationCount: number;
}

interface UseVoiceSessionResult {
  /** Number of conversations in this session */
  conversationCount: number;
  /** Whether user has talked before in this session */
  isReturning: boolean;
  /** Browser/device language from navigator */
  userLocale: string;
  /** Browser-language hint for analytics; app-selected locale governs the agent */
  preferredLanguage: "Spanish" | "English" | "French" | "Portuguese";
  /** Time of day for greeting customization */
  timeOfDay: TimeOfDay;
  /** Increment conversation count after a conversation completes */
  incrementConversation: () => void;
  /** Reset session state (clears conversation history) */
  resetSession: () => void;
}

/**
 * Get time of day based on current hour
 * - Morning: 6am - 11:59am
 * - Afternoon: 12pm - 5:59pm
 * - Evening: 6pm - 5:59am (includes late night)
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return "morning";
  } else if (hour >= 12 && hour < 18) {
    return "afternoon";
  } else {
    return "evening";
  }
}

export type ElevenLabsLanguage = "es" | "en" | "fr" | "pt-br";

/**
 * Maps Paisaxe locales to language presets that have verified native voices.
 * Unsupported locales use English rather than silently selecting another
 * locale-specific preset.
 */
export function getElevenLabsLanguage(locale: string): ElevenLabsLanguage {
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("pt")) return "pt-br";
  return "en";
}

export function getPreferredLanguage(
  locale: string
): UseVoiceSessionResult["preferredLanguage"] {
  const language = getElevenLabsLanguage(locale);
  if (language === "es") return "Spanish";
  if (language === "fr") return "French";
  if (language === "pt-br") return "Portuguese";
  return "English";
}

/**
 * Get stored session state from localStorage
 */
function getStoredState(): VoiceSessionState {
  if (typeof window === "undefined") {
    return { conversationCount: 0 };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as VoiceSessionState;
      return {
        conversationCount: parsed.conversationCount ?? 0,
      };
    }
  } catch {
    // Invalid JSON or storage error - reset state
  }

  return { conversationCount: 0 };
}

/**
 * Save session state to localStorage
 */
function saveState(state: VoiceSessionState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable - ignore
  }
}

/**
 * Hook for managing voice conversation session state.
 * Tracks conversation count, language preferences, and time context.
 */
export function useVoiceSession(): UseVoiceSessionResult {
  const [state, setState] = useState<VoiceSessionState>(getStoredState);

  const incrementConversation = useCallback(() => {
    setState((prev) => {
      const newState = {
        ...prev,
        conversationCount: prev.conversationCount + 1,
      };
      saveState(newState);
      return newState;
    });
  }, []);

  const resetSession = useCallback(() => {
    const newState: VoiceSessionState = { conversationCount: 0 };
    saveState(newState);
    setState(newState);
  }, []);

  return useMemo(() => {
    // Get browser locale (SSR-safe)
    const userLocale =
      typeof navigator !== "undefined" ? navigator.language : "en-US";

    // Determine preferred language based on locale
    const preferredLanguage = getPreferredLanguage(userLocale);

    return {
      conversationCount: state.conversationCount,
      isReturning: state.conversationCount > 0,
      userLocale,
      preferredLanguage,
      timeOfDay: getTimeOfDay(),
      incrementConversation,
      resetSession,
    };
  }, [state.conversationCount, incrementConversation, resetSession]);
}
