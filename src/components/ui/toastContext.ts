import { createContext, useContext } from "react";

/* ============================================================================
   Toast context, its types and the useToast hook.

   Separate from toast.tsx so that file exports only components
   (react-refresh/only-export-components).
   ========================================================================= */

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay. Default 5000ms; hovering pauses the countdown. */
  durationMs?: number;
}

export interface ToastContextValue {
  /** Enqueues a toast and returns its id (usable with `dismiss`). */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};
