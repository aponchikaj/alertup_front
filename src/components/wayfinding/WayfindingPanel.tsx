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
import { AlternativeExits } from "./AlternativeExits";
import { isEmergencyRoute } from "./emergencyRoute";
import { FloorSwitcher } from "./FloorSwitcher";
import { RouteStepper } from "./RouteStepper";
import { useRouteProgress } from "./useRouteProgress";
import { writeStoredDestination } from "./storedDestination";
import { RouteProfilePicker } from "./RouteProfilePicker";
import {
  readRouteProfile,
  writeRouteProfile,
  type SelectableRouteProfile,
} from "./routeProfile";
import { fetchRoute, fetchEvacuationRoute } from "../../apis/wayfindingApi";
import { errorMessage } from "../../apis/http";
import { Alert } from "../ui/feedback";
import { Button } from "../ui/button";
import { SpinnerIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import { formatDistance, formatDistanceAndEta, formatDuration } from "../../lib/format";
import { useLatestRef } from "../../lib/useLatestRef";
import type { AssembledRoute, FloorSummary, MapNode, RouteProfile } from "../map/types";

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

/** The 3D route view — three.js stays in its lazy chunk. */
const Map3DRouteLazy = lazy(() =>
  import("../map3d").then((m) => ({ default: m.Map3DRoute })),
);

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
  /**
   * Bumped by the host (the scan page's `closureVersion`) whenever a closure
   * changed on the server. A change silently re-requests the destination
   * already on screen — `lastSelectionRef.current` — and does nothing when no
   * route is displayed. Distinct from `externalSelection`: this never opens a
   * new destination, it only refreshes the one already showing.
   */
  refetchToken?: number;
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
  refetchToken,
  className,
}: WayfindingPanelProps) => {
  const { t, lang } = useI18n();
  const [route, setRoute] = useState<AssembledRoute | null>(null);
  /**
   * Bumped on every successful load. `route` identity is not enough on its own:
   * a cached or memoised response can arrive as the very same object, and a
   * fresh load still has to put the visitor back at the top of the route.
   */
  const [routeSeq, setRouteSeq] = useState(0);
  const [destinationName, setDestinationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** A profile-change refetch: the route stays on screen while it runs. */
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lazy init: one localStorage read on mount, not one per render.
  const [profile, setProfile] = useState<SelectableRouteProfile>(readRouteProfile);
  /** The destination currently being walked to — what a refetch re-requests. */
  const lastSelectionRef = useRef<DestinationSelection | null>(null);
  /**
   * Monotonic id of the newest route request. Every load captures its own id
   * and drops its response if the id has moved on — that is what stops a
   * refetch that was in flight during "Start over" (or one overtaken by a
   * marker tap) from resurrecting a route the user already dismissed.
   */
  const requestSeqRef = useRef(0);
  /** Abort handle for the in-flight request, so a superseded fetch stops. */
  const inFlightRef = useRef<AbortController | null>(null);
  /**
   * The selection we have already re-requested with a compass heading.
   * Compared by identity, not value: a heading refetch re-stores the very same
   * selection object, while a new destination brings a new one — so the heading
   * goes out exactly once per route instead of looping on its own response.
   */
  const headingSentForRef = useRef<DestinationSelection | null>(null);
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

  /**
   * Fetch (or refetch) the route to `selection`.
   *
   * `silent` is what makes a profile change feel safe: the map keeps showing
   * the route you are standing in while the new one loads, and if the new one
   * never arrives you are left with the old one plus an error rather than an
   * empty screen. That "last good route stays put" behaviour is the static
   * fail-safe the emergency surfaces lean on.
   */
  const loadRoute = useCallback(
    async (
      selection: DestinationSelection,
      options: {
        // A visitor only ever picks a SelectableRouteProfile, but routing to
        // an alternative exit forces "emergency" — a profile the picker
        // itself never offers — so this accepts the full RouteProfile union.
        profile?: RouteProfile;
        heading?: number;
        silent?: boolean;
      } = {},
    ) => {
      // `selection.profile` beats the visitor's saved preference: an
      // alternative exit pins "emergency" on the selection itself so that
      // every later refetch of it — a heading, a closure update — keeps
      // asking for the emergency profile, not whatever the picker has saved.
      const requestedProfile = options.profile ?? selection.profile ?? profile;
      const seq = ++requestSeqRef.current;
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      if (options.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const next =
          selection.kind === "nearest-exit"
            ? // /evacuate takes `accessible`, not `profile`: a non-emergency
              // profile there reads as a downgrade and would hide the
              // EMERGENCY_ONLY edges this route exists to use.
              await fetchEvacuationRoute(originNodeId, {
                accessible: requestedProfile === "wheelchair",
                heading: options.heading,
                signal: controller.signal,
              })
            : await fetchRoute({
                fromNodeId: originNodeId,
                toPoiId: selection.poiId,
                toNodeId: selection.nodeId,
                profile: requestedProfile,
                heading: options.heading,
                signal: controller.signal,
              });

        // Superseded while we waited — the newer request owns the screen.
        if (requestSeqRef.current !== seq) return;

        setRoute(next);
        setRouteSeq((n) => n + 1);
        // Only now: a destination that never loaded must not become the one a
        // later profile change silently re-requests.
        lastSelectionRef.current = selection;
        setDestinationName(selection.name);
        writeStoredDestination(buildingId, {
          kind: selection.kind,
          poiId: selection.poiId,
          nodeId: selection.nodeId,
          name: selection.name,
        });
        // Progress restarts on its own: useRouteProgress resets whenever a new
        // route arrives. Re-anchoring after a rescan happens in an effect
        // below, against the route that actually committed — the `progress`
        // captured here belongs to the route being replaced.
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        // Deliberately does NOT clear `route`: a stale route still gets the
        // visitor to the door, an empty panel gets them nowhere.
        setError(errorMessage(err));
      } finally {
        // `finally` runs even on the early returns above; only the newest
        // request may take the spinners down — and only it may declare the
        // panel idle again, which is what the heading refetch checks before it
        // dares replace a request that is still running.
        if (requestSeqRef.current === seq) {
          inFlightRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [buildingId, originNodeId, profile],
  );

  /**
   * A new route puts the visitor back at its first instruction — and, after a
   * rescan, on the leg for the floor the code was actually on.
   *
   * This has to run after the new route commits. Doing it inside `loadRoute`
   * ran it against the `progress` captured when the fetch started, so the
   * re-anchor index was computed over the *previous* route's feed and then
   * applied to the new one.
   */
  const resetProgressRef = useLatestRef(progress.reset);
  const syncToFloorRef = useLatestRef(progress.syncToFloorNumber);
  useEffect(() => {
    if (routeSeq === 0) return;
    resetProgressRef.current();
    if (originFloorNumber !== undefined) {
      syncToFloorRef.current(originFloorNumber);
    }
  }, [routeSeq, originFloorNumber, resetProgressRef, syncToFloorRef]);

  /** Remember the preference, then re-route the journey already on screen. */
  const onProfileChange = useCallback(
    (next: SelectableRouteProfile) => {
      setProfile(next);
      writeRouteProfile(next);
      const selection = lastSelectionRef.current;
      if (selection) void loadRoute(selection, { profile: next, silent: true });
    },
    [loadRoute],
  );

  /**
   * The compass produced a bearing. Only the opening instruction depends on
   * which way the visitor is facing, so this re-asks the server once, silently:
   * the route already on screen stays put while the better-phrased one loads,
   * and a failure leaves the visitor with a route that still works.
   */
  const onHeading = useCallback(
    (heading: number) => {
      // A request is still running, and `lastSelectionRef` is only written on
      // success — so it still names the destination being replaced. Refetching
      // it now would abort the newer request and strand the user on the old
      // destination. A heading is an improvement, never worth that: stand down.
      if (inFlightRef.current) return;
      const selection = lastSelectionRef.current;
      if (!selection || headingSentForRef.current === selection) return;
      headingSentForRef.current = selection;
      void loadRoute(selection, { heading, silent: true });
    },
    [loadRoute],
  );

  /**
   * A tap on one of the up-to-two alternative exits `AlternativeExits` shows.
   * Routed through the very same `loadRoute` path as any other destination —
   * a plain node id on the normal route endpoint, pinned to the emergency
   * profile on the *selection* (not just this call) so EMERGENCY_ONLY edges
   * stay visible on every later refetch too — a heading, a closure update —
   * never `/evacuate` (the exit is already chosen, so there is nothing left
   * for the server to pick). Silent: the route already on screen (and its own
   * alternatives) must stay up while the new one loads, same as a profile
   * change or a heading refetch — this matters most mid-evacuation.
   */
  const onSelectAlternativeExit = useCallback(
    (exitNodeId: string, label: string) => {
      void loadRoute(
        { kind: "exit", nodeId: exitNodeId, name: label, profile: "emergency" },
        { silent: true },
      );
    },
    [loadRoute],
  );

  const clearRoute = useCallback(() => {
    // Bump the sequence first: any request still in flight is now stale and
    // its response will be dropped rather than undoing this.
    requestSeqRef.current += 1;
    inFlightRef.current?.abort();
    inFlightRef.current = null;
    setRoute(null);
    setDestinationName(null);
    setError(null);
    setLoading(false);
    setRefreshing(false);
    lastSelectionRef.current = null;
    headingSentForRef.current = null;
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

  /**
   * A closure changed somewhere in the building. `refetchToken` only ever
   * moves forward (the host's `closureVersion` counter), so any change here —
   * never the initial value — means "re-request what's on screen, silently".
   * Nothing to do when no route is displayed: there is nothing to refresh, and
   * the token still has to be recorded so a later route doesn't inherit a
   * refetch meant for an event that predates it.
   */
  const lastRefetchTokenRef = useRef(refetchToken);
  useEffect(() => {
    if (refetchToken === undefined) return;
    if (lastRefetchTokenRef.current === refetchToken) return;
    lastRefetchTokenRef.current = refetchToken;
    const selection = lastSelectionRef.current;
    if (!selection) return;
    void loadRoute(selection, { silent: true });
  }, [refetchToken, loadRoute]);

  const routeActive = Boolean(route && !loading);
  const onRouteActiveRef = useLatestRef(onRouteActive);
  useEffect(() => {
    onRouteActiveRef.current?.(routeActive);
  }, [routeActive, onRouteActiveRef]);

  /**
   * The headline under the destination name. Prefers the server's metre/second
   * totals; falls back through whichever half exists, then to the legacy
   * metres-only line so an older backend still says something useful.
   */
  const totalsLine = useMemo(() => {
    if (!route) return null;
    const { totalDistanceM, totalDurationSec } = route;
    if (totalDistanceM !== undefined && totalDurationSec !== undefined) {
      return formatDistanceAndEta(totalDistanceM, totalDurationSec, lang);
    }
    if (totalDistanceM !== undefined) return formatDistance(totalDistanceM, lang);
    if (totalDurationSec !== undefined) return formatDuration(totalDurationSec, lang);
    if (route.totalDistanceMeters !== null) {
      return t("wayfinding.distanceMeters", { meters: route.totalDistanceMeters });
    }
    return null;
  }, [route, lang, t]);

  /** Evacuation reads red — whether the mode or the profile says so. */
  const routeTone =
    route && isEmergencyRoute(route) ? ("danger" as const) : ("brand" as const);

  const warnings = route?.warnings ?? [];

  /**
   * `{reason} — until {time}`, localised with `Intl.DateTimeFormat` — `ka-GE`
   * for Georgian, `en-GB` otherwise, per the brief. A closure with no
   * `endsAt` (open-ended) shows just its reason rather than an "until never".
   *
   * `reason` is nullable on the wire (`publicClosure` emits `row.reason ??
   * null`) — falling straight into the template would interpolate the
   * literal string "null" in front of a visitor mid-route, so a missing
   * reason is replaced with a generic label before it ever reaches `t()`.
   */
  const closureLabels = useMemo(() => {
    const closures = route?.closures ?? [];
    if (closures.length === 0) return [];
    const formatter = new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return closures.map((closure) => {
      const reason = closure.reason ?? t("wayfinding.closureReasonUnknown");
      return {
        id: closure.id,
        text: closure.endsAt
          ? t("wayfinding.closureUntil", {
              reason,
              time: formatter.format(new Date(closure.endsAt)),
            })
          : reason,
      };
    });
  }, [route, lang, t]);

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
              {totalsLine ? (
                <p className="text-sm text-ink-muted">{totalsLine}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={clearRoute}>
              {t("wayfinding.startOver")}
            </Button>
          </div>

          {warnings.length > 0 ? (
            <Alert tone="warning" title={t("wayfinding.warningsTitle")}>
              <ul className="space-y-0.5">
                {warnings.map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {closureLabels.length > 0 ? (
            <Alert tone="info" title={t("wayfinding.closuresTitle")}>
              <ul className="space-y-0.5">
                {closureLabels.map((closure) => (
                  <li key={closure.id}>{closure.text}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <AlternativeExits route={route} onSelect={onSelectAlternativeExit} />

          <div className="flex flex-wrap items-center gap-2">
            <RouteProfilePicker
              value={profile}
              onChange={onProfileChange}
              busy={refreshing}
              className="min-w-44 flex-1 sm:max-w-56 sm:flex-none"
            />
            {refreshing ? (
              <span
                role="status"
                className="flex items-center gap-2 text-sm text-ink-muted"
              >
                <SpinnerIcon className="size-4" aria-hidden="true" />
                {t("common.loading")}
              </span>
            ) : null}
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
                  // The scene indexes route.steps, not the instruction feed.
                  activeStepIndex={progress.activeStepIndex}
                  tone={routeTone}
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
              tone={routeTone}
            />
            <NodeLayer nodes={displayedNodes} scale={camera.scale} />
            <UserDotLayer position={userPosition} label={t("wayfinding.yourLocation")} />
          </MapCanvas>
          )}

          <RouteStepper
            progress={progress}
            onRescan={onRescan}
            onHeading={onHeading}
          />
        </div>
      ) : (
        !loading && idleContent
      )}
    </section>
  );
};

export default WayfindingPanel;
