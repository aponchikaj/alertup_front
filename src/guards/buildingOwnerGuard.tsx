import { Navigate, useParams } from "react-router-dom";
import { getAuthState } from "../apis/me";
import { getBuilding } from "../apis/building";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "../components/ui/layout";
import { Button } from "../components/ui/button";
import { Skeleton, EmptyState } from "../components/ui/feedback";
import { AlertTriangleIcon, RefreshIcon } from "../components/ui/icons";

type Status = "loading" | "owner" | "notOwner" | "unauthenticated" | "error";

const BuildingOwnerGuard = ({ children }: { children: any }) => {
  const [status, setStatus] = useState<Status>("loading");
  const [errorText, setErrorText] = useState("");
  const { buildingId } = useParams<{ buildingId: string }>();

  const check = useCallback(
    async (isCancelled: () => boolean) => {
      // Reset on every run. Navigating straight from one building to another
      // reuses this component, and leaving the previous verdict in place let
      // the next building's page render under the old building's authorization.
      setStatus("loading");

      try {
        const auth = await getAuthState();
        if (isCancelled()) return;

        if (auth.state === "error") {
          setErrorText(auth.message);
          setStatus("error");
          return;
        }
        if (auth.state === "unauthenticated") {
          setStatus("unauthenticated");
          return;
        }

        if (!buildingId) {
          setStatus("owner");
          return;
        }

        const buildingRes = await getBuilding({ buildingID: buildingId });
        if (isCancelled()) return;

        if (buildingRes?.Success && buildingRes.Message?.owner === auth.user._id) {
          setStatus("owner");
        } else {
          setStatus("notOwner");
        }
      } catch (error) {
        if (isCancelled()) return;
        console.error("Ownership check failed:", error);
        setStatus("error");
        setErrorText("Could not verify access to this building.");
      }
    },
    [buildingId],
  );

  useEffect(() => {
    // Guards against an earlier, slower check overwriting a newer verdict when
    // buildingId changes mid-flight.
    let cancelled = false;
    check(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [check]);

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
            <Button type="button" onClick={() => check(() => false)}>
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
