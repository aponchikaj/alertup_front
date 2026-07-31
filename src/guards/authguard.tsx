// src/guards/AuthGuard.js
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { PageShell } from "../components/ui/layout";
import { Button } from "../components/ui/button";
import { Skeleton, EmptyState } from "../components/ui/feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/icons";

const AuthGuard = ({ children }: { children: any }) => {
  const { status, error, refresh } = useAuth();

  // Re-validate once when the shared context says "guest" at mount time: the
  // user may have just signed in and navigated here before the context caught
  // up. Preserves the old fetch-per-mount behaviour without refetching on
  // every render.
  const [revalidating, setRevalidating] = useState(() => status === "guest");
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

  if (status === "loading" || revalidating)
    return (
      <PageShell>
        <div role="status" aria-live="polite">
          <span className="sr-only">Checking your session…</span>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-56 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </PageShell>
    );

  // A backend that is unreachable or faulting says nothing about whether the
  // session is valid, so offer a retry instead of signing the user out.
  if (status === "error") {
    return (
      <PageShell>
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title="Something went wrong"
          description={error || "Could not reach the server."}
          action={
            <Button type="button" onClick={() => refresh()}>
              <RefreshIcon size={16} />
              Retry
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (status === "guest") return <Navigate to="/login" replace />;

  return children;
};

export default AuthGuard;
