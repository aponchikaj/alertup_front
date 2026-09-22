import {
  wallHeightFor,
  wallSolid,
  stackFloors,
  rayToMapPoint,
  fitToBounds,
  FLOOR_PITCH_RATIO,
} from './geometry3d';

/* The 3D scene is only as correct as this math — it is what turns a flat
   plan into solids and a pointer into a floor coordinate. */

describe('wallHeightFor', () => {
  test('3 m at the floor scale, defaulting to 50 px/m', () => {
    expect(wallHeightFor(50)).toBe(150);
    expect(wallHeightFor(100)).toBe(300);
    expect(wallHeightFor(null)).toBe(150);
    expect(wallHeightFor(0)).toBe(150);
  });
});

describe('wallSolid', () => {
  test('one box per segment, one joint per vertex, correct centers', () => {
    // An L-shaped wall: (0,0) → (100,0) → (100,50).
    const { segments, joints } = wallSolid([0, 0, 100, 0, 100, 50], 6);
    expect(segments).toHaveLength(2);
    expect(joints).toHaveLength(3);
    expect(segments[0]).toMatchObject({ centerX: 50, centerY: 0, length: 100, thickness: 6 });
    expect(segments[1]).toMatchObject({ centerX: 100, centerY: 25, length: 50 });
    expect(joints[0]).toEqual({ x: 0, y: 0, radius: 3 });
  });

  test('horizontal segment has rotation 0; map-down segment rotates negatively', () => {
    const horizontal = wallSolid([0, 0, 100, 0], 4).segments[0];
    expect(horizontal.rotation).toBe(-0);
    const down = wallSolid([0, 0, 0, 100], 4).segments[0];
    expect(down.rotation).toBeCloseTo(-Math.PI / 2);
  });

  test('zero-length segments are dropped', () => {
    expect(wallSolid([10, 10, 10, 10], 4).segments).toHaveLength(0);
  });
});

describe('stackFloors', () => {
  test('ranks by floorNumber and pitches evenly, gaps collapsed', () => {
    const wallHeight = 150;
    const pitch = wallHeight * FLOOR_PITCH_RATIO;
    // Floors 1, 2, 5 — the hole where 3/4 never existed must not appear.
    const levels = stackFloors(
      [
        { id: 'c', floorNumber: 5 },
        { id: 'a', floorNumber: 1 },
        { id: 'b', floorNumber: 2 },
      ],
      wallHeight,
    );
    expect(levels.map((l) => l.floorId)).toEqual(['a', 'b', 'c']);
    expect(levels.map((l) => l.elevation)).toEqual([0, pitch, pitch * 2]);
  });
});

describe('rayToMapPoint', () => {
  test('a straight-down ray lands where it points', () => {
    const point = rayToMapPoint(
      { origin: { x: 500, y: 1000, z: 400 }, direction: { x: 0, y: -1, z: 0 } },
      0,
    );
    expect(point).toEqual({ x: 500, y: 400 });
  });

  test('elevation offsets the plane', () => {
    const point = rayToMapPoint(
      { origin: { x: 0, y: 300, z: 0 }, direction: { x: 1, y: -1, z: 1 } },
      100,
    );
    // Travels 200 down to reach y=100, so 200 along x and z too.
    expect(point).toEqual({ x: 200, y: 200 });
  });

  test('parallel and behind-origin rays return null (the no-hit contract)', () => {
    expect(
      rayToMapPoint({ origin: { x: 0, y: 10, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, 0),
    ).toBeNull();
    expect(
      rayToMapPoint({ origin: { x: 0, y: 10, z: 0 }, direction: { x: 0, y: 1, z: 0 } }, 0),
    ).toBeNull();
  });
});

describe('fitToBounds', () => {
  const fov = (45 * Math.PI) / 180;

  test('targets the stack center and backs off far enough to see it all', () => {
    const frame = fitToBounds(
      { width: 1000, height: 800, minElevation: 0, maxElevation: 150 },
      fov,
      16 / 9,
    );
    expect(frame.target).toEqual({ x: 500, y: 75, z: 400 });
    // Camera sits behind (+z) and above (+y) the target — the ¾ view.
    expect(frame.position.y).toBeGreaterThan(frame.target.y);
    expect(frame.position.z).toBeGreaterThan(frame.target.z);
    const distance = Math.hypot(
      frame.position.x - frame.target.x,
      frame.position.y - frame.target.y,
      frame.position.z - frame.target.z,
    );
    expect(distance).toBeGreaterThan(frame.radius); // sphere fits inside the frustum
  });

  test('a narrower aspect pushes the camera further back', () => {
    const bounds = { width: 1000, height: 800, minElevation: 0, maxElevation: 0 };
    const wide = fitToBounds(bounds, fov, 2);
    const tall = fitToBounds(bounds, fov, 0.5);
    const dist = (f: typeof wide) =>
      Math.hypot(f.position.x - f.target.x, f.position.y - f.target.y, f.position.z - f.target.z);
    expect(dist(tall)).toBeGreaterThan(dist(wide));
  });
});
