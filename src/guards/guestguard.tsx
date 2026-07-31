// src/guards/GuestGuard.js
import { Navigate } from "react-router-dom";
import { getAuthState } from "../apis/me";
import { useEffect, useState } from "react";
import { SpinnerIcon } from "../components/ui/icons";

const GuestGuard = ({ children }: { children: any }) => {
  const [user, setUser] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      const result = await getAuthState();
      if (cancelled) return;
      // On an unreachable backend, fall through to the guest page rather than
      // bouncing to /dashboard — pairing that with AuthGuard's own failure
      // handling is what produced a /login ↔ /dashboard redirect loop.
      setUser(result.state === "authenticated");
    };

    checkUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // while checking auth, show a loading spinner or null
  if (user === null)
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

  if (user) return <Navigate to="/dashboard" replace />; // redirect if logged in

  return children;
};

export default GuestGuard;
