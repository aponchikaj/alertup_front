import { buildRouteScene, cameraTargetForStep } from './routeScene';
import { FLOOR_PITCH_RATIO } from './geometry3d';
import type { AssembledRoute, FloorSummary } from '../map/types';

/* The stacked route view is the flagship 3D moment — floors at the right
   heights, the right floor solid, the hop drawn between the right nodes. */

const floor = (id: string, floorNumber: number): FloorSummary => ({
  id,
  floorNumber,
  name: `Floor ${floorNumber}`,
  mapImageUrl: null,
  drawing: { version: 1, shapes: [] },
  width: 1000,
  height: 800,
  scalePixelsPerMeter: 50,
});

/** Ground floor walk → stairs → floor 2 walk → arrive. */
const route: AssembledRoute = {
  mode: 'WAYFINDING',
  origin: { nodeId: 'a', label: null, floorNumber: 1 },
  destination: { nodeId: 'd', label: 'Target', floorNumber: 2, poi: null },
  accessible: false,
  accessibleRouteUnavailable: false,
  totalDistancePx: 500,
  totalDistanceMeters: 10,
  segments: [
    {
      index: 0,
      floor: floor('f1', 1),
      nodes: [
        { id: 'a', x: 100, y: 100, type: 'NORMAL', label: null },
        { id: 'b', x: 400, y: 100, type: 'TRANSIT', label: 'Stairs' },
      ],
      distancePx: 300,
      distanceMeters: 6,
    },
    {
      index: 1,
      floor: floor('f2', 2),
      nodes: [
        { id: 'c', x: 420, y: 120, type: 'TRANSIT', label: 'Stairs' },
        { id: 'd', x: 700, y: 300, type: 'POI', label: 'Target' },
      ],
      distancePx: 200,
      distanceMeters: 4,
    },
  ],
  transitions: [
    {
      afterSegmentIndex: 0,
      transitType: 'STAIRS',
      fromFloorNumber: 1,
      toFloorNumber: 2,
      fromNodeId: 'b',
      toNodeId: 'c',
      direction: 'up',
      label: null,
    },
  ],
  steps: [
    { kind: 'walk', segmentIndex: 0 },
    { kind: 'transit', transitionIndex: 0 },
    { kind: 'walk', segmentIndex: 1 },
    { kind: 'arrive' },
  ],
};

const PITCH = 150 * FLOOR_PITCH_RATIO;

describe('buildRouteScene', () => {
  test('stacks each touched floor at its elevation with its route leg', () => {
    const { spec, levels, activeFloorId } = buildRouteScene({ route, activeStepIndex: 0 });
    expect(spec.floors).toHaveLength(2);
    expect(levels.map((l) => l.elevation)).toEqual([0, PITCH]);
    // Step 0 walks segment 0 → floor f1 active, f2 ghosted.
    expect(activeFloorId).toBe('f1');
    const [f1, f2] = spec.floors;
    expect(f1.ghost).toBe(false);
    expect(f2.ghost).toBe(true);
    expect(f1.routes[0].points).toEqual([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ]);
    expect(f2.elevation).toBe(PITCH);
  });

  test('the transition becomes a connector between the transit nodes', () => {
    const { spec } = buildRouteScene({ route, activeStepIndex: 1 });
    expect(spec.connectors).toHaveLength(1);
    const connector = spec.connectors?.[0];
    expect(connector).toMatchObject({
      fromX: 400,
      fromY: 100,
      fromElevation: 0,
      toX: 420,
      toY: 120,
      toElevation: PITCH,
      direction: 'up',
    });
    // The transit step is live → its connector pulses.
    expect(connector?.active).toBe(true);
    // …and the departure floor is the active one during transit.
    expect(spec.floors[0].ghost).toBe(false);
  });

  test('advancing to the second walk flips which floor is solid', () => {
    const { spec, activeFloorId } = buildRouteScene({ route, activeStepIndex: 2 });
    expect(activeFloorId).toBe('f2');
    expect(spec.floors[0].ghost).toBe(true);
    expect(spec.floors[1].ghost).toBe(false);
    expect(spec.connectors?.[0].active).toBe(false);
  });

  test('evacuation mode defaults the route tone to danger', () => {
    const { spec } = buildRouteScene({
      route: { ...route, mode: 'EVACUATION' },
      activeStepIndex: 0,
    });
    expect(spec.floors[0].routes[0].colorToken).toBe('var(--danger)');
  });

  test('the user dot lands only on its own floor', () => {
    const { spec } = buildRouteScene({
      route,
      activeStepIndex: 0,
      userDot: { x: 100, y: 100, floorId: 'f1' },
    });
    expect(spec.floors[0].userDot).toMatchObject({ x: 100, y: 100 });
    expect(spec.floors[1].userDot).toBeNull();
  });
});

describe('cameraTargetForStep', () => {
  const { levels } = buildRouteScene({ route, activeStepIndex: 0 });

  test('walk → segment bounding-box center at the floor elevation', () => {
    expect(cameraTargetForStep(route, 0, levels)).toEqual({ x: 250, y: 0, z: 100 });
    expect(cameraTargetForStep(route, 2, levels)).toEqual({ x: 560, y: PITCH, z: 210 });
  });

  test('transit → the connector midpoint, framing both floors', () => {
    expect(cameraTargetForStep(route, 1, levels)).toEqual({
      x: 410,
      y: PITCH / 2,
      z: 110,
    });
  });

  test('arrive → the destination node', () => {
    expect(cameraTargetForStep(route, 3, levels)).toEqual({ x: 700, y: PITCH, z: 300 });
  });

  test('out-of-range step → null', () => {
    expect(cameraTargetForStep(route, 99, levels)).toBeNull();
  });
});
