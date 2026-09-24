import { Navigate, useParams } from "react-router-dom";
import { getAuthState } from "../apis/me";
import { getBuilding } from "../apis/building";
import { useEffect, useState, type ReactNode } from "react";
import { PageShell } from "../components/ui/layout";
import { Button } from "../components/ui/button";
import { Skeleton, EmptyState } from "../components/ui/feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/icons";

type Status = "loading" | "owner" | "notOwner" | "unauthenticated" | "error";

/** A settled verdict. "loading" is never stored — it is derived in render. */
type Verdict = { status: Exclude<Status, "loading">; errorText: string };

/**
 * Pure async check — no React state, so the effect below can be a bare
 * promise kick-off with nothing running synchronously in its body
 * (react-hooks/set-state-in-effect).
 */
async function checkOwnership(buildingId: string | undefined): Promise<Verdict> {
  try {
    const auth = await getAuthState();

    if (auth.state === "error") return { status: "error", errorText: auth.message };
    if (auth.state === "unauthenticated") {
      return { status: "unauthenticated", errorText: "" };
    }
    if (!buildingId) return { status: "owner", errorText: "" };

    const buildingRes = await getBuilding({ buildingID: buildingId });
    const isOwner = Boolean(
      buildingRes?.Success && buildingRes.Message?.owner === auth.user._id,
    );
    return { status: isOwner ? "owner" : "notOwner", errorText: "" };
  } catch {
    return {
      status: "error",
      errorText: "Could not verify access to this building.",
    };
  }
}

const BuildingOwnerGuard = ({ children }: { children: ReactNode }) => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; verdict: Verdict } | null>(null);

  // One key per (building, retry). Navigating straight from one building to
  // another reuses this component, so a verdict must only count for the key
  // that produced it — otherwise the next building renders under the previous
  // building's authorization.
  const key = `${buildingId ?? ""}#${attempt}`;

  // Derived in render, not stored: a result for another key is stale, which by
  // definition means this key is still loading.
  const fresh = result?.key === key ? result.verdict : null;
  const status: Status = fresh?.status ?? "loading";
  const errorText = fresh?.errorText ?? "";

  useEffect(() => {
    let cancelled = false;
    checkOwnership(buildingId).then((verdict) => {
      if (!cancelled) setResult({ key, verdict });
    });
    return () => {
      cancelled = true;
    };
  }, [key, buildingId]);

  if (status === "loading")
    return (
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

  if (status === "error") {
    return (
      <PageShell>
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title="Something went wrong"
          description={errorText || "Could not reach the server."}
          action={
            <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshIcon size={16} />
              Retry
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (status === "unauthenticated") return <Navigate to="/login" replace />;

  if (status === "notOwner") return <Navigate to="/dashboard" replace />;

  return children;
};

export default BuildingOwnerGuard;
