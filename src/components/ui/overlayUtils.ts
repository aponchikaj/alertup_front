import { useEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/* ============================================================================
   Shared overlay plumbing — scroll lock, Escape, focus trap, portal.
   Extracted from the navbar drawer so Modal / Sheet / Toast agree on the
   details (restoring the previous overflow value, returning focus to the
   trigger, listening in the capture phase so nested handlers can't swallow
   the trap).
   ========================================================================= */

/** Locks body scroll while `active`, restoring the previous value after. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

/** Calls `onClose` when Escape is pressed while `active`. */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onClose]);
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Traps Tab focus within `ref` while `active`:
 *  - focuses the first focusable element (or the container) on activation,
 *  - cycles Tab / Shift+Tab within the container,
 *  - returns focus to the previously focused element (the trigger) on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const trigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (!focusables.length) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && container.contains(current);

      if (e.shiftKey) {
        if (!inside || current === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (!inside || current === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    // Capture phase, so a stopPropagation inside the overlay can't break the trap.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      trigger?.focus();
    };
  }, [ref, active]);
}

/** Renders children into document.body — overlays escape any stacking context. */
export const Portal = ({ children }: { children: ReactNode }) =>
  createPortal(children, document.body);
