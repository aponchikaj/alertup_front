/* ============================================================================
   Scene builder — 2D floor data in, plain-data 3D scene spec out.
   ----------------------------------------------------------------------------
   Pure and three-free: this module decides WHAT exists in the 3D scene
   (which solids, where, what color token) and meshFactory decides HOW to
   render it. Splitting there keeps the entire mapping from drawing/graph to
   3D representation unit-testable in jsdom.

   Colors are design-system TOKENS ('var(--ink)') or literal hex from shape
   fills; theme3d resolves both to concrete colors at render time, so the 3D
   view follows light/dark theme exactly like the SVG map does.
   ========================================================================= */

import {
  DRAWING_DEFAULTS,
  DRAWING_ICON_COLORS,
  NODE_THEME,
  ROUTE_TONES,
  CURRENT_LOCATION_COLOR,
  type RouteTone,
} from '../map/mapTheme';
import {
  GRID_STEP,
  GRID_MAJOR_EVERY,
  outlineOf,
  defaultOutlinePoints,
  type FloorDrawing,
  type IconKind,
} from '../map/drawing';
import type { MapNode, MapEdge, NodeType, TransitType, RouteSegment } from '../map/types';
import { wallHeightFor, wallSolid, SLAB_THICKNESS, PLATFORM_HEIGHT, type WallSolid } from './geometry3d';

/* ---------------------------------- spec ---------------------------------- */

export interface SlabSpec {
  /** Closed polygon, flat [x, y, ...] in map units. */
  points: number[];
  fillToken: string;
  rimToken: string;
}

export interface WallSpec {
  shapeId: string;
  solid: WallSolid;
  colorToken: string;
}

export interface PlatformSpec {
  shapeId: string;
  kind: 'room' | 'shop';
  x: number;
  y: number;
  width: number;
  height: number;
  fillToken: string;
  strokeToken: string;
  name: string | null;
}

export interface IconSpec {
  shapeId: string;
  x: number;
  y: number;
  icon: IconKind;
  size: number;
  rotation: number;
  glyphToken: string;
}

export interface TextSpec {
  shapeId: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  colorToken: string;
}

export interface LabelSpec {
  key: string;
  x: number;
  y: number;
  text: string;
  colorToken: string;
  /** World-height above the slab top the label floats at. */
  lift: number;
}

export interface NodeSpec {
  nodeId: string;
  x: number;
  y: number;
  type: NodeType;
  fillToken: string;
  glyph: string | null;
  label: string | null;
  selected: boolean;
  hovered: boolean;
}

export interface EdgeSpec {
  edgeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  transitType: TransitType;
  dashed: boolean;
  accessible: boolean;
  selected: boolean;
  colorToken: string;
}

export interface RouteSpec {
  points: Array<{ x: number; y: number }>;
  colorToken: string;
  animated: boolean;
}

export interface UserDotSpec {
  x: number;
  y: number;
  colorToken: string;
}

export interface GridSpec {
  width: number;
  height: number;
  step: number;
  majorEvery: number;
  minorToken: string;
  majorToken: string;
}

export interface FloorSpec {
  floorId: string;
  floorNumber: number;
  /** World Y of the slab top. */
  elevation: number;
  wallHeight: number;
  slabThickness: number;
  platformHeight: number;
  /** Ghosted floors render translucent and only their slab is pickable. */
  ghost: boolean;
  spaceWidth: number;
  spaceHeight: number;
  slab: SlabSpec;
  walls: WallSpec[];
  platforms: PlatformSpec[];
  icons: IconSpec[];
  texts: TextSpec[];
  labels: LabelSpec[];
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  routes: RouteSpec[];
  userDot: UserDotSpec | null;
  grid: GridSpec | null;
}

/** A vertical transit connector between two stacked floors. */
export interface ConnectorSpec {
  key: string;
  fromX: number;
  fromY: number;
  fromElevation: number;
  toX: number;
  toY: number;
  toElevation: number;
  direction: 'up' | 'down' | 'same';
  colorToken: string;
  /** The connector for the current transit step pulses/brightens. */
  active: boolean;
}

/** The whole 3D scene: one or more floors (stacked by elevation). */
export interface SceneSpec {
  floors: FloorSpec[];
  /** Vertical transit connectors between stacked floors (route views). */
  connectors?: ConnectorSpec[];
}

/* -------------------------------- builder --------------------------------- */

export interface BuildFloorSpecInput {
  floorId: string;
  floorNumber: number;
  elevation?: number;
  ghost?: boolean;
  spaceWidth: number;
  spaceHeight: number;
  scalePixelsPerMeter?: number | null;
  drawing: FloorDrawing | null;
  nodes?: MapNode[];
  edges?: MapEdge[];
  routeSegment?: RouteSegment | null;
  routeTone?: RouteTone;
  routeAnimated?: boolean;
  userDot?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  selectedEdgeId?: string | null;
  showGrid?: boolean;
}

const EDGE_COLOR_TOKEN = 'var(--ink-subtle)';

