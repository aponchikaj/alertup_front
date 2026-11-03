// src/guards/AuthGuard.js
import { Navigate, useLocation } from "react-router-dom";
import { loginWithNext } from "../lib/safeNext";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { PageShell } from "../components/ui/Layout";
import { Button } from "../components/ui/Button";
import { Skeleton, EmptyState } from "../components/ui/Feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/Icons";
import { useI18n } from "../i18n/LanguageProvider";

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { status, error, refresh } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

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
          <span className="sr-only">{t("guards.checkingSession")}</span>
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
          title={t("guards.errorTitle")}
          description={error || t("guards.unreachable")}
          action={
            <Button type="button" onClick={() => refresh()}>
              <RefreshIcon size={16} />
              {t("common.retry")}
            </Button>
          }
        />
      </PageShell>
    );
  }

  // Back to where they were going once signed in (FX-024; safeNextPath()
  // validates it on the way back).
  if (status === "guest") return <Navigate to={loginWithNext(location)} replace />;

  return children;
};

export default AuthGuard;
