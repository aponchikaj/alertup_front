import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { hasPermission, type Permission } from "../auth/permissions";
import { getBuilding } from "../apis/building";
import { PageShell } from "../components/ui/layout";
import { Button } from "../components/ui/button";
import { Skeleton, EmptyState } from "../components/ui/feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/icons";

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
    return Boolean(res?.Success && res.Message?.owner === userId);
  } catch {
    return false;
  }
}

type FallbackStatus = "idle" | "checking" | "owner" | "denied";

const GuardSkeleton = () => (
  <PageShell>
    <div role="status" aria-live="polite">
      <span className="sr-only">Verifying access…</span>
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

  const userId = (user?._id ?? user?.id ?? "") as string;
  const allowedByContext =
    status === "authed" && buildingId
      ? hasPermission(memberships, ownedBuildingIds, buildingId, permission)
      : false;
  const needsFallback =
    status === "authed" &&
    !revalidating &&
    Boolean(buildingId) &&
    !allowedByContext;

  const [fallback, setFallback] = useState<FallbackStatus>("idle");
  useEffect(() => {
    if (!needsFallback || !buildingId) {
      setFallback("idle");
      return;
    }
    let cancelled = false;
    setFallback("checking");
    legacyOwnershipCheck(buildingId, userId).then((isOwner) => {
      if (!cancelled) setFallback(isOwner ? "owner" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, [needsFallback, buildingId, userId]);

  if (status === "loading" || revalidating) return <GuardSkeleton />;

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

  // No :buildingId in the route — nothing to scope the check to. Matches the
  // legacy buildingOwnerGuard, which also let these routes through.
  if (!buildingId) return children;

  if (allowedByContext || fallback === "owner") return children;
  if (fallback === "denied") return <Navigate to="/dashboard" replace />;

  // Fallback still in flight.
  return <GuardSkeleton />;
};

export default PermissionGuard;