export function buildFloorSpec(input: BuildFloorSpecInput): FloorSpec {
  const {
    floorId,
    floorNumber,
    elevation = 0,
    ghost = false,
    spaceWidth,
    spaceHeight,
    scalePixelsPerMeter,
    drawing,
    nodes = [],
    edges = [],
    routeSegment = null,
    routeTone = 'brand',
    routeAnimated = true,
    userDot = null,
    selectedNodeId = null,
    hoveredNodeId = null,
    selectedEdgeId = null,
    showGrid = false,
  } = input;

  const wallHeight = wallHeightFor(scalePixelsPerMeter);

  const outline = outlineOf(drawing);
  const slab: SlabSpec = {
    points: outline?.points ?? defaultOutlinePoints({ width: spaceWidth, height: spaceHeight }),
    fillToken: 'var(--surface-2)',
    rimToken: 'var(--ink)',
  };

  const walls: WallSpec[] = [];
  const platforms: PlatformSpec[] = [];
  const icons: IconSpec[] = [];
  const texts: TextSpec[] = [];
  const labels: LabelSpec[] = [];

  for (const shape of drawing?.shapes ?? []) {
    switch (shape.kind) {
      case 'wall':
        walls.push({
          shapeId: shape.id,
          solid: wallSolid(shape.points, shape.thickness),
          colorToken: DRAWING_DEFAULTS.wallColor,
        });
        break;
      case 'room':
      case 'shop': {
        platforms.push({
          shapeId: shape.id,
          kind: shape.kind,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          fillToken:
            shape.fill ?? (shape.kind === 'shop' ? DRAWING_DEFAULTS.shopFill : DRAWING_DEFAULTS.roomFill),
          strokeToken:
            shape.stroke ?? (shape.kind === 'shop' ? DRAWING_DEFAULTS.shopStroke : DRAWING_DEFAULTS.roomStroke),
          name: shape.name ?? null,
        });
        if (shape.name) {
          labels.push({
            key: `label-${shape.id}`,
            x: shape.x + shape.width / 2,
            y: shape.y + shape.height / 2,
            text: shape.name,
            colorToken: 'var(--ink)',
            lift: PLATFORM_HEIGHT + 14,
          });
        }
        break;
      }
      case 'icon':
        icons.push({
          shapeId: shape.id,
          x: shape.x,
          y: shape.y,
          icon: shape.icon,
          size: shape.size,
          rotation: shape.rotation ?? 0,
          glyphToken: DRAWING_ICON_COLORS[shape.icon],
        });
        break;
      case 'text':
        texts.push({
          shapeId: shape.id,
          x: shape.x,
          y: shape.y,
          text: shape.text,
          fontSize: shape.fontSize,
          colorToken: 'var(--ink)',
        });
        break;
      case 'outline':
        break; // already consumed as the slab
      default: {
        const never: never = shape;
        void never;
      }
    }
  }

  const nodeSpecs: NodeSpec[] = nodes.map((node) => ({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    type: node.type,
    fillToken: NODE_THEME[node.type].fill,
    glyph: NODE_THEME[node.type].glyph ?? null,
    label: node.label,
    selected: node.id === selectedNodeId,
    hovered: node.id === hoveredNodeId,
  }));

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgeSpecs: EdgeSpec[] = [];
  for (const edge of edges) {
    const a = nodesById.get(edge.sourceNodeId);
    const b = nodesById.get(edge.targetNodeId);
    if (!a || !b) continue; // endpoint on another floor or deleted — skip, like EdgeLayer
    edgeSpecs.push({
      edgeId: edge.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      transitType: edge.transitType,
      dashed: edge.transitType !== 'WALKWAY',
      accessible: edge.accessible,
      selected: edge.id === selectedEdgeId,
      colorToken: edge.id === selectedEdgeId ? 'var(--brand)' : EDGE_COLOR_TOKEN,
    });
  }

  const routes: RouteSpec[] =
    routeSegment && routeSegment.nodes.length >= 2
      ? [
          {
            points: routeSegment.nodes.map((n) => ({ x: n.x, y: n.y })),
            colorToken: ROUTE_TONES[routeTone],
            animated: routeAnimated,
          },
        ]
      : [];

  return {
    floorId,
    floorNumber,
    elevation,
    wallHeight,
    slabThickness: SLAB_THICKNESS,
    platformHeight: PLATFORM_HEIGHT,
    ghost,
    spaceWidth,
    spaceHeight,
    slab,
    walls,
    platforms,
    icons,
    texts,
    labels,
    nodes: nodeSpecs,
    edges: edgeSpecs,
    routes,
    userDot: userDot ? { ...userDot, colorToken: CURRENT_LOCATION_COLOR } : null,
    grid: showGrid
      ? {
          width: spaceWidth,
          height: spaceHeight,
          step: GRID_STEP,
          majorEvery: GRID_MAJOR_EVERY,
          minorToken: 'var(--line)',
          majorToken: 'var(--line-strong)',
        }
      : null,
  };
}
