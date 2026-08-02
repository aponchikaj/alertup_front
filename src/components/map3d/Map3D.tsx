import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '../../lib/cn';
import type { MapPoint } from '../map/mapSpace';
import type { MapPointerTarget, MapSurfaceApi } from '../map/interaction';
import type { FloorDrawing } from '../map/drawing';
import type { MapNode, MapEdge, RouteSegment } from '../map/types';
import type { RouteTone } from '../map/mapTheme';
import { buildFloorSpec, type SceneSpec } from './sceneBuilder';
import { MapScene } from './mapScene';
import type { PickTag } from './picking';

/* ============================================================================
   Map3D — the React face of the 3D map surface.
   ----------------------------------------------------------------------------
   Same data in, same callbacks out as the SVG MapCanvas composition — only
   the rendering is different. The imperative MapScene lives for the lifetime
   of the component; props changes rebuild the scene spec (cheap, pure) and
   hand it over. Exposes MapSurfaceApi via ref so page-level code can project
   pointers and drive the camera without knowing which renderer is live.

   This file (and everything under map3d/) is reached only through dynamic
   import — the three.js chunk never loads for 2D-only sessions.
   ========================================================================= */

export interface Map3DFloorInput {
  id: string;
  floorNumber: number;
  width: number | null;
  height: number | null;
  scalePixelsPerMeter: number | null;
}

export interface Map3DProps {
  floor: Map3DFloorInput | null;
  drawing: FloorDrawing | null;
  nodes?: MapNode[];
  edges?: MapEdge[];
  routeSegment?: RouteSegment | null;
  routeTone?: RouteTone;
  userDot?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
  showGrid?: boolean;
  mode?: 'viewer' | 'editor';
  onMapTap?: (point: MapPoint) => void;
  onNodeClick?: (node: MapNode) => void;
  onEdgeClick?: (edge: MapEdge) => void;
  /** WebGL refused/lost — the consumer must fall back to the 2D surface. */
  onUnavailable?: () => void;
  className?: string;
  ariaLabel?: string;
}

/** Movement below this (screen px) still counts as a tap, matching 2D. */
const TAP_SLOP_PX = 6;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Map3D = forwardRef<MapSurfaceApi, Map3DProps>(function Map3D(
  {
    floor,
    drawing,
    nodes = [],
    edges = [],
    routeSegment = null,
    routeTone = 'brand',
    userDot = null,
    selectedNodeId = null,
    showGrid = false,
    mode = 'viewer',
    onMapTap,
    onNodeClick,
    onEdgeClick,
    onUnavailable,
    className,
    ariaLabel,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const fittedRef = useRef(false);
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  // Latest props for stable pointer handlers.
  const dataRef = useRef({ drawing, nodes, edges, onMapTap, onNodeClick, onEdgeClick });
  dataRef.current = { drawing, nodes, edges, onMapTap, onNodeClick, onEdgeClick };

  const spec = useMemo<SceneSpec>(() => {
    if (!floor) return { floors: [] };
    return {
      floors: [
        buildFloorSpec({
          floorId: floor.id,
          floorNumber: floor.floorNumber,
          spaceWidth: floor.width && floor.width > 0 ? floor.width : 1000,
          spaceHeight: floor.height && floor.height > 0 ? floor.height : 800,
          scalePixelsPerMeter: floor.scalePixelsPerMeter,
          drawing,
          nodes,
          edges,
          routeSegment,
          routeTone,
          routeAnimated: !prefersReducedMotion(),
          userDot,
          selectedNodeId,
          showGrid,
        }),
      ],
    };
  }, [floor, drawing, nodes, edges, routeSegment, routeTone, userDot, selectedNodeId, showGrid]);

  // One MapScene per mount (mode is fixed per surface instance).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const scene = new MapScene(container, {
      mode,
      onUnavailable,
      animationsEnabled: !prefersReducedMotion(),
    });
    sceneRef.current = scene;
    fittedRef.current = false;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Spec changes flow into the live scene; first spec also frames the camera.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setSpec(spec);
    if (!fittedRef.current && spec.floors.length > 0) {
      fittedRef.current = true;
      scene.refit();
    }
  }, [spec]);

  const resolveTarget = (tag: PickTag | null): MapPointerTarget | null => {
    if (!tag) return null;
    const { drawing: currentDrawing, nodes: currentNodes } = dataRef.current;
    switch (tag.kind) {
      case 'canvas':
        return { kind: 'canvas' };
      case 'node': {
        const node = currentNodes.find((n) => n.id === tag.nodeId);
        return node ? { kind: 'node', node } : { kind: 'canvas' };
      }
      case 'edge':
        return tag.edgeId ? { kind: 'edge', edgeId: tag.edgeId } : { kind: 'canvas' };
      case 'shape': {
        const shape = currentDrawing?.shapes.find((s) => s.id === tag.shapeId);
        return shape ? { kind: 'shape', shape } : { kind: 'canvas' };
      }
      default:
        return { kind: 'canvas' };
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pressRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLOP_PX) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const target = resolveTarget(scene.pick(e.clientX, e.clientY));
    const { onMapTap: tap, onNodeClick: nodeClick, onEdgeClick: edgeClick } = dataRef.current;
    if (target?.kind === 'node' && nodeClick) {
      nodeClick(target.node);
      return;
    }
    if (target?.kind === 'edge' && edgeClick) {
      const edge = dataRef.current.edges.find((candidate) => candidate.id === target.edgeId);
      if (edge) {
        edgeClick(edge);
        return;
      }
    }
    if (tap) {
      const point = scene.projectPointer(e.clientX, e.clientY);
      if (point) tap(point);
    }
  };

  useImperativeHandle(
    ref,
    (): MapSurfaceApi => ({
      projectPointer: (clientX, clientY) => sceneRef.current?.projectPointer(clientX, clientY) ?? null,
      pick: (clientX, clientY) => resolveTarget(sceneRef.current?.pick(clientX, clientY) ?? null),
      controls: {
        zoomIn: () => sceneRef.current?.controls.zoomIn(),
        zoomOut: () => sceneRef.current?.controls.zoomOut(),
        reset: () => sceneRef.current?.controls.reset(),
        centerOn: (point) => sceneRef.current?.controls.centerOn(point),
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      data-testid="map3d"
      className={cn('relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface-2', className)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pressRef.current = null;
      }}
    />
  );
});

export default Map3D;
