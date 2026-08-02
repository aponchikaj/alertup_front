import { buildFloorSpec } from './sceneBuilder';
import { PLATFORM_HEIGHT } from './geometry3d';
import type { FloorDrawing } from '../map/drawing';
import type { MapNode, MapEdge, RouteSegment } from '../map/types';

/* The spec is the whole truth of what the 3D view shows — if a shape is
   missing or misplaced here, no amount of rendering fixes it. */

const drawing: FloorDrawing = {
  version: 1,
  shapes: [
    { id: 'o', kind: 'outline', points: [0, 0, 900, 0, 900, 700, 0, 700] },
    { id: 'w1', kind: 'wall', points: [0, 0, 900, 0], thickness: 6 },
    { id: 'r1', kind: 'room', x: 100, y: 100, width: 200, height: 150, name: 'Kitchen' },
    { id: 's1', kind: 'shop', x: 400, y: 100, width: 200, height: 150, name: 'Zara', stroke: '#ff0000' },
    { id: 'i1', kind: 'icon', x: 850, y: 650, icon: 'EXIT', size: 28 },
    { id: 't1', kind: 'text', x: 50, y: 400, text: 'Atrium', fontSize: 16 },
  ],
};

const baseInput = {
  floorId: 'f1',
  floorNumber: 1,
  spaceWidth: 1000,
  spaceHeight: 800,
  drawing,
};

describe('buildFloorSpec', () => {
  test('maps every shape kind to its 3D representation', () => {
    const spec = buildFloorSpec(baseInput);
    expect(spec.slab.points).toEqual([0, 0, 900, 0, 900, 700, 0, 700]); // outline wins
    expect(spec.walls).toHaveLength(1);
    expect(spec.walls[0].solid.segments).toHaveLength(1);
    expect(spec.platforms.map((p) => p.kind)).toEqual(['room', 'shop']);
    expect(spec.icons[0]).toMatchObject({ icon: 'EXIT', x: 850, y: 650 });
    expect(spec.texts[0]).toMatchObject({ text: 'Atrium' });
    // Named boxes grow floating labels above platform height.
    expect(spec.labels.map((l) => l.text)).toEqual(['Kitchen', 'Zara']);
    expect(spec.labels[0].lift).toBeGreaterThan(PLATFORM_HEIGHT);
  });

  test('explicit shape colors survive as literals; defaults become tokens', () => {
    const spec = buildFloorSpec(baseInput);
    const shop = spec.platforms.find((p) => p.kind === 'shop');
    expect(shop?.strokeToken).toBe('#ff0000');
    const room = spec.platforms.find((p) => p.kind === 'room');
    expect(room?.strokeToken).toBe('var(--ink)');
    expect(room?.fillToken).toBe('var(--surface)');
  });

  test('no outline → the slab falls back to the full canvas rect', () => {
    const spec = buildFloorSpec({ ...baseInput, drawing: { version: 1, shapes: [] } });
    expect(spec.slab.points).toEqual([0, 0, 1000, 0, 1000, 800, 0, 800]);
  });

  test('wall height follows the floor scale', () => {
    expect(buildFloorSpec(baseInput).wallHeight).toBe(150);
    expect(buildFloorSpec({ ...baseInput, scalePixelsPerMeter: 100 }).wallHeight).toBe(300);
  });

  test('edges skip missing endpoints and mark vertical transit dashed', () => {
    const nodes: MapNode[] = [
      { id: 'n1', x: 10, y: 10, type: 'NORMAL', label: null },
      { id: 'n2', x: 200, y: 10, type: 'TRANSIT', label: 'Lift' },
    ];
    const edges: MapEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', transitType: 'WALKWAY', accessible: true },
      { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'ghost', transitType: 'ELEVATOR', accessible: true },
      { id: 'e3', sourceNodeId: 'n1', targetNodeId: 'n2', transitType: 'STAIRS', accessible: false },
    ];
    const spec = buildFloorSpec({ ...baseInput, nodes, edges });
    expect(spec.edges.map((e) => e.edgeId)).toEqual(['e1', 'e3']); // e2's endpoint is gone
    expect(spec.edges[0].dashed).toBe(false);
    expect(spec.edges[1].dashed).toBe(true);
    // Node themes carried through.
    expect(spec.nodes[1]).toMatchObject({ fillToken: 'var(--info)', glyph: 'transit', label: 'Lift' });
  });

  test('selection state flows into node and edge specs', () => {
    const nodes: MapNode[] = [
      { id: 'n1', x: 0, y: 0, type: 'NORMAL', label: null },
      { id: 'n2', x: 50, y: 0, type: 'NORMAL', label: null },
    ];
    const edges: MapEdge[] = [
      { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', transitType: 'WALKWAY', accessible: true },
    ];
    const spec = buildFloorSpec({
      ...baseInput,
      nodes,
      edges,
      selectedNodeId: 'n2',
      selectedEdgeId: 'e1',
    });
    expect(spec.nodes.find((n) => n.nodeId === 'n2')?.selected).toBe(true);
    expect(spec.edges[0].colorToken).toBe('var(--brand)');
  });

  test('route needs at least two nodes; evacuation tone is danger', () => {
    const segment: RouteSegment = {
      index: 0,
      floor: null,
      nodes: [
        { id: 'a', x: 0, y: 0, type: 'NORMAL', label: null },
        { id: 'b', x: 100, y: 100, type: 'EMERGENCY_EXIT', label: null },
      ],
      distancePx: 141,
      distanceMeters: null,
    };
    const spec = buildFloorSpec({ ...baseInput, routeSegment: segment, routeTone: 'danger' });
    expect(spec.route?.points).toHaveLength(2);
    expect(spec.route?.colorToken).toBe('var(--danger)');

    const empty = buildFloorSpec({
      ...baseInput,
      routeSegment: { ...segment, nodes: segment.nodes.slice(0, 1) },
    });
    expect(empty.route).toBeNull();
  });

  test('grid appears only when asked (editor mode)', () => {
    expect(buildFloorSpec(baseInput).grid).toBeNull();
    const spec = buildFloorSpec({ ...baseInput, showGrid: true });
    expect(spec.grid).toMatchObject({ step: 25, majorEvery: 4, width: 1000, height: 800 });
  });

  test('ghost and elevation pass through for stacking', () => {
    const spec = buildFloorSpec({ ...baseInput, elevation: 225, ghost: true });
    expect(spec.elevation).toBe(225);
    expect(spec.ghost).toBe(true);
  });
});
