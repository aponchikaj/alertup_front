import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { loginWithNext } from "../lib/safeNext";
import { useAuth } from "../auth/useAuth";
import { hasPermission, type Permission } from "../auth/permissions";
import { getBuilding } from "../apis/building";
import { PageShell } from "../components/ui/Layout";
import { Button } from "../components/ui/Button";
import { Skeleton, EmptyState } from "../components/ui/Feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/Icons";
import { useI18n } from "../i18n/LanguageProvider";

/* ----------------------------------------------------------------------------
   LEGACY OWNERSHIP FALLBACK — DELETE ONCE /api/me RETURNS MEMBERSHIPS.
   The memberships map is empty today because the backend does not send it
   yet, which would deny owners access to their own buildings. Until then,
   fall back to the same ownership check buildingOwnerGuard.tsx performs:
   fetch the building and compare its `owner` with the current user id.
   ------------------------------------------------------------------------- */
async function legacyOwnershipCheck(
  buildingId: string,
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await getBuilding({ buildingID: buildingId });
    return Boolean(res?.success && res.data?.owner === userId);
  } catch {
    return false;
  }
}

type FallbackStatus = "idle" | "checking" | "owner" | "denied";

const GuardSkeleton = () => {
  const { t } = useI18n();
  return (
    <PageShell>
      <div role="status" aria-live="polite">
        <span className="sr-only">{t("guards.verifyingAccess")}</span>
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
};

export interface PermissionGuardProps {
  permission: Permission;
  children: ReactNode;
}

/**
 * Route guard for building-scoped permissions. Reads `:buildingId` from the
 * route and the shared auth context; guests go to /login, authed users
 * without the permission go to /dashboard.
 */
export const PermissionGuard = ({ permission, children }: PermissionGuardProps) => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const { status, user, memberships, ownedBuildingIds, error, refresh } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  // Re-validate once when the shared context says "guest" at mount time: the
  // user may have just signed in and navigated here before the context
  // refreshed. Mirrors the old fetch-per-mount guard behaviour.
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

  const userId = user?.id ?? "";
  const allowedByContext =
    status === "authed" && buildingId
      ? hasPermission(memberships, ownedBuildingIds, buildingId, permission)
      : false;
  const needsFallback =
    status === "authed" &&
    !revalidating &&
    Boolean(buildingId) &&
    !allowedByContext;

  // null when no fallback check is warranted; otherwise identifies the exact
  // (building, user) pair a stored verdict belongs to.
  const fallbackKey = needsFallback && buildingId ? `${buildingId}|${userId}` : null;
  const [fallbackResult, setFallbackResult] = useState<{
    key: string;
    owner: boolean;
  } | null>(null);

  // Derived in render rather than written from the effect: "idle" and
  // "checking" are facts about the current key, not state to store, so the
  // effect only has to kick off the promise
  // (react-hooks/set-state-in-effect). A verdict under a stale key reads as
  // "checking", so a building switch can never inherit the previous verdict.
  const fallback: FallbackStatus =
    fallbackKey === null
      ? "idle"
      : fallbackResult?.key === fallbackKey
        ? fallbackResult.owner
          ? "owner"
          : "denied"
        : "checking";

  useEffect(() => {
    if (!fallbackKey || !buildingId) return;
    let cancelled = false;
    legacyOwnershipCheck(buildingId, userId).then((isOwner) => {
      if (!cancelled) setFallbackResult({ key: fallbackKey, owner: isOwner });
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackKey, buildingId, userId]);

  if (status === "loading" || revalidating) return <GuardSkeleton />;

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

  // No :buildingId in the route — nothing to scope the check to. Matches the
  // legacy buildingOwnerGuard, which also let these routes through.
  if (!buildingId) return children;

  if (allowedByContext || fallback === "owner") return children;
  if (fallback === "denied") return <Navigate to="/dashboard" replace />;

  // Fallback still in flight.
  return <GuardSkeleton />;
};

export default PermissionGuard;
