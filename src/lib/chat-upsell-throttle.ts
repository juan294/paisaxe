/**
 * Throttling logic for chat upsell prompts.
 *
 * Prevents spamming users with upsell CTAs by:
 * - Limiting to max 2 upsells per session
 * - Enforcing a 5-message cooldown after dismissal
 *
 * State is stored in sessionStorage (resets each visit).
 */

const STORAGE_KEY = "paisaxe-upsell-throttle";
const MAX_UPSELLS_PER_SESSION = 2;
const COOLDOWN_MESSAGES = 5;

interface ThrottleState {
  /** Number of upsells shown this session */
  shownCount: number;
  /** Message index when last dismissed (null if never dismissed) */
  lastDismissedAt: number | null;
}

/**
 * Gets the current throttle state from sessionStorage.
 */
function getState(): ThrottleState {
  if (typeof window === "undefined") {
    return { shownCount: 0, lastDismissedAt: null };
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ThrottleState;
    }
  } catch {
    // Ignore parse errors
  }

  return { shownCount: 0, lastDismissedAt: null };
}

/**
 * Saves throttle state to sessionStorage.
 */
function saveState(state: ThrottleState): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (private browsing, quota)
  }
}

/**
 * Checks if an upsell can be shown at the current message index.
 *
 * @param currentMessageIndex - The index of the current message in the conversation
 * @returns true if an upsell CTA can be displayed
 *
 * @example
 * ```ts
 * if (canShowUpsell(messages.length - 1)) {
 *   // Show the upsell CTA
 * }
 * ```
 */
export function canShowUpsell(currentMessageIndex: number): boolean {
  const state = getState();

  // Check max upsells per session
  if (state.shownCount >= MAX_UPSELLS_PER_SESSION) {
    return false;
  }

  // Check cooldown after dismissal
  if (state.lastDismissedAt !== null) {
    const messagesSinceDismissal = currentMessageIndex - state.lastDismissedAt;
    if (messagesSinceDismissal < COOLDOWN_MESSAGES) {
      return false;
    }
  }

  return true;
}

/**
 * Records that an upsell CTA was shown.
 * Call this when displaying an upsell to the user.
 */
export function recordUpsellShown(): void {
  const state = getState();
  state.shownCount += 1;
  saveState(state);
}

/**
 * Records that the user dismissed an upsell CTA.
 * This triggers the cooldown period.
 *
 * @param messageIndex - The message index where dismissal occurred
 */
export function recordUpsellDismissed(messageIndex: number): void {
  const state = getState();
  state.lastDismissedAt = messageIndex;
  saveState(state);
}

/**
 * Resets the throttle state. Useful for testing or admin overrides.
 */
export function resetUpsellThrottle(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
