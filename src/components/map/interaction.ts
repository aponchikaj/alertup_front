/* ============================================================================
   Map surface interaction contract — shared by the SVG and 3D renderers.
   ----------------------------------------------------------------------------
   The editor's state machine never sees SVG (or three.js). It sees three
   things: map-space points, "what entity did this press land on", and camera
   control verbs. Everything else — element handlers in 2D, raycasting in 3D —
   is a renderer detail behind this contract, which is what makes the two
   surfaces swappable with a view-toggle button and zero reducer changes.

   NO three.js imports here, ever: this file is part of the 2D bundle.
   ========================================================================= */

import type { MapPoint } from './mapSpace';
import type { MapCameraControls } from './useMapCamera';
import type { DrawingShape, ResizeHandle } from './drawing';
import type { MapNode } from './types';

/**
 * What a press landed on — the renderer-agnostic twin of the SVG layers'
 * per-element handlers (and of `target.closest('[data-node-id]')` checks).
 * The 3D surface produces these from a raycast against tagged hit meshes.
 */
export type MapPointerTarget =
  | { kind: 'canvas' }
  | { kind: 'shape'; shape: DrawingShape }
  | { kind: 'node'; node: MapNode }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'poi'; poiId: string; nodeId: string }
  | { kind: 'resize-handle'; shape: DrawingShape; handle: ResizeHandle }
  | { kind: 'wall-vertex'; shape: DrawingShape; vertexIndex: number }
  | { kind: 'outline-vertex'; vertexIndex: number }
  | { kind: 'outline-midpoint'; afterVertexIndex: number }
  | { kind: 'canvas-border'; axis: 'x' | 'y' | 'xy' };

/**
 * The minimal event surface the existing editor handlers actually consume:
 * they read clientX/clientY, remember the pointer, and call stopPropagation()
 * when they capture a drag. The 3D surface passes a shim whose
 * stopPropagation() sets a flag it reads to suppress camera movement for the
 * remainder of the gesture — the same contract the DOM gives the SVG path.
 */
export interface SurfacePointerEvent {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
  stopPropagation: () => void;
}

/**
 * The one object page-level code talks to, whichever renderer is live.
 */
export interface MapSurfaceApi {
  /**
   * Client (screen) px → map coordinates on the ACTIVE floor's ground plane.
   * SVG: screenToMap via getScreenCTM. 3D: raycast against the floor plane.
   * Returns null when not projectable (no CTM / ray misses) — callers already
   * treat null as "no hit" and must keep doing so.
   */
  projectPointer: (clientX: number, clientY: number) => MapPoint | null;
  /**
   * Topmost interactive entity under the pointer. The 3D surface implements
   * this with a raycast; the SVG surface may return null (its layers keep
   * using per-element DOM handlers and never need it).
   */
  pick: (clientX: number, clientY: number) => MapPointerTarget | null;
  /** Same verbs useMapCamera exposes; the 3D rig adapts them to orbit moves. */
  controls: MapCameraControls;
}
