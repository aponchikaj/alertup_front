import { useMemo, useState } from 'react';
import {
  DrawingLayer,
  isBoxShape,
  shapeCenter,
  EdgeLayer,
  FloorImageLayer,
  MapCanvas,
  NodeLayer,
  RouteLayer,
  UserDotLayer,
  useMapCamera,
  type FloorDrawing,
  type FloorRecord,
  type MapEdge,
  type MapNode,
  type NodeType,
  type RouteSegment,
} from '../../components/map';
import { Button } from '../../components/ui/button';
import { CloseIcon, RouteIcon } from '../../components/ui/icons';
import { useI18n } from '../../i18n/LanguageProvider';

/* ============================================================================
   LocationOverviewMap — "you are here", before any destination is chosen.
   ----------------------------------------------------------------------------
   Fills the scan page's single map slot until a route replaces it. Built on
   the shared renderer, so the floor looks identical here, in the route view
   and in the owner's editor — one visual language from editing to escaping.

   The evacuation path to the nearest exit is drawn from the start, quietly,
   in the danger tone. In a real emergency people follow the line they have
   already seen, not the one they have to ask for.

   Tapping any marker offers "Route here": the whole map is a destination
   picker, not a static picture.
   ========================================================================= */

/** Legacy scan-payload node (the printed-sticker contract vocabulary). */
export interface OverviewNode {
  id: string;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label: string;
  connections: string[];
}

/** Legacy wire type -> renderer vocabulary. */
const NODE_TYPE_FROM_LEGACY: Record<OverviewNode['type'], NodeType> = {
  path: 'NORMAL',
  exit: 'EMERGENCY_EXIT',
  stairs: 'TRANSIT',
};

/** The backend fabricates "path (120, 340)" for unlabeled nodes. That is a
 *  debugging string, not a place name — swap it for a human word. */
const FABRICATED_LABEL = /^(path|exit|stairs) \(-?\d+(\.\d+)?, -?\d+(\.\d+)?\)$/;

export interface LocationOverviewMapProps {
  floor: FloorRecord | null;
  drawing: FloorDrawing | null;
  nodes: OverviewNode[];
  /** The scanned node — where the visitor is standing. */
  currentNodeId: string;
  /** Evacuation leg on this floor, drawn as a quiet danger-tone preview. */
  evacSegment: RouteSegment | null;
  /** "Route here" on a tapped marker. */
  onRouteTo: (target: { nodeId: string; name: string }) => void;
}

