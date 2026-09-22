import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { get, ApiError } from '../../apis/http';
import { evacuatedFunc } from '../../apis/building';
import { usePageAnimations } from '../../lib/animations';
import { LocationOverviewMap } from './LocationOverviewMap';
import type { AssembledRoute, FloorRecord, RouteSegment } from '../../components/map/types';
import type { DestinationSelection } from '../../components/wayfinding/DestinationSearch';
import { PageShell, PageHeader } from '../../components/ui/layout';
import { Card } from '../../components/ui/card';
import { Alert, Badge } from '../../components/ui/feedback';
import { Button } from '../../components/ui/button';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExitDoorIcon,
  MapIcon,
  MapPinIcon,
  RouteIcon,
  SearchIcon,
  SpinnerIcon,
} from '../../components/ui/icons';
import { EmergencyProvider } from '../../emergency/EmergencyProvider';
import { useEmergency } from '../../emergency/useEmergency';
import { EmergencyOverlay } from '../../components/emergency/EmergencyOverlay';
import { EmergencyBanner } from '../../components/emergency/EmergencyBanner';
import { WayfindingPanel } from '../../components/wayfinding/WayfindingPanel';
import { parseDrawing, isDrawingEmpty } from '../../components/map/drawing';
import { DirectoryPanel } from './DirectoryPanel';
import { fetchDirectory, type DirectoryEntry } from '../../apis/wayfindingApi';
import { AiChatLauncher } from '../../components/ai/AiChatLauncher';
import { useI18n } from '../../i18n/LanguageProvider';

interface FloorNode {
  id: string;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label: string;
  connections: string[];
}

interface EmergencyRoute {
  found: boolean;
  message?: string | null;
  exitNodeId: string | null;
  path: string[];
  distance: number;
  walkingDistance?: number;
  exitNode: (FloorNode & { floor?: number }) | null;
}

interface RouteNode {
  id: string;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label: string;
  floor: number;
}

interface FloorTransition {
  from: number;
  to: number;
  atStep: number;
  nodeType: string;
}

interface FloorMap {
  floor: string;
  map: string;
  svgContent?: string;
  imageUrl?: string;
  /** Hand-drawn plan authored in the map editor; parsed with parseDrawing. */
  drawing?: unknown;
  /** Canvas size for drawn floors; uploaded plans use the 1000x800 default. */
  width?: number | null;
  height?: number | null;
}

/**
 * Live emergency state, added by the v2 backend. Optional so this page keeps
 * working verbatim against an older deployment that does not send it.
 */
interface ScanEmergencyState {
  active: boolean;
  message: string | null;
  emergencyId: string | null;
}

interface RouteData {
  qrId: string;
  buildingId: string;
  buildingName: string;
  floorNumber: number;
  nodeId: string;
  nodeType: 'path' | 'exit' | 'stairs';
  nodeLabel: string;
  nodePosition: { x: number; y: number };
  connectedNodes: FloorNode[];
  allFloorNodes: FloorNode[];
  /** Every step of the route, including steps on other floors. */
  routeNodes: RouteNode[];
  floorTransitions: FloorTransition[];
  requiresFloorChange: boolean;
  emergencyRoute: EmergencyRoute;
  floorMap: FloorMap | null;
  timestamp: string;
  scanCount: number;
  emergency?: ScanEmergencyState;
  /** Modern stepper-shaped evacuation route (v2 backend). */
  route?: AssembledRoute;
}

/**
 * Emergency surfaces layered over the scan page.
 *
 * Kept as a child component so it sits inside EmergencyProvider. The overlay
 * appears the instant an emergency is reported — the scan payload seeds the
 * provider, so it paints on first render rather than waiting for the stream.
 */
const EmergencyLayer: React.FC<{ onShowExitRoute: () => void }> = ({
  onShowExitRoute,
}) => {
  const emergency = useEmergency();
  const { t } = useI18n();
  if (!emergency) return null;

  return (
    <>
      {emergency.phase === 'bypassed' ? (
        <EmergencyBanner onViewRoute={onShowExitRoute} />
      ) : null}

      {emergency.phase === 'resolvedNotice' ? (
        <Alert tone="success" className="mb-4" title={t('emergency.resolvedTitle')}>
          <p>{t('emergency.resolvedBody')}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={emergency.dismissResolvedNotice}
          >
            {t('emergency.dismiss')}
          </Button>
        </Alert>
      ) : null}

      <EmergencyOverlay
        open={emergency.phase === 'emergency'}
        message={emergency.message}
        onShowRoute={() => {
          onShowExitRoute();
          emergency.bypass();
        }}
        onBypass={emergency.bypass}
      />
    </>
  );
};

/**
 * Emergency-only actions: the safety instructions and the "I evacuated"
 * report. Gated on the live emergency state — in a calm building these teach
 * visitors to ignore the warning that one day matters.
 */
