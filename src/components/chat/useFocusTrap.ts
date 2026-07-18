import { useEffect } from "react";

/**
 * Traps Tab/Shift+Tab within `container` while `active` is true, and calls
 * `onEscape` when the Escape key is pressed. Isolated so it can be unit
 * tested without rendering the whole chat window.
 */
export function useFocusTrap({
  active,
  container,
  onEscape,
}: {
  active: boolean;
  container: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const el = container.current;
      if (!el) return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, container, onEscape]);
}