export const LocationOverviewMap = ({
  floor,
  drawing,
  nodes,
  currentNodeId,
  evacSegment,
  onRouteTo,
}: LocationOverviewMapProps) => {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const space = useMemo(
    () => ({
      width: floor?.width && floor.width > 0 ? floor.width : 1000,
      height: floor?.height && floor.height > 0 ? floor.height : 800,
    }),
    [floor],
  );

  const { camera, svgRef, handlers, controls, isDragging } = useMapCamera({
    space,
    // Tapping empty floor just dismisses the callout.
    onTap: () => setSelectedId(null),
  });

  const mapNodes = useMemo<MapNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        type: NODE_TYPE_FROM_LEGACY[node.type] ?? 'NORMAL',
        label: node.label,
      })),
    [nodes],
  );

  const nodesById = useMemo(
    () => new Map<string, MapNode>(mapNodes.map((node) => [node.id, node])),
    [mapNodes],
  );

  // The legacy payload carries adjacency per node; fold it into undirected
  // edges so the walkable paths read as faint lines under the plan's shapes.
  const edges = useMemo<MapEdge[]>(() => {
    const out: MapEdge[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      for (const other of node.connections) {
        const key = node.id < other ? `${node.id}:${other}` : `${other}:${node.id}`;
        if (seen.has(key) || !nodesById.has(other)) continue;
        seen.add(key);
        out.push({
          id: key,
          sourceNodeId: node.id,
          targetNodeId: other,
          transitType: 'WALKWAY',
          accessible: true,
        });
      }
    }
    return out;
  }, [nodes, nodesById]);

  const current = nodesById.get(currentNodeId) ?? null;

  const displayName = (node: MapNode): string =>
    node.label && !FABRICATED_LABEL.test(node.label)
      ? node.label
      : node.type === 'EMERGENCY_EXIT'
        ? t('route.emergencyExit')
        : node.type === 'TRANSIT'
          ? t('mapEditor.typeTransit')
          : t('qr.nodePoint');

  const selected = selectedId ? (nodesById.get(selectedId) ?? null) : null;

  /**
   * The nearest named room/shop on the plan — "which door is this? the one
   * by Waikiki." Gives anonymous markers the context a visitor actually
   * navigates by.
   */
  const nearContext = useMemo(() => {
    if (!selected || !drawing) return null;
    let best: { name: string; d: number } | null = null;
    for (const shape of drawing.shapes) {
      if (!isBoxShape(shape) || !shape.name) continue;
      const centre = shapeCenter(shape);
      const d = Math.hypot(centre.x - selected.x, centre.y - selected.y);
      if (d <= 250 && (!best || d < best.d)) best = { name: shape.name, d };
    }
    if (!best) return null;
    // "Near Waikiki" under a marker already called Waikiki is noise.
    return best.name === displayName(selected) ? null : best.name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, drawing]);

  return (
    <div className="relative">
      <MapCanvas
        space={space}
        camera={camera}
        svgRef={svgRef}
        handlers={handlers}
        isDragging={isDragging}
        interactive
        ariaLabel={t('route.exitMapTitle')}
        className="h-[55dvh] min-h-72 sm:h-[52vh]"
      >
        <FloorImageLayer
          floor={floor}
          space={space}
          placeholderLabel={drawing ? null : t('route.noFloorMap')}
        />
        <DrawingLayer drawing={drawing} scale={camera.scale} />
        <EdgeLayer edges={edges} nodesById={nodesById} showAccessibility={false} />
        {/* The escape line is visible before anyone asks for it. Quiet, not
            alarming: no animation until the route view takes over. */}
        <RouteLayer segment={evacSegment} tone="danger" animated={false} strokeWidth={4} />
        <NodeLayer
          nodes={mapNodes}
          selectedId={selectedId}
          scale={camera.scale}
          onNodeClick={(node) =>
            setSelectedId((id) => (id === node.id ? null : node.id))
          }
        />
        <UserDotLayer
          position={current ? { x: current.x, y: current.y } : null}
          label={t('wayfinding.yourLocation')}
        />
      </MapCanvas>

      {/* Zoom cluster. Overlaid, not in a toolbar row: on a phone at arm's
          length the map needs every vertical pixel the card can give it. */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          onClick={controls.zoomIn}
          aria-label={t('mapEditor.zoomIn')}
          className="shadow-sm"
        >
          +
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={controls.zoomOut}
          aria-label={t('mapEditor.zoomOut')}
          className="shadow-sm"
        >
          −
        </Button>
      </div>

      {/* Marker callout — the map as destination picker. */}
      {selected && (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {displayName(selected)}
            </p>
            {selected.id === currentNodeId ? (
              <p className="text-xs text-ink-muted">{t('wayfinding.yourLocation')}</p>
            ) : nearContext ? (
              <p className="truncate text-xs text-ink-muted">
                {t('route.nearLabel', { name: nearContext })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-none items-center gap-1.5">
            {selected.id !== currentNodeId && (
              <Button
                size="sm"
                onClick={() => {
                  onRouteTo({ nodeId: selected.id, name: displayName(selected) });
                  setSelectedId(null);
                }}
              >
                <RouteIcon size={15} />
                {t('route.routeHere')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedId(null)}
              aria-label={t('common.cancel')}
            >
              <CloseIcon size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Legend chips: small, muted, and only the marks actually on this map. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-danger" />
          {t('route.legendYou')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
          {t('route.legendExit')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-info" />
          {t('route.legendTransit')}
        </span>
        {evacSegment && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-6 rounded-full bg-danger" />
            {t('route.legendRoute')}
          </span>
        )}
      </div>
    </div>
  );
};

export default LocationOverviewMap;