const EmergencyActions: React.FC<{ onEvacuated: () => void }> = ({ onEvacuated }) => {
  const emergency = useEmergency();
  const { t } = useI18n();
  if (!emergency) return null;
  if (emergency.phase !== 'emergency' && emergency.phase !== 'bypassed') return null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Alert tone="danger" title={t('route.instructionsTitle')}>
        <p className="text-sm">{t('route.instructionsLead')}</p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem] font-medium">
          <li>{t('route.instruction1')}</li>
          <li>{t('route.instruction2')}</li>
          <li>{t('route.instruction3')}</li>
          <li>{t('route.instruction4')}</li>
          <li>{t('route.instruction5')}</li>
        </ul>
      </Alert>
      <Button size="lg" fullWidth onClick={onEvacuated} aria-label={t('route.evacuated')}>
        <CheckCircleIcon size={18} />
        {t('route.evacuated')}
      </Button>
    </div>
  );
};

/**
 * Page framing, decided by the *live* emergency state rather than by the fact
 * that this page can show an exit route.
 *
 * A visitor who scans a code in a calm building is doing everyday wayfinding —
 * titling that screen "Emergency route" and stamping a red badge on it made the
 * warning meaningless by the time it mattered. Kept as a child component so it
 * sits inside EmergencyProvider and follows the same source of truth as the
 * overlay: the scan payload seeds the provider, the stream updates it.
 */
const RouteHeader: React.FC<{ buildingName: string; floorNumber: number }> = ({
  buildingName,
  floorNumber,
}) => {
  const emergency = useEmergency();
  const { t } = useI18n();
  // 'bypassed' is still an active emergency — the visitor only acknowledged the
  // overlay, so the framing must stay red.
  const isEmergency =
    emergency?.phase === 'emergency' || emergency?.phase === 'bypassed';

  return (
    <PageHeader
      title={isEmergency ? t('route.emergencyTitle') : t('route.title')}
      description={t('route.subtitle', {
        building: buildingName,
        floor: floorNumber,
      })}
      actions={
        <Badge
          tone={isEmergency ? 'danger' : 'brand'}
          className="px-3 py-1.5 text-sm"
        >
          {isEmergency ? <AlertTriangleIcon size={16} /> : <MapPinIcon size={16} />}
          {isEmergency ? t('route.badgeEmergency') : t('route.badgeNormal')}
        </Badge>
      }
    />
  );
};

/** Hides the AI launcher while the emergency overlay is demanding attention. */
const AiLayer: React.FC<{ buildingId: string; nodeId: string; locale: 'en' | 'ka' }> = ({
  buildingId,
  nodeId,
  locale,
}) => {
  const emergency = useEmergency();
  return (
    <AiChatLauncher
      hidden={emergency?.phase === 'emergency'}
      context={{ buildingId, nodeId, locale }}
    />
  );
};

