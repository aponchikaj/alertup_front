import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { animate } from "animejs";
import { cn } from "../../lib/cn";
import { reducedMotion } from "../../lib/animations";
import { CloseIcon } from "./icons";
import { Portal, useEscapeClose, useFocusTrap, useScrollLock } from "./overlayUtils";

export type ModalSize = "sm" | "md" | "lg";

const MODAL_SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  /** Clicking the backdrop closes the dialog. Default true. */
  closeOnScrim?: boolean;
  /** aria-label for the close button. */
  closeLabel?: string;
  className?: string;
}

/**
 * Centered dialog on a scrim. Scroll lock, Escape, focus trap and focus
 * return come from overlayUtils; the entrance is a quick scale+fade that
 * collapses to instant under prefers-reduced-motion.
 */
export const Modal = ({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  closeOnScrim = true,
  closeLabel = "Close",
  className,
}: ModalProps) => {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
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

    animate(scrim, { opacity: [0, 1], duration: 200, ease: "linear" });
    animate(panel, {
      scale: [0.96, 1],
      opacity: [0, 1],
      duration: 260,
      ease: "outQuint",
    });
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6">
        <button
          ref={scrimRef}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeOnScrim ? onClose : undefined}
          className={cn(
            "absolute inset-0 h-full w-full bg-scrim",
            closeOnScrim ? "cursor-default" : "cursor-auto",
          )}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "relative flex w-full flex-col overflow-hidden",
            "max-h-[85dvh] rounded-2xl border border-line bg-surface shadow-xl",
            MODAL_SIZES[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-ink">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm text-ink-muted">
                  {description}
                </p>
              )}
            </div>
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

          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </div>
    </Portal>
  );
};

export default Modal;
