import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MapCanvas } from "../map/MapCanvas";
import { useMapCamera } from "../map/useMapCamera";
import { FloorImageLayer } from "../map/layers/FloorImageLayer";
import { DrawingLayer } from "../map/layers/DrawingLayer";
import { parseDrawing, isDrawingEmpty } from "../map/drawing";
import { RouteLayer } from "../map/layers/RouteLayer";
import { NodeLayer } from "../map/layers/NodeLayer";
import { UserDotLayer } from "../map/layers/UserDotLayer";
import { MapViewToggle } from "../map/MapViewToggle";
import {
  readMapViewPreference,
  writeMapViewPreference,
  type MapViewMode,
} from "../map/viewPreference";
import { useMap3dSupport } from "../map3d/useMap3dSupport";
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

/** The 3D route view — three.js stays in its lazy chunk. */
const Map3DRouteLazy = lazy(() =>
  import("../map3d").then((m) => ({ default: m.Map3DRoute })),
);

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
  /**
   * Destination pushed in from outside the search box — the scan page routes
   * "tap a marker on the map" and the emergency overlay's "show exit route"
   * through here. The token distinguishes repeat requests for the same
   * destination (tapping "nearest exit" twice must re-route twice).
   */
  externalSelection?: (DestinationSelection & { token: number }) | null;
  /**
   * Rendered in the map slot while no route is active, so the page shows one
   * continuous map experience: the overview map sits here until a destination
   * replaces it with the route view.
   */
  idleContent?: ReactNode;
  /** Fires when a route appears/disappears — lets the page swap chrome. */
  onRouteActive?: (active: boolean) => void;
  /** Hide the built-in search box — for hosts with their own picker (the scan
   *  page's directory) that push choices via externalSelection. */
  hideSearch?: boolean;
  className?: string;
}

export const WayfindingPanel = ({
  buildingId,
  originNodeId,
  originFloorNumber,
  onRescan,
  externalSelection,
  idleContent,
  onRouteActive,
  hideSearch = false,
  className,
}: WayfindingPanelProps) => {
  const { t } = useI18n();
  const [route, setRoute] = useState<AssembledRoute | null>(null);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supports3d = useMap3dSupport();
  const [viewMode, setViewMode] = useState<MapViewMode>(readMapViewPreference);
  const view3d = supports3d && viewMode === "3d";

  const changeView = useCallback((mode: MapViewMode) => {
    setViewMode(mode);
    writeMapViewPreference(mode);
  }, []);

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

  // External selections (marker taps, the emergency overlay) run through the
  // exact same loadRoute path as the search box — one code path, one behaviour.
  const lastExternalTokenRef = useRef(0);
  useEffect(() => {
    if (!externalSelection) return;
    if (externalSelection.token === lastExternalTokenRef.current) return;
    lastExternalTokenRef.current = externalSelection.token;
    void loadRoute({
      kind: externalSelection.kind,
      poiId: externalSelection.poiId,
      nodeId: externalSelection.nodeId,
      name: externalSelection.name,
    });
  }, [externalSelection, loadRoute]);

  const routeActive = Boolean(route && !loading);
  const onRouteActiveRef = useRef(onRouteActive);
  onRouteActiveRef.current = onRouteActive;
  useEffect(() => {
    onRouteActiveRef.current?.(routeActive);
  }, [routeActive]);

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

  // Re-parsed per floor change rather than per render: the drawing arrives as
  // untyped JSON on the route response and can hold hundreds of shapes.
  const displayedDrawing = useMemo(() => {
    const parsed = parseDrawing(displayedFloor?.drawing);
    return isDrawingEmpty(parsed) ? null : parsed;
  }, [displayedFloor?.drawing]);

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
      {!hideSearch && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink">{t("wayfinding.whereTo")}</h2>
          <DestinationSearch buildingId={buildingId} onSelect={loadRoute} />
        </div>
      )}

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

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* In 3D every floor is on screen at once, stacked — switching
                floors to peek is a 2D-only need. */}
            {!view3d ? (
              <FloorSwitcher
                floors={floors}
                activeFloorId={progress.displayFloorId}
                currentFloorId={progress.activeSegment?.floor?.id ?? null}
                onSelect={progress.previewFloor}
              />
            ) : (
              <span />
            )}
            {supports3d && <MapViewToggle mode={viewMode} onChange={changeView} />}
          </div>

          {view3d ? (
            <div className="h-[55dvh] min-h-72 sm:h-[52vh]">
              <Suspense
                fallback={
                  <div className="h-full w-full animate-pulse rounded-xl border border-line bg-surface-2" />
                }
              >
                <Map3DRouteLazy
                  route={route}
                  activeStepIndex={progress.activeIndex}
                  tone={route.mode === "EVACUATION" ? "danger" : "brand"}
                  userDot={
                    !progress.isPreviewing &&
                    progress.activeSegment?.nodes[0] &&
                    progress.activeSegment.floor
                      ? {
                          x: progress.activeSegment.nodes[0].x,
                          y: progress.activeSegment.nodes[0].y,
                          floorId: progress.activeSegment.floor.id,
                        }
                      : null
                  }
                  onUnavailable={() => changeView("2d")}
                  ariaLabel={t("wayfinding.routeTo", { name: destinationName ?? "" })}
                />
              </Suspense>
            </div>
          ) : (
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
            className="h-[55dvh] min-h-72 sm:h-[52vh]"
          >
            <FloorImageLayer
              floor={displayedFloor}
              space={{
                width: displayedFloor?.width ?? 1000,
                height: displayedFloor?.height ?? 800,
              }}
              // A drawn floor supplies its own plan; the "no map" notice would
              // sit underneath it saying otherwise.
              placeholderLabel={displayedDrawing ? null : undefined}
            />
            <DrawingLayer drawing={displayedDrawing} scale={camera.scale} />
            <RouteLayer
              segment={displayedSegment}
              tone={route.mode === "EVACUATION" ? "danger" : "brand"}
            />
            <NodeLayer nodes={displayedNodes} scale={camera.scale} />
            <UserDotLayer position={userPosition} label={t("wayfinding.yourLocation")} />
          </MapCanvas>
          )}

          <RouteStepper progress={progress} onRescan={onRescan} />
        </div>
      ) : (
        !loading && idleContent
      )}
    </section>
  );
};

export default WayfindingPanel;
