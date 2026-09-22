import { pickFromIntersections } from './picking';
import type * as THREE from 'three';

/* Picking decides what a tap means. The inputs are plain
   {distance, object} records, so the priority logic tests without three. */

type FakeObject = { userData: Record<string, unknown>; parent: FakeObject | null };

const object = (pick: Record<string, unknown> | null, parent: FakeObject | null = null): FakeObject => ({
  userData: pick ? { pick } : {},
  parent,
});

const hit = (distance: number, obj: FakeObject) =>
  ({ distance, object: obj as unknown as THREE.Object3D });

describe('pickFromIntersections', () => {
  test('nearest tagged hit wins', () => {
    const result = pickFromIntersections([
      hit(120, object({ kind: 'shape', shapeId: 'far' })),
      hit(40, object({ kind: 'node', nodeId: 'n1' })),
    ]);
    expect(result).toMatchObject({ kind: 'node', nodeId: 'n1' });
  });

  test('near-ties resolve by kind priority — handles beat the shape under them', () => {
    const result = pickFromIntersections([
      hit(50, object({ kind: 'shape', shapeId: 'room' })),
      hit(50.4, object({ kind: 'resize-handle', shapeId: 'room', handle: 'se' })),
    ]);
    expect(result?.kind).toBe('resize-handle');
  });

  test('untagged meshes inherit the tag from their ancestors', () => {
    const parent = object({ kind: 'edge', edgeId: 'e9' });
    const child = object(null, parent);
    expect(pickFromIntersections([hit(10, child)])).toMatchObject({ kind: 'edge', edgeId: 'e9' });
  });

  test('no tagged hits → null (the no-hit contract)', () => {
    expect(pickFromIntersections([])).toBeNull();
    expect(pickFromIntersections([hit(5, object(null))])).toBeNull();
  });
});
