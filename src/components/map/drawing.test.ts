import {
  canvasSizeForMeters,
  eraseHitTest,
  pointSegmentDistance,
  clampToSpace,
  DEFAULT_PIXELS_PER_METER,
  hitTest,
  isDrawingEmpty,
  parseDrawing,
  rectFromPoints,
  shapeBounds,
  shapeCenter,
  snap,
  translateShape,
  type DrawingShape,
} from './drawing';

const room = (over: Partial<Extract<DrawingShape, { kind: 'room' }>> = {}) =>
  ({ id: 'r1', kind: 'room', x: 10, y: 20, width: 100, height: 50, ...over }) as DrawingShape;

describe('rectFromPoints', () => {
  it('normalizes a drag in any direction', () => {
    const downRight = rectFromPoints({ x: 10, y: 10 }, { x: 40, y: 30 });
    const upLeft = rectFromPoints({ x: 40, y: 30 }, { x: 10, y: 10 });
    expect(downRight).toEqual({ x: 10, y: 10, width: 30, height: 20 });
    // Dragging up-and-left must give the same box, not a negative one — SVG
    // silently renders nothing for a negative width.
    expect(upLeft).toEqual(downRight);
  });
});

describe('snap', () => {
  it('rounds to the nearest step', () => {
    expect(snap(23, 10)).toBe(20);
    expect(snap(27, 10)).toBe(30);
  });

  it('is a no-op for a non-positive step', () => {
    expect(snap(23.7, 0)).toBe(23.7);
    expect(snap(23.7, -5)).toBe(23.7);
  });
});

describe('clampToSpace', () => {
  it('keeps points inside the floor', () => {
    const space = { width: 100, height: 80 };
    expect(clampToSpace({ x: -5, y: 200 }, space)).toEqual({ x: 0, y: 80 });
    expect(clampToSpace({ x: 50, y: 40 }, space)).toEqual({ x: 50, y: 40 });
  });
});

describe('canvasSizeForMeters', () => {
  it('turns a 20x16m room into the standard 1000x800 space', () => {
    expect(canvasSizeForMeters(20, 16, DEFAULT_PIXELS_PER_METER)).toEqual({
      width: 1000,
      height: 800,
    });
  });

  it('rounds to whole map units', () => {
    expect(canvasSizeForMeters(10.333, 5, 50)).toEqual({ width: 517, height: 250 });
  });
});

