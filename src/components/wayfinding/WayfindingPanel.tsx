import { useCallback, useMemo, useState } from "react";
import { MapCanvas } from "../map/MapCanvas";
import { useMapCamera } from "../map/useMapCamera";
import { FloorImageLayer } from "../map/layers/FloorImageLayer";
import { RouteLayer } from "../map/layers/RouteLayer";
import { NodeLayer } from "../map/layers/NodeLayer";
import { UserDotLayer } from "../map/layers/UserDotLayer";
import { DestinationSearch, type DestinationSelection } from "./DestinationSearch";
import { FloorSwitcher } from "./FloorSwitcher";
import { RouteStepper } from "./RouteStepper";
import { useRouteProgress } from "./useRouteProgress";
import { fetchRoute, fetchEvacuationRoute } from "../../apis/wayfindingApi";
import { errorMessage } from "../../apis/http";
import { Alert } from "../ui/feedback";
import { Button } from "../ui/button";
import { SpinnerIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import type { AssembledRoute, FloorSummary, MapNode } from "../map/types";

/* ============================================================================
   WayfindingPanel — everyday navigation on top of the scan page.
   ----------------------------------------------------------------------------
   Self-contained on purpose: the emergency rendering on the scan page is
   safety-critical and stays exactly as it was. This panel takes over the view
   only once the user has actively chosen a destination, and hands control back
   when they clear it.

   The stored destination lets a QR rescan on another floor re-anchor the same
   journey instead of starting over.
   ========================================================================= */

const DESTINATION_STORAGE_PREFIX = "alertup-route-dest:";

export interface StoredDestination {
  kind: DestinationSelection["kind"];
  poiId?: string;
  nodeId?: string;
  name: string;
}

export function readStoredDestination(buildingId: string): StoredDestination | null {
  try {
    const raw = sessionStorage.getItem(DESTINATION_STORAGE_PREFIX + buildingId);
    return raw ? (JSON.parse(raw) as StoredDestination) : null;
  } catch {
    return null;
  }
}

export function writeStoredDestination(
  buildingId: string,
  destination: StoredDestination | null,
): void {
  try {
    const key = DESTINATION_STORAGE_PREFIX + buildingId;
    if (destination) sessionStorage.setItem(key, JSON.stringify(destination));
    else sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable — the journey just won't survive a rescan */
  }
}

export interface WayfindingPanelProps {
  buildingId: string;
  /** Node the user scanned — the route origin. */
  originNodeId: string;
  /** Floor number from the scan, used to re-anchor after a rescan. */
  originFloorNumber?: number;
  /** Opens the page's QR scanner so the user can re-anchor mid-route. */
  onRescan?: () => void;
  className?: string;
}

export const WayfindingPanel = ({
  buildingId,
  originNodeId,
  originFloorNumber,
  onRescan,
  className,
}: WayfindingPanelProps) => {
  const { t } = useI18n();
  const [route, setRoute] = useState<AssembledRoute | null>(null);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useRouteProgress(route);
  const { camera, svgRef, handlers, isDragging } = useMapCamera({
    minScale: 0.5,
    maxScale: 3,
  });

  const loadRoute = useCallback(
    async (selection: DestinationSelection) => {
      setLoading(true);
      setError(null);
      try {
        const next =
          selection.kind === "nearest-exit"
            ? await fetchEvacuationRoute(originNodeId)
            : await fetchRoute({
                fromNodeId: originNodeId,
                toPoiId: selection.poiId,
                toNodeId: selection.nodeId,
              });

        setRoute(next);
        setDestinationName(selection.name);
        progress.reset();
        writeStoredDestination(buildingId, {
          kind: selection.kind,
          poiId: selection.poiId,
          nodeId: selection.nodeId,
          name: selection.name,
        });

        // A rescan lands mid-journey: jump to the leg on the scanned floor.
        if (originFloorNumber !== undefined) {
          progress.syncToFloorNumber(originFloorNumber);
        }
      } catch (err) {
        setError(errorMessage(err));
        setRoute(null);
      } finally {
        setLoading(false);
      }
    },
    [buildingId, originNodeId, originFloorNumber, progress],
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
    setDestinationName(null);
    setError(null);
    writeStoredDestination(buildingId, null);
  }, [buildingId]);

  // Floors the route actually crosses, in walking order.
  const floors = useMemo<FloorSummary[]>(() => {
    if (!route) return [];
    const seen = new Map<string, FloorSummary>();
    for (const segment of route.segments) {
      if (segment.floor && !seen.has(segment.floor.id)) {
        seen.set(segment.floor.id, segment.floor);
      }
    }
    return [...seen.values()];
  }, [route]);

  const displayedSegment = useMemo(() => {
    if (!route) return null;
    if (!progress.isPreviewing) return progress.activeSegment;
    return (
      route.segments.find((s) => s.floor?.id === progress.displayFloorId) ?? null
    );
  }, [route, progress]);

  const displayedFloor = displayedSegment?.floor ?? null;

  const displayedNodes = useMemo<MapNode[]>(
    () =>
      (displayedSegment?.nodes ?? []).map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        type: node.type,
        label: node.label,
      })),
    [displayedSegment],
  );

  // The "you are here" dot only belongs on the floor the user is really on.
  const userPosition = useMemo(() => {
    if (!progress.activeSegment || progress.isPreviewing) return null;
    const first = progress.activeSegment.nodes[0];
    return first ? { x: first.x, y: first.y } : null;
  }, [progress]);

  return (
    <section className={cn("space-y-4", className)} data-testid="wayfinding-panel">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">{t("wayfinding.whereTo")}</h2>
        <DestinationSearch buildingId={buildingId} onSelect={loadRoute} />
      </div>

      {loading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-8 text-ink-muted"
        >
          <SpinnerIcon className="size-5" aria-hidden="true" />
          {t("common.loading")}
        </div>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {route && !loading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {t("wayfinding.routeTo", { name: destinationName ?? "" })}
              </p>
              {route.totalDistanceMeters !== null ? (
                <p className="text-sm text-ink-muted">
                  {t("wayfinding.distanceMeters", {
                    meters: route.totalDistanceMeters,
                  })}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={clearRoute}>
              {t("wayfinding.startOver")}
            </Button>
          </div>

          <FloorSwitcher
            floors={floors}
            activeFloorId={progress.displayFloorId}
            currentFloorId={progress.activeSegment?.floor?.id ?? null}
            onSelect={progress.previewFloor}
          />

          <MapCanvas
            space={{
              width: displayedFloor?.width ?? 1000,
              height: displayedFloor?.height ?? 800,
            }}
            camera={camera}
            svgRef={svgRef}
            handlers={handlers}
            isDragging={isDragging}
            interactive
            ariaLabel={t("wayfinding.routeTo", { name: destinationName ?? "" })}
            className="h-[52vh] min-h-72"
          >
            <FloorImageLayer
              floor={displayedFloor}
              space={{
                width: displayedFloor?.width ?? 1000,
                height: displayedFloor?.height ?? 800,
              }}
            />
            <RouteLayer
              segment={displayedSegment}
              tone={route.mode === "EVACUATION" ? "danger" : "brand"}
            />
            <NodeLayer nodes={displayedNodes} scale={camera.scale} />
            <UserDotLayer position={userPosition} label={t("wayfinding.yourLocation")} />
          </MapCanvas>

          <RouteStepper progress={progress} onRescan={onRescan} />
        </div>
      ) : null}
    </section>
  );
};

export default WayfindingPanel;
