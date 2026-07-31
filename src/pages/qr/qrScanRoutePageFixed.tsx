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
  SpinnerIcon,
} from '../../components/ui/icons';

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
}

const QRScanRoutePageFixed: React.FC = () => {
  const { qrId } = useParams<{ qrId: string }>();
  const rootRef = usePageAnimations();

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
        setError(response.message || 'Failed to load route data');
      }
    } catch (err: unknown) {
      console.error('Error fetching route data:', err);

      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('QR code not found. Please scan a valid emergency QR code.');
        } else if (err.status === 400) {
          setError('Invalid QR code format.');
        } else {
          setError(err.message || 'Failed to load route data');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load route data');
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
      setError('Could not record your evacuation — building is unknown.');
      return;
    }

    try {
      const res = await evacuatedFunc(routeData.buildingId)
      if (!res || res.Success === false) {
        setError(res?.Message || "Couldn't record your evacuation. Please try again.");
        return;
      }
    } catch {
      setError("Couldn't record your evacuation. Please try again.");
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
        <PageHeader title="Loading Route" />
        <div
          role="status"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-4 pt-8"
        >
          <SpinnerIcon size={48} className="text-brand-text" />
          <p className="text-lg font-medium text-ink-muted">Loading emergency route...</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell width="wide">
        <PageHeader title="Error" />
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
              aria-label="Go back to previous page"
            >
              <ArrowLeftIcon size={18} />
              Back
            </Button>
            <Button
              size="lg"
              fullWidth
              onClick={handleGoHome}
              aria-label="Go to home page"
            >
              Home
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!routeData) {
    return (
      <PageShell width="wide">
        <PageHeader title="Route Not Found" />
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pt-10">
          <Alert tone="danger">
            <p className="text-base">No route data found for QR code: {qrId}</p>
          </Alert>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleGoBack}
              aria-label="Go back to previous page"
            >
              <ArrowLeftIcon size={18} />
              Back
            </Button>
            <Button
              size="lg"
              fullWidth
              onClick={handleGoHome}
              aria-label="Go to home page"
            >
              Home
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        {/* Header — the only animated element; route content below renders
            instantly, nothing safety-critical waits on an animation. */}
        <div data-hero>
          <PageHeader
            title="Emergency Route"
            description={`${routeData.buildingName} • Floor ${routeData.floorNumber} • Scanned ${routeData.scanCount} times`}
            actions={
              <Badge tone="danger" className="px-3 py-1.5 text-sm">
                <AlertTriangleIcon size={16} />
                Emergency Exit Route
              </Badge>
            }
          />
        </div>

        {/* Error Display */}
        {error && (
          <Alert tone="danger" className="mt-6">
            {error}
          </Alert>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3">
          {/* Map Display */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-ink">
                  Emergency Route Map
                </h2>
                <p className="mt-1 text-base text-ink-muted">
                  Follow the orange path to the nearest emergency exit
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
                        No Floor Map Available
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
              <h2 className="mb-4 text-lg font-semibold text-ink">Route Information</h2>

              {routeData.emergencyRoute.found ? (
                <div className="flex flex-col gap-4">
                  <Alert tone="success">
                    <p className="text-base font-semibold">Route to exit found</p>
                  </Alert>

                  {/* A route that leaves this floor is the single most
                      important thing to communicate — the drawn line stops at
                      the stairs, so without this the map looks truncated. */}
                  {routeData.requiresFloorChange && routeData.floorTransitions?.length > 0 && (
                    <Alert tone="info" title="This route changes floors">
                      {routeData.floorTransitions.map((t, i) => (
                        <p key={i} className="text-base">
                          Take the {t.nodeType === 'stairs' ? 'stairs' : 'connection'} from floor {t.from} to floor {t.to}
                        </p>
                      ))}
                      <p className="mt-1 text-sm">
                        The orange path shows your current floor only.
                      </p>
                    </Alert>
                  )}

                  <div>
                    <p className="text-sm text-ink-subtle">Distance</p>
                    <p className="text-xl font-semibold text-ink">{routeData.emergencyRoute.distance} steps</p>
                  </div>

                  <div>
                    <p className="text-sm text-ink-subtle">Exit Location</p>
                    <p className="text-xl font-semibold text-ink">
                      {routeData.emergencyRoute.exitNode?.label || 'Emergency Exit'}
                    </p>
                    <p className="text-sm text-ink-subtle">
                      ({routeData.emergencyRoute.exitNode?.x}, {routeData.emergencyRoute.exitNode?.y})
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-ink-subtle">Your Location</p>
                    <p className="text-xl font-semibold text-ink">{routeData.nodeLabel}</p>
                    <p className="text-sm text-ink-subtle">
                      ({routeData.nodePosition.x}, {routeData.nodePosition.y})
                    </p>
                  </div>
                </div>
              ) : (
                <Alert tone="danger" title="No exit route found">
                  <p className="text-sm">
                    Please check with building staff for emergency instructions.
                  </p>
                </Alert>
              )}
            </Card>

            {/* Selected Node Information */}
            {selectedNode && (
              <Card className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-ink">Node Details</h2>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm text-ink-subtle">Label</p>
                    <p className="font-medium text-ink">{selectedNode.label}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">Type</p>
                    <p className="font-medium capitalize text-ink">{selectedNode.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">Position</p>
                    <p className="font-medium text-ink">({selectedNode.x}, {selectedNode.y})</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-subtle">Connections</p>
                    <p className="font-medium text-ink">{selectedNode.connections.length} nodes</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => setSelectedNode(null)}
                  aria-label="Clear selected node"
                >
                  Clear selection
                </Button>
              </Card>
            )}

            {/* Emergency Instructions Card */}
            <Alert tone="danger" title="Emergency Instructions">
              <p className="text-sm">
                Follow the highlighted route to the nearest emergency exit.
              </p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem] font-medium">
                <li>Stay calm and move quickly</li>
                <li>Follow the orange path on the map</li>
                <li>Do not use elevators during fire</li>
                <li>Help others if you can do so safely</li>
                <li>Call emergency services if needed</li>
              </ul>
            </Alert>

            {/* Building Details Card */}
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-ink">Building Details</h2>

              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm text-ink-subtle">Building</p>
                  <p className="font-medium text-ink">{routeData.buildingName}</p>
                </div>

                <div>
                  <p className="text-sm text-ink-subtle">Floor</p>
                  <p className="font-medium text-ink">Floor {routeData.floorNumber}</p>
                </div>

                <div>
                  <p className="text-sm text-ink-subtle">Last Updated</p>
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
                aria-label="Go back to previous page"
              >
                <ArrowLeftIcon size={18} />
                Back
              </Button>
              <Button
                size="lg"
                fullWidth
                onClick={handleEvacuated}
                aria-label="Go to home page"
              >
                <CheckCircleIcon size={18} />
                Evacuated
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <Card className="mt-8 p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Node Types</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-danger" />
              Your Location
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-success" />
              Emergency Exit
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-info" />
              Stairs/Elevator
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-warning" />
              Path Point
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1 w-8 rounded-full bg-brand" />
              Emergency Route
            </div>
          </div>
        </Card>
      </PageShell>
    </div>
  );
};

export default QRScanRoutePageFixed;
