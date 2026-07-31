/* ============================================================================
   Hand-drawn floor plans — domain types and pure geometry.
   ----------------------------------------------------------------------------
   A floor's plan is authored in the map editor instead of being uploaded as an
   image: the user types the room's real size, gets a blank canvas at that
   scale, and draws walls, rooms and shops on it.

   Two rules hold this together:

   1. Shapes are *presentation*. Routing runs on the Node/Edge graph, exactly as
      before. A drawn lift is a picture; the TRANSIT node the editor creates
      alongside it is what Dijkstra walks. `nodeId` is the link between the two,
      and it is deliberately a weak reference — a shape whose node was deleted
      still draws, it just stops being routable.

   2. Everything here is in **map units** (the floor's viewBox), the same space
      MapNode.x/y live in. No screen-space math, ever — see mapSpace.ts.

   Mirrors alertup_backend/src/features/mapEditor/drawingSchema.js. That module
   is the authority: it re-validates every field on save, so a shape shape-change
   is a breaking change on both sides.
   ========================================================================= */

/** Wire format version, so an old drawing can be migrated rather than guessed at. */
export const DRAWING_VERSION = 1;

/** Corner of a box being dragged, named by which edges it moves. */
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

/** Stamped markers. Kept in sync with the backend ICON_KINDS. */
export const ICON_KINDS = [
  'ELEVATOR',
  'ESCALATOR',
  'STAIRS',
  'DOOR',
  'ENTRANCE',
  'EXIT',
  'WC',
  'INFO',
] as const;

export type IconKind = (typeof ICON_KINDS)[number];

/**
 * Icons that mean "you can change floor here". Stamping one of these also
 * creates a TRANSIT node, because a lift the router cannot see is worse than
 * no lift at all — it looks walkable and routes people into a dead end.
 */
export const TRANSIT_ICONS: readonly IconKind[] = ['ELEVATOR', 'ESCALATOR', 'STAIRS'];

/**
 * The routing node each marker stands for.
 *
 * Every marker maps to something — a stamped point is a real place in the
 * building, so it gets a node (and therefore a QR code) rather than being
 * decoration. Doors are plain path points; toilets and info desks are
 * destinations people search for, so they are POIs.
 */
export const ICON_NODE_TYPE: Record<
  IconKind,
  'TRANSIT' | 'ENTRANCE' | 'EMERGENCY_EXIT' | 'POI' | 'NORMAL'
> = {
  ELEVATOR: 'TRANSIT',
  ESCALATOR: 'TRANSIT',
  STAIRS: 'TRANSIT',
  ENTRANCE: 'ENTRANCE',
  EXIT: 'EMERGENCY_EXIT',
  WC: 'POI',
  INFO: 'POI',
  DOOR: 'NORMAL',
};

interface ShapeBase {
  id: string;
}

/** A run of connected wall segments. `points` is flat [x, y, x, y, ...]. */
export interface WallShape extends ShapeBase {
  kind: 'wall';
  points: number[];
  thickness: number;
}

/** An axis-aligned box: a room, corridor or any unbranded area. */
export interface RoomShape extends ShapeBase {
  kind: 'room';
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  fill?: string;
  stroke?: string;
}

/** A room that is a tenant: carries a name, brand colour and logo. */
export interface ShopShape extends ShapeBase {
  kind: 'shop';
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  fill?: string;
  stroke?: string;
  logoUrl?: string;
  /** POI node this shop routes to, when one has been created. */
  nodeId?: string;
}

/** A stamped marker (lift, stairs, WC, ...). */
export interface IconShape extends ShapeBase {
  kind: 'icon';
  x: number;
  y: number;
  icon: IconKind;
  size: number;
  rotation?: number;
  label?: string;
  /** Routing node this marker stands for, when one has been created. */
  nodeId?: string;
}

/** A free-floating text label. */
export interface TextShape extends ShapeBase {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type DrawingShape = WallShape | RoomShape | ShopShape | IconShape | TextShape;

export type ShapeKind = DrawingShape['kind'];

/** Shapes that are axis-aligned boxes — the ones move/resize handles apply to. */
export type BoxShape = RoomShape | ShopShape;

export interface FloorDrawing {
  version: number;
  shapes: DrawingShape[];
}

export const EMPTY_DRAWING: FloorDrawing = { version: DRAWING_VERSION, shapes: [] };

/* --- scale --------------------------------------------------------------- */

/**
 * Map units per metre for a newly drawn floor.
 *
 * Picked so a typical room lands in the same ballpark as the 1000x800 space
 * uploaded plans are normalized to: a 20m x 16m room becomes exactly 1000x800.
 * Storing it as `scalePixelsPerMeter` is what lets the router report real
 * distances in metres for drawn floors, with no extra calibration step.
 */
export const DEFAULT_PIXELS_PER_METER = 50;

/**
 * Grid spacing in map units — 0.5 m at the default scale.
 *
 * This is deliberately ONE number: the grid the canvas paints and the step
 * every drawing gesture snaps to are the same value, so a snapped point always
 * lands on a line the user can actually see. A snap finer than the grid looks
 * like the drawing is ignoring it; a snap coarser than the grid looks like the
 * lines are decorative.
 */
export const GRID_STEP = 25;

/** Every Nth grid line is drawn heavier, to keep the field readable. */
export const GRID_MAJOR_EVERY = 4;

/** Guard rails for the "how big is this room?" form, in metres. */
export const MIN_ROOM_METERS = 2;
export const MAX_ROOM_METERS = 400;

/** Canvas size in map units for a room of the given metre dimensions. */
export const canvasSizeForMeters = (
  widthMeters: number,
  heightMeters: number,
  pixelsPerMeter: number = DEFAULT_PIXELS_PER_METER,
): { width: number; height: number } => ({
  width: Math.round(widthMeters * pixelsPerMeter),
  height: Math.round(heightMeters * pixelsPerMeter),
});

/* --- geometry ------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Build a rect from two corners in any order.
 *
 * Dragging up-and-left is as ordinary as dragging down-and-right, and a
 * negative width silently renders nothing in SVG — so this normalizes rather
 * than trusting the drag direction.
 */
export const rectFromPoints = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(b.x - a.x),
  height: Math.abs(b.y - a.y),
});

