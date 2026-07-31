// src/guards/GuestGuard.js
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { SpinnerIcon } from "../components/ui/icons";

const GuestGuard = ({ children }: { children: any }) => {
  const { status, refresh } = useAuth();

  // Re-validate once when the shared context says "authed" at mount time: the
  // user may have just signed out and navigated here before the context
  // caught up. Mirrors the old fetch-per-mount behaviour.
  const [revalidating, setRevalidating] = useState(() => status === "authed");
  useEffect(() => {
    if (!revalidating) return;
    let cancelled = false;
    refresh().finally(() => {
      if (!cancelled) setRevalidating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [revalidating, refresh]);

  // while checking auth, show a loading spinner or null
  if (status === "loading" || revalidating)
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid min-h-[70vh] place-items-center bg-canvas pt-28 sm:pt-32"
      >
        <SpinnerIcon size={36} className="text-brand-text" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );

  if (status === "authed") return <Navigate to="/dashboard" replace />; // redirect if logged in

  // On an unreachable backend ("error"), fall through to the guest page rather
  // than bouncing to /dashboard — pairing that with AuthGuard's own failure
  // handling is what produced a /login ↔ /dashboard redirect loop.
  return children;
};

export default GuestGuard;
