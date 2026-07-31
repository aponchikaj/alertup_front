import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { animate } from "animejs";
import { cn } from "../../lib/cn";
import { reducedMotion } from "../../lib/animations";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
  XCircleIcon,
} from "./icons";
import { Portal } from "./overlayUtils";

export type ToastTone = "info" | "success" | "warning" | "danger";

/* Same tone → colour/icon mapping as Alert in feedback.tsx, so a toast and an
   inline alert about the same event look related. */
const TOAST_TONES: Record<ToastTone, { wrap: string; icon: typeof InfoIcon }> = {
  info: { wrap: "bg-info-subtle border-info-border text-info-text", icon: InfoIcon },
  success: {
    wrap: "bg-success-subtle border-success-border text-success-text",
    icon: CheckCircleIcon,
  },
  warning: {
    wrap: "bg-warning-subtle border-warning-border text-warning-text",
    icon: AlertTriangleIcon,
  },
  danger: {
    wrap: "bg-danger-subtle border-danger-border text-danger-text",
    icon: XCircleIcon,
  },
};

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay. Default 5000ms; hovering pauses the countdown. */
  durationMs?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  /** Enqueues a toast and returns its id (usable with `dismiss`). */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};

const DEFAULT_DURATION_MS = 5000;

interface ToastCardProps {
  entry: ToastEntry;
  onDismiss: (id: number) => void;
  closeLabel: string;
}

const ToastCard = ({ entry, onDismiss, closeLabel }: ToastCardProps) => {
  const { wrap, icon: ToneIcon } = TOAST_TONES[entry.tone ?? "info"];
  const cardRef = useRef<HTMLDivElement>(null);

  /* Pause-on-hover countdown: the remaining time survives multiple
     hover/unhover cycles instead of restarting from the full duration. */
  const remainingRef = useRef(entry.durationMs ?? DEFAULT_DURATION_MS);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(
      () => onDismiss(entry.id),
      remainingRef.current,
    );
  }, [clear, entry.id, onDismiss]);

  const pause = useCallback(() => {
    if (timerRef.current === null) return;
    clear();
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (Date.now() - startedAtRef.current),
    );
  }, [clear]);

  useLayoutEffect(() => {
    start();
    const card = cardRef.current;
    if (card && !reducedMotion()) {
      animate(card, {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 320,
        ease: "outQuint",
      });
    }
    return clear;
  }, [start, clear]);

  return (
    <div
      ref={cardRef}
      role={entry.tone === "danger" ? "alert" : "status"}
      aria-live={entry.tone === "danger" ? "assertive" : "polite"}
      onMouseEnter={pause}
      onMouseLeave={start}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3",
        "rounded-xl border px-4 py-3 text-sm shadow-lg",
        wrap,
      )}
    >
      <ToneIcon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{entry.title}</p>
        {entry.description && <p className="mt-0.5">{entry.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        aria-label={closeLabel}
        className={cn(
          "-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-full",
          "opacity-70 transition-opacity hover:opacity-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
};

export interface ToastProviderProps {
  children: ReactNode;
  /** aria-label for each toast's close button. */
  closeLabel?: string;
}

export const ToastProvider = ({
  children,
  closeLabel = "Dismiss",
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextIdRef.current++;
    setToasts((current) => [...current, { ...options, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <Portal>
          {/* Bottom-center on mobile, bottom-right from sm up. Sits above
              modals/sheets (z-50) so feedback about them stays visible. */}
          <div
            className={cn(
              "pointer-events-none fixed inset-x-0 bottom-0 z-[60]",
              "flex flex-col items-center gap-2 p-4",
              "sm:inset-x-auto sm:right-4 sm:items-end",
            )}
          >
            {toasts.map((entry) => (
              <ToastCard
                key={entry.id}
                entry={entry}
                onDismiss={dismiss}
                closeLabel={closeLabel}
              />
            ))}
          </div>
        </Portal>
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