/** Snap a value to the nearest step. `step <= 0` disables snapping. */
export const snap = (value: number, step: number): number =>
  step > 0 ? Math.round(value / step) * step : value;

export const snapPoint = <T extends { x: number; y: number }>(
  point: T,
  step: number,
): { x: number; y: number } => ({
  x: snap(point.x, step),
  y: snap(point.y, step),
});

/** Clamp a point into the floor's space, so nothing is drawn off-canvas. */
export const clampToSpace = (
  point: { x: number; y: number },
  space: { width: number; height: number },
): { x: number; y: number } => ({
  x: Math.min(Math.max(point.x, 0), space.width),
  y: Math.min(Math.max(point.y, 0), space.height),
});

export const isBoxShape = (shape: DrawingShape): shape is BoxShape =>
  shape.kind === 'room' || shape.kind === 'shop';

/** Centre of a shape — where its auto-created node is anchored. */
export const shapeCenter = (shape: DrawingShape): { x: number; y: number } => {
  if (isBoxShape(shape)) {
    return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  }
  if (shape.kind === 'wall') {
    const { points } = shape;
    let sx = 0;
    let sy = 0;
    const count = Math.floor(points.length / 2);
    for (let i = 0; i < count; i += 1) {
      sx += points[i * 2];
      sy += points[i * 2 + 1];
    }
    return count > 0 ? { x: sx / count, y: sy / count } : { x: 0, y: 0 };
  }
  return { x: shape.x, y: shape.y };
};

/** Axis-aligned bounds, used for hit-testing and the selection outline. */
export const shapeBounds = (shape: DrawingShape): Rect => {
  if (isBoxShape(shape)) {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }

  if (shape.kind === 'wall') {
    const { points, thickness } = shape;
    if (points.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
    }
    // Grow by the stroke so a horizontal wall (zero height) is still hittable.
    const pad = thickness / 2;
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + thickness,
      height: maxY - minY + thickness,
    };
  }

  if (shape.kind === 'icon') {
    const half = shape.size / 2;
    return { x: shape.x - half, y: shape.y - half, width: shape.size, height: shape.size };
  }

  // Text is anchored at its baseline start; approximate a box around it.
  const width = shape.text.length * shape.fontSize * 0.6;
  return {
    x: shape.x,
    y: shape.y - shape.fontSize,
    width,
    height: shape.fontSize * 1.3,
  };
};

export const rectContains = (rect: Rect, point: { x: number; y: number }): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

/** Shortest distance from a point to a line segment. */
export const pointSegmentDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  // Degenerate segment: both endpoints coincide.
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  // Project onto the segment, clamped to its ends.
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/**
 * Topmost shape within `slop` map units of the point.
 *
 * The eraser's hit test. Unlike `hitTest` (exact bounds, used for precise
 * selection), this inflates every shape's bounds: the wall someone wants gone
 * is often 6 units wide, and demanding a dead-centre click on it makes the
 * eraser feel broken.
 */
export const eraseHitTest = (
  shapes: DrawingShape[],
  point: { x: number; y: number },
  slop: number,
): DrawingShape | null => {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const bounds = shapeBounds(shapes[i]);
    const inflated: Rect = {
      x: bounds.x - slop,
      y: bounds.y - slop,
      width: bounds.width + slop * 2,
      height: bounds.height + slop * 2,
    };
    if (rectContains(inflated, point)) return shapes[i];
  }
  return null;
};

/**
 * Topmost shape under a point.
 *
 * Iterates back to front because later shapes paint over earlier ones — the
 * one the user sees on top is the one they mean to grab.
 */
export const hitTest = (
  shapes: DrawingShape[],
  point: { x: number; y: number },
): DrawingShape | null => {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (rectContains(shapeBounds(shapes[i]), point)) return shapes[i];
  }
  return null;
};

