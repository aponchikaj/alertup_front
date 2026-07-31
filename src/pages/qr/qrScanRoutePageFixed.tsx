import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { get, ApiError } from '../../apis/http';
import { evacuatedFunc } from '../../apis/building';
import { usePageAnimations } from '../../lib/animations';
import { sanitizeSvg } from '../../lib/sanitizeSvg';
import { PageShell, PageHeader } from '../../components/ui/layout';
import { Card } from '../../components/ui/card';
import { Alert, Badge } from '../../components/ui/feedback';
import { Button } from '../../components/ui/button';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  MapPinIcon,
  SpinnerIcon,
} from '../../components/ui/icons';
import { EmergencyProvider } from '../../emergency/EmergencyProvider';
import { useEmergency } from '../../emergency/useEmergency';
import { EmergencyOverlay } from '../../components/emergency/EmergencyOverlay';
import { EmergencyBanner } from '../../components/emergency/EmergencyBanner';
import { WayfindingPanel } from '../../components/wayfinding/WayfindingPanel';
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
  const [selectedNode, setSelectedNode] = useState<FloorNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Map interaction state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fixed dimensions for uploaded images
  const mapDimensions = { width: 1000, height: 800 };

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

  // Handle node selection
  const handleNodeClick = useCallback((node: FloorNode) => {
    setSelectedNode(node.id === selectedNode?.id ? null : node);
  }, [selectedNode]);

  // Handle node hover
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNode(nodeId);
  }, []);

  // Wheel zoom is bound natively with { passive: false }. React registers wheel
  // listeners passively, so preventDefault() inside onWheel was ignored — the
  // page scrolled underneath the map and the console filled with warnings.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((current) => Math.min(Math.max(current * delta, 0.5), 3));
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  // Pointer events rather than mouse events, so panning works under a finger.
  // This page is reached by scanning a printed QR code, so it is opened on a
  // phone almost every time — with mouse-only handlers the escape route simply
  // could not be dragged into view.
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (activePointers.current.size === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    } else if (activePointers.current.size === 2) {
      // Second finger down starts a pinch; panning stops so the two gestures
      // do not fight each other.
      setIsDragging(false);
      const [a, b] = Array.from(activePointers.current.values());
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  }, [translateX, translateY, scale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(activePointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.distance > 0) {
        const next = pinchStart.current.scale * (distance / pinchStart.current.distance);
        setScale(Math.min(Math.max(next, 0.5), 3));
      }
      return;
    }

    if (!isDragging) return;
    setTranslateX(e.clientX - dragStart.x);
    setTranslateY(e.clientY - dragStart.y);
  }, [isDragging, dragStart]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchStart.current = null;
    if (activePointers.current.size === 0) setIsDragging(false);
  }, []);

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

  const scrollToExitRoute = () => {
    document
      .getElementById('emergency-route-map')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      <EmergencyLayer onShowExitRoute={scrollToExitRoute} />
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

        {/* Everyday wayfinding. Additive: the emergency map below is
            unchanged, and this panel only takes over once the visitor picks a
            destination. */}
        <Card className="mt-8 p-6">
          <WayfindingPanel
            buildingId={routeData.buildingId}
            originNodeId={routeData.nodeId}
            originFloorNumber={routeData.floorNumber}
          />
        </Card>

        {/* Main Grid Layout */}
        <div id="emergency-route-map" className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3">
          {/* Map Display */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-ink">
                  {t('route.exitMapTitle')}
                </h2>
                <p className="mt-1 text-base text-ink-muted">
                  {t('route.exitMapLead')}
                </p>
              </div>

              {/* Map Container */}
              <div
                ref={containerRef}
                className="relative overflow-hidden rounded-xl border border-line-strong bg-surface-2"
                // touchAction none so the browser hands us the gesture instead
                // of scrolling the page while the user drags the map.
                style={{ width: '100%', height: '500px', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {/* Combined SVG Layer - Map + Overlays */}
                <svg
                  className="absolute inset-0"
                  style={{
                    width: '100%',
                    height: '500px',
                    cursor: isDragging ? 'grabbing' : 'grab'
                  }}
                  viewBox={`0 0 ${mapDimensions.width} ${mapDimensions.height}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g
                    style={{
                      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      transformOrigin: 'center',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                  >
                  {/* Floor Map Background */}
                  {routeData.floorMap?.imageUrl ? (
                    <image
                      href={routeData.floorMap.imageUrl}
                      x="0"
                      y="0"
                      width={mapDimensions.width}
                      height={mapDimensions.height}
                      preserveAspectRatio="xMidYMid meet"
                      onError={() => {
                        console.log('❌ Failed to load image:', routeData.floorMap?.imageUrl);
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully:', routeData.floorMap?.imageUrl);
                      }}
                    />
                  ) : routeData.floorMap?.svgContent ? (
                    // Sanitized: this markup is uploaded by the building owner
                    // and rendered for every anonymous visitor who scans the QR
                    // code, so it cannot be trusted as-is.
                    <g
                      dangerouslySetInnerHTML={{ __html: sanitizeSvg(routeData.floorMap.svgContent) }}
                    />
                  ) : (
                    <g>
                      {/* Theme-aware background */}
                      <rect
                        x="0"
                        y="0"
                        width={mapDimensions.width}
                        height={mapDimensions.height}
                        fill="var(--surface-2)"
                      />
                      {/* Grid pattern for better visualization */}
                      <defs>
                        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--line)" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect
                        x="0"
                        y="0"
                        width={mapDimensions.width}
                        height={mapDimensions.height}
                        fill="url(#grid)"
                      />
                      {/* Center text */}
                      <text
                        x={mapDimensions.width / 2}
                        y={mapDimensions.height / 2 + 30}
                        textAnchor="middle"
                        fill="var(--ink-muted)"
                        fontSize="18"
                      >
                        {t('route.noFloorMap')}
                      </text>
                    </g>
                  )}

                  {/* Emergency Route Path.
                      Only the portion of the route on the floor being viewed
                      is drawn — a multi-floor route would otherwise render as
                      a meaningless line jumping between two floor plans. */}
                  {routeData.emergencyRoute.found && routeData.routeNodes?.length > 0 && (() => {
                    const currentFloor = Number(routeData.floorNumber);
                    const pathNodes = routeData.routeNodes.filter(
                      (node) => Number(node.floor) === currentFloor
                    );

                    if (pathNodes.length < 2) return null;

                    const pathData = pathNodes
                      .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${node.y}`)
                      .join(' ');

                    return (
                      <path
                        d={pathData}
                        stroke="var(--brand)"
                        strokeWidth="5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.9}
                      />
                    );
                  })()}

                  {/* Nodes Layer */}
                  {routeData.allFloorNodes.map((node) => {
                    const isCurrentNode = node.id === routeData.nodeId;
                    const isExitNode = node.id === routeData.emergencyRoute.exitNodeId;
                    const isPathNode = routeData.emergencyRoute.path.includes(node.id);
                    const isSelected = selectedNode?.id === node.id;
                    const isHovered = hoveredNode === node.id;

                    return (
                      <g key={node.id}>
                        {/* Node circle */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isSelected ? 30 : isHovered ? 25 :20}
                          fill={
                            isCurrentNode ? 'var(--danger)' : // red for current
                            isExitNode ? 'var(--success)' : // green for exit
                            isPathNode ? 'var(--warning)' : // amber for path
                            node.type === 'exit' ? 'var(--success)' :
                            node.type === 'stairs' ? 'var(--info)' :
                            'var(--ink-subtle)' // neutral for regular
                          }
                          stroke={isSelected ? 'var(--ink)' : 'transparent'}
                          strokeWidth={isSelected ? 2 : 0}
                          opacity={isPathNode ? 1 : 0.7}
                          className="cursor-pointer transition-all"
                          onClick={() => handleNodeClick(node)}
                          onMouseEnter={() => handleNodeHover(node.id)}
                          onMouseLeave={() => handleNodeHover(null)}
                        />

                        {/* Node label — halo keeps it readable over any map */}
                        <text
                          x={node.x}
                          y={node.y - 12}
                          textAnchor="middle"
                          fill="var(--ink)"
                          stroke="var(--canvas)"
                          strokeWidth={3}
                          paintOrder="stroke"
                          fontSize="14"
                          fontWeight={600}
                          className="pointer-events-none select-none"
                        >
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                  </g>
                </svg>
              </div>
            </Card>
          </div>

          {/* Route Information Sidebar */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            {/* Route Status Card */}
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-ink">
                {t('route.routeInfo')}
              </h2>

              {routeData.emergencyRoute.found ? (
                <div className="flex flex-col gap-4">
                  <Alert tone="success">
                    <p className="text-base font-semibold">{t('route.routeFound')}</p>
                  </Alert>

                  {/* A route that leaves this floor is the single most
                      important thing to communicate — the drawn line stops at
                      the stairs, so without this the map looks truncated. */}
                  {routeData.requiresFloorChange && routeData.floorTransitions?.length > 0 && (
                    <Alert tone="info" title={t('route.changesFloorsTitle')}>
                      {routeData.floorTransitions.map((transition, i) => (
                        <p key={i} className="text-base">
                          {t('route.changesFloorsStep', {
                            transit:
                              transition.nodeType === 'stairs'
                                ? t('wayfinding.transitStairs')
                                : t('route.transitConnection'),
                            from: transition.from,
                            to: transition.to,
                          })}
                        </p>
                      ))}
                      <p className="mt-1 text-sm">{t('route.changesFloorsNote')}</p>
                    </Alert>
                  )}

                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.distance')}</p>
                    <p className="text-xl font-semibold text-ink">
                      {t('route.steps', { count: routeData.emergencyRoute.distance })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.exitLocation')}</p>
                    <p className="text-xl font-semibold text-ink">
                      {routeData.emergencyRoute.exitNode?.label ||
                        t('route.emergencyExit')}
                    </p>
                    <p className="text-sm text-ink-subtle">
                      ({routeData.emergencyRoute.exitNode?.x}, {routeData.emergencyRoute.exitNode?.y})
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.yourLocation')}</p>
                    <p className="text-xl font-semibold text-ink">{routeData.nodeLabel}</p>
                    <p className="text-sm text-ink-subtle">
                      ({routeData.nodePosition.x}, {routeData.nodePosition.y})
                    </p>
                  </div>
                </div>
              ) : (
                <Alert tone="danger" title={t('route.noExitTitle')}>
                  <p className="text-sm">{t('route.noExitBody')}</p>
                </Alert>
              )}
            </Card>

            {/* Selected Node Information */}
            {selectedNode && (
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-ink">
                  {t('route.nodeDetails')}
                </h2>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.label')}</p>
                    <p className="font-medium text-ink">{selectedNode.label}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.type')}</p>
                    <p className="font-medium capitalize text-ink">{selectedNode.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.position')}</p>
                    <p className="font-medium text-ink">({selectedNode.x}, {selectedNode.y})</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">{t('route.connections')}</p>
                    <p className="font-medium text-ink">
                      {t('route.connectionCount', {
                        count: selectedNode.connections.length,
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => setSelectedNode(null)}
                  aria-label={t('route.clearSelection')}
                >
                  {t('route.clearSelection')}
                </Button>
              </Card>
            )}

            {/* Emergency Instructions Card */}
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

            {/* Building Details Card */}
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-ink">
                {t('route.buildingDetails')}
              </h2>

              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm text-ink-subtle">{t('route.building')}</p>
                  <p className="font-medium text-ink">{routeData.buildingName}</p>
                </div>

                <div>
                  <p className="text-sm text-ink-subtle">{t('route.floor')}</p>
                  <p className="font-medium text-ink">
                    {t('wayfinding.floor', { number: routeData.floorNumber })}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-ink-subtle">{t('route.lastUpdated')}</p>
                  <p className="text-sm font-medium text-ink-muted">
                    {new Date(routeData.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
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
                onClick={handleEvacuated}
                aria-label={t('route.evacuated')}
              >
                <CheckCircleIcon size={18} />
                {t('route.evacuated')}
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <Card className="mt-8 p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">
            {t('route.legendTitle')}
          </h2>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-danger" />
              {t('route.legendYou')}
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-success" />
              {t('route.legendExit')}
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-info" />
              {t('route.legendTransit')}
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-warning" />
              {t('route.legendPath')}
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1 w-8 rounded-full bg-brand" />
              {t('route.legendRoute')}
            </div>
          </div>
        </Card>
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
