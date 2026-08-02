/* ============================================================================
   Picking — raycast hits back to renderer-agnostic pointer targets.
   ----------------------------------------------------------------------------
   Meshes carry a small `userData.pick` tag ({kind, ...ids}); this module
   turns the topmost raycast hit into that tag. Resolving ids into full
   domain objects (DrawingShape, MapNode) happens in Map3D, which owns the
   props data — geometry never holds references to domain objects, so specs
   stay serializable and rebuilds stay cheap.
   ========================================================================= */

import type * as THREE from 'three';

export interface PickTag {
  kind:
    | 'canvas'
    | 'shape'
    | 'node'
    | 'edge'
    | 'poi'
    | 'resize-handle'
    | 'wall-vertex'
    | 'outline-vertex'
    | 'outline-midpoint'
    | 'canvas-border';
  shapeId?: string;
  nodeId?: string;
  edgeId?: string;
  poiId?: string;
  floorId?: string;
  handle?: string;
  vertexIndex?: number;
  afterVertexIndex?: number;
  axis?: 'x' | 'y' | 'xy';
}

/** Priority when several hits are equally close (handles beat shapes). */
const KIND_PRIORITY: Record<PickTag['kind'], number> = {
  'resize-handle': 0,
  'wall-vertex': 0,
  'outline-vertex': 0,
  'outline-midpoint': 0,
  'canvas-border': 1,
  node: 2,
  poi: 2,
  edge: 3,
  shape: 4,
  canvas: 5,
};

/** Nearest tagged hit; near-ties resolve by kind priority. */
export function pickFromIntersections(
  intersections: Array<{ distance: number; object: THREE.Object3D }>,
): PickTag | null {
  let best: { tag: PickTag; distance: number } | null = null;
  for (const hit of intersections) {
    let object: THREE.Object3D | null = hit.object;
    let tag: PickTag | undefined;
    while (object && !tag) {
      tag = (object.userData as { pick?: PickTag }).pick;
      object = object.parent;
    }
    if (!tag) continue;
    if (
      !best ||
      hit.distance < best.distance - 1 ||
      (Math.abs(hit.distance - best.distance) <= 1 &&
        KIND_PRIORITY[tag.kind] < KIND_PRIORITY[best.tag.kind])
    ) {
      best = { tag, distance: hit.distance };
    }
  }
  return best?.tag ?? null;
}
