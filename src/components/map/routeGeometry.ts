/* ============================================================================
   Route geometry helpers — pure, no three.js.
   ----------------------------------------------------------------------------
   segmentPolyline picks the line a segment should be drawn along: the
   assembler's precise `points` polyline when one was sent, falling back to
   the coarser node-to-node path for routes assembled before `points` existed.
   Kept three-free so it stays unit-testable in jsdom (see eslint.config.js).
   ========================================================================= */

import type { RoutePoint, RouteSegment } from './types';

/** The polyline a segment should be drawn along. */
export function segmentPolyline(segment: Pick<RouteSegment, 'points' | 'nodes'>): RoutePoint[] {
  if (segment.points && segment.points.length >= 2) return segment.points;
  return segment.nodes.map((node) => ({ x: node.x, y: node.y, nodeId: node.id }));
}
