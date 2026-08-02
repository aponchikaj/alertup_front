/* ============================================================================
   3D geometry math — pure, no three.js, fully unit-testable in jsdom.
   ----------------------------------------------------------------------------
   Everything here is coordinate arithmetic: how a 2D floor plan becomes
   extruded solids, where floors sit vertically, and how a pointer ray meets
   the ground plane. The three-dependent modules (meshFactory, picking) consume
   these numbers; they never invent geometry themselves, so the shapes the 3D
   view shows are testable without a GPU.

   Axis convention: map (x, y) → world (x, elevation, y). Y is up. A top-down
   3D view therefore matches the 2D map orientation exactly.
   ========================================================================= */

import { DEFAULT_PIXELS_PER_METER } from '../map/drawing';

/** Storey height: 3 m at the floor's scale (150 map units at the default). */
export const wallHeightFor = (scalePixelsPerMeter: number | null | undefined): number =>
  3 * (scalePixelsPerMeter && scalePixelsPerMeter > 0 ? scalePixelsPerMeter : DEFAULT_PIXELS_PER_METER);

/** Floor slab thickness (map units). */
export const SLAB_THICKNESS = 8;

/** Room/shop platform height above the slab (map units). */
export const PLATFORM_HEIGHT = 10;

/** Vertical distance between stacked floors = wallHeight * this. */
export const FLOOR_PITCH_RATIO = 1.5;

export interface FloorLevel {
  floorId: string;
  floorNumber: number;
  /** World Y of the slab's TOP surface. */
  elevation: number;
}

/**
 * Vertical layout of a set of floors, ordered and ranked by floorNumber.
 * Rank (not raw floorNumber) spaces the stack, so a building with floors
 * 1, 2, 5 renders as three evenly pitched slabs rather than leaving a
 * three-storey hole where 3 and 4 never existed.
 */
export function stackFloors(
  floors: Array<{ id: string; floorNumber: number; scalePixelsPerMeter?: number | null }>,
  wallHeight: number,
): FloorLevel[] {
  const pitch = wallHeight * FLOOR_PITCH_RATIO;
  return [...floors]
    .sort((a, b) => a.floorNumber - b.floorNumber)
    .map((floor, rank) => ({
      floorId: floor.id,
      floorNumber: floor.floorNumber,
      elevation: rank * pitch,
    }));
}

/* ----------------------------------------------------------------------------
   Walls: a polyline with thickness becomes one box per segment plus one
   cylinder per vertex — the 3D analog of SVG round caps and joins. Boxes are
   described by center/size/rotation so the mesh layer just places primitives.
--------------------------------------------------------------------------- */

export interface WallSegmentBox {
  centerX: number;
  centerY: number; // map-space y (world z)
  length: number;
  thickness: number;
  /** Rotation around the vertical axis, radians; 0 = along +x. */
  rotation: number;
}

export interface WallJoint {
  x: number;
  y: number;
  radius: number;
}

export interface WallSolid {
  segments: WallSegmentBox[];
  joints: WallJoint[];
}

/** Decompose a wall polyline (flat [x,y,...]) into boxes + joint cylinders. */
export function wallSolid(points: number[], thickness: number): WallSolid {
  const segments: WallSegmentBox[] = [];
  const joints: WallJoint[] = [];
  const radius = thickness / 2;
  for (let i = 0; i + 1 < points.length; i += 2) {
    joints.push({ x: points[i], y: points[i + 1], radius });
  }
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length <= 0) continue;
    segments.push({
      centerX: (x1 + x2) / 2,
      centerY: (y1 + y2) / 2,
      length,
      thickness,
      // Map y grows downward on screen but +z in world; the angle transfers
      // directly because both surfaces use the same handedness top-down.
      rotation: -Math.atan2(y2 - y1, x2 - x1),
    });
  }
  return { segments, joints };
}

/* ----------------------------------------------------------------------------
   Ray ↔ ground plane. The 3D projectPointer: cast the camera ray for a screen
   point and intersect it with the active floor's plane (world y = elevation).
   Pure math over ray origin/direction so it tests without three.js — the
   caller builds the ray from the camera however it likes.
--------------------------------------------------------------------------- */

export interface Ray3 {
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
}

/**
 * Intersect a world ray with the horizontal plane y = elevation and return
 * the MAP point (x, z→y). Returns null when the ray is parallel to the plane
 * or the hit lies behind the origin — the "no hit" contract callers expect.
 */
export function rayToMapPoint(ray: Ray3, elevation: number): { x: number; y: number } | null {
  const dy = ray.direction.y;
  if (Math.abs(dy) < 1e-9) return null;
  const t = (elevation - ray.origin.y) / dy;
  if (t < 0) return null;
  return {
    x: ray.origin.x + ray.direction.x * t,
    y: ray.origin.z + ray.direction.z * t,
  };
}

/* ----------------------------------------------------------------------------
   Camera fit framing — the 3D fitCamera. Position the camera on a
   three-quarter view (azimuth 0, ~55° down) so the whole floor/stack fits.
--------------------------------------------------------------------------- */

export interface FitFrame {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** Bounding-sphere radius — the rig derives min/max dolly from it. */
  radius: number;
}

const FIT_POLAR = (55 * Math.PI) / 180; // down-tilt from vertical
const FIT_MARGIN = 1.12;

/**
 * Frame a stack of floor spaces. `fovY` in radians, `aspect` = width/height.
 * Pure: the rig copies the result into the camera and controls target.
 */
export function fitToBounds(
  bounds: { width: number; height: number; minElevation: number; maxElevation: number },
  fovY: number,
  aspect: number,
): FitFrame {
  const spanY = bounds.maxElevation - bounds.minElevation;
  const target = {
    x: bounds.width / 2,
    y: bounds.minElevation + spanY / 2,
    z: bounds.height / 2,
  };
  const radius =
    (Math.hypot(bounds.width, bounds.height, spanY) / 2) * FIT_MARGIN;
  // Distance so the sphere fits the narrower of the two view angles.
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const halfFov = Math.min(fovY, fovX) / 2;
  const distance = radius / Math.sin(halfFov);
  return {
    position: {
      x: target.x,
      y: target.y + distance * Math.cos(FIT_POLAR),
      z: target.z + distance * Math.sin(FIT_POLAR),
    },
    target,
    radius,
  };
}

/** Dolly bounds relative to the fitted distance — mirrors 2D's 0.5..3 zoom. */
export const DOLLY_MIN_RATIO = 0.15;
export const DOLLY_MAX_RATIO = 3;