/** Move a shape by a delta, whatever its kind. */
export const translateShape = <T extends DrawingShape>(shape: T, dx: number, dy: number): T => {
  if (shape.kind === 'wall') {
    return {
      ...shape,
      points: shape.points.map((value, i) => (i % 2 === 0 ? value + dx : value + dy)),
    };
  }
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
};

/* --- ids ----------------------------------------------------------------- */

let idCounter = 0;

/**
 * Client-side shape id. These never index a database row — they only have to
 * be unique within one drawing, so a counter plus a random suffix is enough
 * and avoids depending on crypto.randomUUID in older browsers.
 */
export const newShapeId = (): string => {
  idCounter += 1;
  return `s${idCounter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

/* --- parsing ------------------------------------------------------------- */

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Same URL rules as the server validator: http(s) or site-absolute only.
 * Enforced client-side too because drawings also arrive over the collab
 * socket, relayed peer-to-peer without a REST round trip — and this string
 * ends up in an <image href>.
 */
const safeImageUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  if (value.startsWith('//')) return undefined;
  if (value.startsWith('/')) return value;
  return /^https?:\/\//i.test(value) ? value : undefined;
};

/**
 * Coerce an unknown `Floor.drawing` into a usable drawing.
 *
 * The server already normalized what it stored, but this runs against rows
 * written by older builds too — so it drops anything it cannot render rather
 * than trusting the column.
 */
export const parseDrawing = (raw: unknown): FloorDrawing => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_DRAWING;

  const source = raw as { version?: unknown; shapes?: unknown };
  const rawShapes = Array.isArray(source.shapes) ? source.shapes : [];
  const shapes: DrawingShape[] = [];

  for (const entry of rawShapes) {
    if (!entry || typeof entry !== 'object') continue;
    const shape = entry as Record<string, unknown>;
    const id = typeof shape.id === 'string' && shape.id ? shape.id : newShapeId();

    switch (shape.kind) {
      case 'wall': {
        const points = Array.isArray(shape.points)
          ? shape.points.filter(isFiniteNumber)
          : [];
        if (points.length < 4) continue;
        // An odd tail would pair an x with the next shape's nothing.
        if (points.length % 2 !== 0) points.pop();
        shapes.push({
          id,
          kind: 'wall',
          points,
          thickness: isFiniteNumber(shape.thickness) ? shape.thickness : 4,
        });
        break;
      }

      case 'room':
      case 'shop': {
        if (
          !isFiniteNumber(shape.x) ||
          !isFiniteNumber(shape.y) ||
          !isFiniteNumber(shape.width) ||
          !isFiniteNumber(shape.height) ||
          shape.width <= 0 ||
          shape.height <= 0
        ) {
          continue;
        }
        const box = {
          id,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          ...(typeof shape.name === 'string' ? { name: shape.name } : {}),
          ...(typeof shape.fill === 'string' ? { fill: shape.fill } : {}),
          ...(typeof shape.stroke === 'string' ? { stroke: shape.stroke } : {}),
        };
        shapes.push(
          shape.kind === 'shop'
            ? {
                ...box,
                kind: 'shop',
                ...(safeImageUrl(shape.logoUrl) ? { logoUrl: safeImageUrl(shape.logoUrl) } : {}),
                ...(typeof shape.nodeId === 'string' ? { nodeId: shape.nodeId } : {}),
              }
            : { ...box, kind: 'room' },
        );
        break;
      }

      case 'icon': {
        if (!isFiniteNumber(shape.x) || !isFiniteNumber(shape.y)) continue;
        if (!ICON_KINDS.includes(shape.icon as IconKind)) continue;
        shapes.push({
          id,
          kind: 'icon',
          x: shape.x,
          y: shape.y,
          icon: shape.icon as IconKind,
          size: isFiniteNumber(shape.size) && shape.size > 0 ? shape.size : 28,
          ...(isFiniteNumber(shape.rotation) ? { rotation: shape.rotation } : {}),
          ...(typeof shape.label === 'string' ? { label: shape.label } : {}),
          ...(typeof shape.nodeId === 'string' ? { nodeId: shape.nodeId } : {}),
        });
        break;
      }

      case 'text': {
        if (!isFiniteNumber(shape.x) || !isFiniteNumber(shape.y)) continue;
        if (typeof shape.text !== 'string' || !shape.text) continue;
        shapes.push({
          id,
          kind: 'text',
          x: shape.x,
          y: shape.y,
          text: shape.text,
          fontSize: isFiniteNumber(shape.fontSize) && shape.fontSize > 0 ? shape.fontSize : 16,
        });
        break;
      }

      default:
        // Unknown kind from a newer build — skip rather than render nothing.
        break;
    }
  }

  return {
    version: isFiniteNumber(source.version) ? source.version : DRAWING_VERSION,
    shapes,
  };
};

/** True when a floor has nothing drawn on it yet. */
export const isDrawingEmpty = (drawing: FloorDrawing | null | undefined): boolean =>
  !drawing || drawing.shapes.length === 0;
