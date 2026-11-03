import { segmentPolyline } from './routeGeometry';
import type { RouteSegment } from './types';

/* ============================================================================
   segmentPolyline: prefers the assembler's precise `points` polyline, and
   falls back to the coarser node-to-node path when `points` is absent or too
   short to draw a line (fewer than two points).
   ========================================================================= */

const baseSegment = (): RouteSegment => ({
  index: 0,
  floor: null,
  nodes: [
    { id: 'n1', x: 0, y: 0, type: 'NORMAL', label: null },
    { id: 'n2', x: 10, y: 0, type: 'NORMAL', label: null },
  ],
  distancePx: 10,
  distanceMeters: 1,
});

describe('segmentPolyline', () => {
  test('prefers points when the segment carries at least two', () => {
    const segment: RouteSegment = {
      ...baseSegment(),
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ],
    };

    expect(segmentPolyline(segment)).toEqual(segment.points);
  });

  test('falls back to nodes when points is absent', () => {
    const segment = baseSegment();

    expect(segmentPolyline(segment)).toEqual([
      { x: 0, y: 0, nodeId: 'n1' },
      { x: 10, y: 0, nodeId: 'n2' },
    ]);
  });

  test('falls back to nodes when points is degenerate (fewer than two)', () => {
    const segment: RouteSegment = { ...baseSegment(), points: [{ x: 1, y: 1 }] };

    expect(segmentPolyline(segment)).toEqual([
      { x: 0, y: 0, nodeId: 'n1' },
      { x: 10, y: 0, nodeId: 'n2' },
    ]);
  });
});