const QRScanRoutePageFixed: React.FC = () => {
  const { qrId } = useParams<{ qrId: string }>();
  const rootRef = usePageAnimations();
  const { lang, t } = useI18n();

  // Held in a ref so the fetch effect keeps its empty dependency list. Listing
  // `t` there would re-run the scan request — and flash the loading screen —
  // every time the language toggle is pressed, which is exactly the moment you
  // do not want the route to disappear.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * One map slot, three states. The wayfinding panel owns it: while no route
   * is active it shows the overview map (you-are-here, drawn plan, evacuation
   * preview); picking a destination — from the search box, a tapped marker or
   * the emergency overlay — swaps the same slot to the route view. The old
   * page rendered two different-looking maps of the same floor at once.
   */
  const [routeActive, setRouteActive] = useState(false);
  const selectionTokenRef = useRef(0);
  const [externalSelection, setExternalSelection] = useState<
    (DestinationSelection & { token: number }) | null
  >(null);

  const pushSelection = useCallback((selection: DestinationSelection) => {
    selectionTokenRef.current += 1;
    setExternalSelection({ ...selection, token: selectionTokenRef.current });
    // Optional-chained twice: jsdom has no scrollIntoView, and a missing
    // scroll must never block the route itself.
    document.getElementById('scan-map')?.scrollIntoView?.({
      // Smooth is a courtesy, not a requirement.
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }, []);

  const requestEvacuation = useCallback(() => {
    pushSelection({ kind: 'nearest-exit', name: tRef.current('wayfinding.nearestExit') });
  }, [pushSelection]);

  /*
   * The idle slot leads with the directory, not the map: a list answers
   * "what is here?" faster than a floor plan, and it works one-handed. The
   * map stays one tap away, and picking anything from either view swaps the
   * slot to the route.
   */
  const [idleView, setIdleView] = useState<'list' | 'map'>('list');
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  useEffect(() => {
    const buildingId = routeData?.buildingId;
    if (!buildingId) return;
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError(null);
    fetchDirectory(buildingId)
      .then((entries) => {
        if (!cancelled) setDirectory(entries);
      })
      .catch(() => {
        // The directory failing must not block the page — the map view still
        // works, so degrade to it rather than an error wall.
        if (!cancelled) {
          setDirectoryError(tRef.current('route.directoryFailed'));
          setIdleView('map');
        }
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeData?.buildingId]);

  // The drawn floor plan, if the owner made one. Parsed at the boundary — the
  // wire value is an untyped JSON column — and re-parsed only when the payload
  // changes, not on every pan/zoom render.
  const drawnPlan = useMemo(() => {
    const parsed = parseDrawing(routeData?.floorMap?.drawing);
    return isDrawingEmpty(parsed) ? null : parsed;
  }, [routeData?.floorMap?.drawing]);

  // floorMap reshaped for the shared renderer.
  const floorRecord = useMemo<FloorRecord | null>(() => {
    const fm = routeData?.floorMap;
    if (!fm) return null;
    return {
      id: 'scanned-floor',
      floorNumber: Number(routeData?.floorNumber) || 0,
      name: fm.floor ?? null,
      mapImageUrl: fm.imageUrl || null,
      svgContent: fm.svgContent || null,
      width: fm.width ?? null,
      height: fm.height ?? null,
      scalePixelsPerMeter: null,
    };
  }, [routeData?.floorMap, routeData?.floorNumber]);

  // The evacuation leg on the scanned floor, previewed on the overview map
  // before anyone asks: in a real emergency people follow the line they have
  // already seen.
  const evacPreviewSegment = useMemo<RouteSegment | null>(() => {
    const modern = routeData?.route;
    if (!modern?.segments?.length) return null;
    const floorNo = Number(routeData?.floorNumber);
    return (
      modern.segments.find((seg) => seg.floor?.floorNumber === floorNo) ??
      modern.segments[0]
    );
  }, [routeData?.route, routeData?.floorNumber]);

  const fetchRouteData = useCallback(async (qrId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await get<{ success: boolean; message?: string; data: RouteData }>(
        `/api/qr/scan/route/${qrId}`
      );

      if (response.success) {
        setRouteData(response.data);
      } else {
        setError(response.message || tRef.current('route.loadFailed'));
      }
    } catch (err: unknown) {
      console.error('Error fetching route data:', err);

      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError(tRef.current('route.qrNotFound'));
        } else if (err.status === 400) {
          setError(tRef.current('route.qrInvalid'));
        } else {
          setError(err.message || tRef.current('route.loadFailed'));
        }
      } else {
        setError(
          err instanceof Error ? err.message : tRef.current('route.loadFailed'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {

    if (qrId) {
      fetchRouteData(qrId);
    }
  }, [qrId, fetchRouteData]);

  const handleGoBack = () => {
    window.history.back();
  };

  const handleEvacuated = async() => {
    // Guarded: posting an undefined buildingId silently dropped the report, and
    // evacuation counts are what the building owner watches during an incident.
    if (!routeData?.buildingId) {
      setError(t('route.evacuatedUnknownBuilding'));
      return;
    }

    try {
      const res = await evacuatedFunc(routeData.buildingId)
      if (!res || res.Success === false) {
        setError(res?.Message || t('route.evacuatedFailed'));
        return;
      }
    } catch {
      setError(t('route.evacuatedFailed'));
      return;
    }

    window.location.href = '/';
  };

  const handleGoHome = ()=>{
    window.location.href = '/'
  }

  if (loading) {
    return (
      <PageShell width="wide">
        <PageHeader title={t('route.loadingTitle')} />
        <div
          role="status"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-4 pt-8"
        >
          <SpinnerIcon size={48} className="text-brand-text" />
          <p className="text-lg font-medium text-ink-muted">
            {t('route.loadingBody')}
          </p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell width="wide">
        <PageHeader title={t('route.errorTitle')} />
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pt-10">
          <Alert tone="danger">
            <p className="text-base">{error}</p>
          </Alert>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleGoBack}
              aria-label={t('common.back')}
            >
              <ArrowLeftIcon size={18} />
              {t('common.back')}
            </Button>
            <Button
              size="lg"
              fullWidth
              onClick={handleGoHome}
              aria-label={t('common.home')}
            >
              {t('common.home')}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!routeData) {
    return (
      <PageShell width="wide">
        <PageHeader title={t('route.notFoundTitle')} />
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pt-10">
          <Alert tone="danger">
            <p className="text-base">
              {t('route.notFoundBody', { qrId: qrId ?? '' })}
            </p>
          </Alert>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleGoBack}
              aria-label={t('common.back')}
            >
              <ArrowLeftIcon size={18} />
              {t('common.back')}
            </Button>
            <Button
              size="lg"
              fullWidth
              onClick={handleGoHome}
              aria-label={t('common.home')}
            >
              {t('common.home')}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <EmergencyProvider
      buildingId={routeData.buildingId}
      initialSnapshot={
        routeData.emergency
          ? {
              isEmergency: routeData.emergency.active,
              message: routeData.emergency.message,
              emergencyId: routeData.emergency.emergencyId,
              startedAt: null,
            }
          : null
      }
    >
    <div ref={rootRef}>
      <EmergencyLayer onShowExitRoute={requestEvacuation} />
      <PageShell width="wide">
        {/* Header — the only animated element; route content below renders
            instantly, nothing safety-critical waits on an animation. */}
        <div data-hero>
          <RouteHeader
            buildingName={routeData.buildingName}
            floorNumber={routeData.floorNumber}
          />
        </div>

        {/* Error Display */}
        {error && (
          <Alert tone="danger" className="mt-6">
            {error}
          </Alert>
        )}

        {/* THE map. One slot, every state: overview with you-are-here until a
            destination is picked (search box, tapped marker, or the emergency
            overlay), then the route view in the same place. */}
        <Card id="scan-map" className="mt-8 scroll-mt-24 p-5 sm:p-6">
          <WayfindingPanel
            buildingId={routeData.buildingId}
            originNodeId={routeData.nodeId}
            originFloorNumber={Number(routeData.floorNumber)}
            externalSelection={externalSelection}
            onRouteActive={setRouteActive}
            hideSearch
            idleContent={
              <div className="flex flex-col gap-4">
                {/* List ⇄ floor map toggle. Two peers, always visible, so the
                    visitor can leave the search view whenever they want. */}
                <div
                  role="radiogroup"
                  aria-label={t('route.idleViewLabel')}
                  className="inline-flex self-start rounded-full border border-line bg-surface-2 p-0.5"
                >
                  {(['list', 'map'] as const).map((view) => {
                    const active = idleView === view;
                    return (
                      <button
                        key={view}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setIdleView(view)}
                        className={
                          'inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ' +
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                          (active
                            ? 'bg-surface text-ink shadow-sm'
                            : 'text-ink-muted hover:text-ink')
                        }
                      >
                        {view === 'list' ? (
                          <SearchIcon size={15} aria-hidden />
                        ) : (
                          <MapIcon size={15} aria-hidden />
                        )}
                        {view === 'list' ? t('route.viewList') : t('route.viewMap')}
                      </button>
                    );
                  })}
                </div>

                {idleView === 'list' ? (
                  <DirectoryPanel
                    entries={directory}
                    loading={directoryLoading}
                    error={directoryError}
                    onPick={pushSelection}
                  />
                ) : (
                  <LocationOverviewMap
                    floor={floorRecord}
                    drawing={drawnPlan}
                    nodes={routeData.allFloorNodes}
                    currentNodeId={routeData.nodeId}
                    evacSegment={evacPreviewSegment}
                    onRouteTo={({ nodeId, name }) =>
                      pushSelection({ kind: 'poi', nodeId, name })
                    }
                  />
                )}
              </div>
            }
          />
        </Card>

        {/* Nearest exit, always one tap away. Hidden while a route is showing
            — the stepper already owns the screen then. */}
        {!routeActive &&
          (routeData.emergencyRoute.found ? (
            <Card className="mt-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface-2 text-success-text"
                  >
                    <ExitDoorIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-subtle">{t('route.nearestExit')}</p>
                    <p className="truncate font-semibold text-ink">
                      {routeData.emergencyRoute.exitNode?.label ||
                        t('route.emergencyExit')}
                      <span className="font-normal text-ink-muted">
                        {' · '}
                        {routeData.route?.totalDistanceMeters != null
                          ? t('wayfinding.distanceMeters', {
                              meters: routeData.route.totalDistanceMeters,
                            })
                          : t('route.steps', {
                              count: routeData.emergencyRoute.distance,
                            })}
                      </span>
                    </p>
                  </div>
                </div>
                <Button onClick={requestEvacuation}>
                  <RouteIcon size={16} />
                  {t('route.guideMe')}
                </Button>
              </div>
            </Card>
          ) : (
            <Alert tone="danger" className="mt-4" title={t('route.noExitTitle')}>
              <p className="text-sm">{t('route.noExitBody')}</p>
            </Alert>
          ))}

        {/* Safety block — only while an emergency is actually live. In a calm
            building, evacuation instructions and an "I evacuated" button are
            noise that teaches people to ignore the real thing. */}
        <EmergencyActions onEvacuated={handleEvacuated} />
      </PageShell>

      <AiLayer
        buildingId={routeData.buildingId}
        nodeId={routeData.nodeId}
        locale={lang}
      />
    </div>
    </EmergencyProvider>
  );
};

export default QRScanRoutePageFixed;