describe('shapeBounds', () => {
  it('measures a box directly', () => {
    expect(shapeBounds(room())).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('grows a horizontal wall by its thickness so it stays hittable', () => {
    const wall: DrawingShape = {
      id: 'w1',
      kind: 'wall',
      points: [0, 50, 100, 50],
      thickness: 6,
    };
    // Without the padding this would be a zero-height rect nothing can hit.
    expect(shapeBounds(wall)).toEqual({ x: -3, y: 47, width: 106, height: 6 });
  });

  it('centres an icon box on its point', () => {
    const icon: DrawingShape = { id: 'i1', kind: 'icon', x: 50, y: 50, icon: 'ELEVATOR', size: 20 };
    expect(shapeBounds(icon)).toEqual({ x: 40, y: 40, width: 20, height: 20 });
  });
});

describe('shapeCenter', () => {
  it('returns the middle of a box', () => {
    expect(shapeCenter(room())).toEqual({ x: 60, y: 45 });
  });

  it('returns the icon point itself', () => {
    const icon: DrawingShape = { id: 'i1', kind: 'icon', x: 7, y: 9, icon: 'WC', size: 20 };
    expect(shapeCenter(icon)).toEqual({ x: 7, y: 9 });
  });

  it('averages a wall run', () => {
    const wall: DrawingShape = { id: 'w', kind: 'wall', points: [0, 0, 10, 20], thickness: 4 };
    expect(shapeCenter(wall)).toEqual({ x: 5, y: 10 });
  });
});

describe('hitTest', () => {
  const lower = room({ id: 'lower' });
  const upper = room({ id: 'upper' });

  it('picks the topmost shape, because that is the one drawn on top', () => {
    expect(hitTest([lower, upper], { x: 50, y: 40 })?.id).toBe('upper');
  });

  it('returns null on empty space', () => {
    expect(hitTest([lower], { x: 500, y: 500 })).toBeNull();
  });
});

describe('translateShape', () => {
  it('moves a box', () => {
    const moved = translateShape(room(), 5, -10) as Extract<DrawingShape, { kind: 'room' }>;
    expect([moved.x, moved.y]).toEqual([15, 10]);
  });

  it('moves every wall point, x and y independently', () => {
    const wall: DrawingShape = { id: 'w', kind: 'wall', points: [0, 0, 10, 10], thickness: 4 };
    const moved = translateShape(wall, 3, 7) as Extract<DrawingShape, { kind: 'wall' }>;
    expect(moved.points).toEqual([3, 7, 13, 17]);
  });
});

describe('parseDrawing', () => {
  it('returns an empty drawing for junk', () => {
    for (const value of [null, undefined, 42, 'x', []]) {
      expect(parseDrawing(value).shapes).toEqual([]);
    }
  });

  it('keeps valid shapes and drops unrenderable ones', () => {
    const parsed = parseDrawing({
      version: 1,
      shapes: [
        { id: 'a', kind: 'room', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', kind: 'room', x: 0, y: 0, width: 0, height: 10 },
        { id: 'c', kind: 'icon', x: 1, y: 1, icon: 'NOPE' },
        { id: 'd', kind: 'icon', x: 1, y: 1, icon: 'STAIRS' },
        { id: 'e', kind: 'wall', points: [0, 0] },
      ],
    });
    expect(parsed.shapes.map((s) => s.id)).toEqual(['a', 'd']);
  });

  it('preserves the shop node link and logo', () => {
    const parsed = parseDrawing({
      shapes: [
        {
          id: 's',
          kind: 'shop',
          x: 0,
          y: 0,
          width: 5,
          height: 5,
          logoUrl: '/uploads/a.png',
          nodeId: 'n1',
        },
      ],
    });
    expect(parsed.shapes[0]).toMatchObject({ logoUrl: '/uploads/a.png', nodeId: 'n1' });
  });

  it('drops an odd trailing wall coordinate', () => {
    const parsed = parseDrawing({ shapes: [{ kind: 'wall', points: [0, 0, 10, 10, 5] }] });
    expect((parsed.shapes[0] as Extract<DrawingShape, { kind: 'wall' }>).points).toEqual([
      0, 0, 10, 10,
    ]);
  });

  it('defaults the version when absent', () => {
    expect(parseDrawing({ shapes: [] }).version).toBe(1);
  });
});

describe('isDrawingEmpty', () => {
  it('is true for null and for a shapeless drawing', () => {
    expect(isDrawingEmpty(null)).toBe(true);
    expect(isDrawingEmpty({ version: 1, shapes: [] })).toBe(true);
    expect(isDrawingEmpty({ version: 1, shapes: [room()] })).toBe(false);
  });
});

describe('pointSegmentDistance', () => {
  it('measures perpendicular distance inside the segment', () => {
    expect(pointSegmentDistance(5, 3, 0, 0, 10, 0)).toBe(3);
  });

  it('clamps to the nearest endpoint beyond the ends', () => {
    expect(pointSegmentDistance(-3, 4, 0, 0, 10, 0)).toBe(5);
    expect(pointSegmentDistance(13, 4, 0, 0, 10, 0)).toBe(5);
  });

  it('handles a degenerate zero-length segment', () => {
    expect(pointSegmentDistance(3, 4, 1, 1, 1, 1)).toBe(Math.hypot(2, 3));
  });
});

describe('eraseHitTest', () => {
  const wall: DrawingShape = { id: 'w', kind: 'wall', points: [0, 50, 100, 50], thickness: 6 };

  it('hits within the slop margin where exact hitTest misses', () => {
    // 10 units above the wall stroke: outside its exact bounds (pad 3),
    // inside an 8-unit slop.
    expect(hitTest([wall], { x: 50, y: 40 })).toBeNull();
    expect(eraseHitTest([wall], { x: 50, y: 42 }, 8)?.id).toBe('w');
  });

  it('still misses far away', () => {
    expect(eraseHitTest([wall], { x: 50, y: 20 }, 8)).toBeNull();
  });

  it('prefers the topmost of overlapping shapes, like the eye does', () => {
    const bottom = room({ id: 'bottom' });
    const top = room({ id: 'top' });
    expect(eraseHitTest([bottom, top], { x: 50, y: 40 }, 8)?.id).toBe('top');
  });
});
