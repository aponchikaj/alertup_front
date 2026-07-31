import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createTimeline } from "animejs";
import { cn } from "../../lib/cn";
import { reducedMotion } from "../../lib/animations";
import { CloseIcon } from "./icons";
import { Portal, useEscapeClose, useFocusTrap, useScrollLock } from "./overlayUtils";

export type SheetSide = "right" | "left";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Which edge the panel docks to on lg+ viewports. Default "right". */
  side?: SheetSide;
  /** aria-label for the dialog when no title is given. */
  ariaLabel?: string;
  /** aria-label for the close button. */
  closeLabel?: string;
  className?: string;
}

/**
 * Responsive drawer: below lg it rises from the bottom edge (rounded top,
 * drag-handle affordance, capped at 85dvh); on lg+ it docks to the side as a
 * full-height panel. Scrim, scroll lock, Escape and focus trap included.
 */
export const Sheet = ({
  open,
  onClose,
  title,
  children,
  side = "right",
  ariaLabel = "Panel",
  closeLabel = "Close",
  className,
}: SheetProps) => {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);

  useScrollLock(open);
  useEscapeClose(open, onClose);
  useFocusTrap(panelRef, open);

  useLayoutEffect(() => {
    if (!open || reducedMotion()) return;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || !scrim) return;

    // The travel axis depends on the active layout: bottom sheet below lg,
    // side panel above. Decided at open time — matches the visible layout.
    const desktop = window.matchMedia("(min-width: 64rem)").matches;
    const axis = desktop ? "translateX" : "translateY";
    const from = desktop && side === "left" ? "-102%" : "102%";

    const tl = createTimeline();
    tl.add(scrim, { opacity: [0, 1], duration: 220, ease: "linear" }).add(
      panel,
      { [axis]: [from, "0%"], duration: 340, ease: "outQuint" },
      "<",
    );
    return () => {
      tl.cancel();
    };
  }, [open, side]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <button
          ref={scrimRef}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default bg-scrim"
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          className={cn(
            "absolute flex flex-col bg-surface shadow-xl",
            // Bottom sheet below lg.
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-line",
            // Side panel on lg+.
            "lg:inset-x-auto lg:inset-y-0 lg:h-full lg:max-h-none lg:w-full lg:max-w-md lg:rounded-none",
            side === "right"
              ? "lg:right-0 lg:border-l lg:border-t-0"
              : "lg:left-0 lg:border-r lg:border-t-0",
            className,
          )}
        >
          {/* Drag-handle affordance — bottom sheet only. */}
          <div
            aria-hidden="true"
            className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden"
          />

          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            {title ? (
              <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-ink">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                "text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </div>
    </Portal>
  );
};

export default Sheet;
