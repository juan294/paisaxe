import { useState, useEffect } from "react";

// Storage key for persisting dev toggle preference
const DEV_TOGGLE_KEY = "admin:visitors:includeLocalhost";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function getStoredDevToggle(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(DEV_TOGGLE_KEY);
  // If no stored preference, default to ON for localhost, OFF for production
  if (stored === null) {
    return isLocalhost();
  }
  return stored === "true";
}

/**
 * Manages the "include localhost traffic" toggle for the visitors panel,
 * persisting the preference to localStorage (client-side only).
 */
export function useDevToggle() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [includeLocalhost, setIncludeLocalhost] = useState(false);

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    const storedValue = getStoredDevToggle();
    setIncludeLocalhost(storedValue);
    setIsInitialized(true);
  }, []);

  // Persist dev toggle preference to localStorage (skip initial mount)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(DEV_TOGGLE_KEY, String(includeLocalhost));
    }
  }, [includeLocalhost, isInitialized]);

  return { includeLocalhost, setIncludeLocalhost, isInitialized };
}
