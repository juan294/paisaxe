import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within the referenced element while active.
 * When the user presses Tab at the last focusable element, focus wraps to the first.
 * When the user presses Shift+Tab at the first, focus wraps to the last.
 * Also handles Escape key to call onEscape if provided.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
) {
  // Hold the latest onEscape in a ref (the "latest ref" pattern) so the
  // install/teardown effect below never depends on the callback's identity.
  // Callers often pass an inline function that is redeclared on every render
  // (see FE-H3) — depending on it directly would tear down and reinstall the
  // trap on every parent re-render, which moves focus out of the dialog via
  // the cleanup's focus-restore even though the dialog never actually
  // closed. Assigning during render (rather than in a useEffect) is safe
  // here — it's an idempotent property write with no side effects that
  // require cleanup — and skips an extra effect flush on every render.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    // Store the element that had focus before the trap activated
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element only if focus is not already inside
    const focusFirstIfNeeded = () => {
      if (!container.contains(document.activeElement)) {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    };

    // Delay initial focus slightly to allow render
    const raf = requestAnimationFrame(focusFirstIfNeeded);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // UX-H2: the listener is bound to `document` (not the container) so it
      // still fires when focus has escaped the trap entirely — e.g. a click
      // landed on a background element that stayed focusable. Recapture focus
      // into the trap instead of letting Tab continue through the rest of
      // the document.
      if (!container.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // UX-H2: scoped to `document`, not `container` — a container-scoped
    // listener only receives events that bubble through the container, so
    // once focus escapes to an element outside it, Tab presses never reach
    // this handler and focus is never recaptured.
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus when trap is deactivated
      previouslyFocused?.focus();
    };
    // Deliberately omit onEscape from deps — see the onEscapeRef comment
    // above (FE-H3).
  }, [ref, active]);
}
