import {
  DEFAULT_FLOOR_SPACE,
  IDENTITY_CAMERA,
  clampScale,
  mapToView,
  viewToMap,
  zoomAt,
  panBy,
  centerOn,
  fitCamera,
  screenToMap,
  type Camera,
} from './mapSpace';

describe('clampScale', () => {
  test('keeps the scale inside the bounds', () => {
    expect(clampScale(5, { minScale: 0.5, maxScale: 3 })).toBe(3);
    expect(clampScale(0.1, { minScale: 0.5, maxScale: 3 })).toBe(0.5);
    expect(clampScale(1.5, { minScale: 0.5, maxScale: 3 })).toBe(1.5);
  });
});

describe('mapToView / viewToMap', () => {
  test('round-trip through the camera is lossless', () => {
    const camera: Camera = { scale: 2.5, tx: -140, ty: 60 };
    const point = { x: 321, y: 654 };
    const back = viewToMap(camera, mapToView(camera, point));
    expect(back.x).toBeCloseTo(point.x, 10);
    expect(back.y).toBeCloseTo(point.y, 10);
  });
});

describe('zoomAt', () => {
  const bounds = { minScale: 0.5, maxScale: 3 };

  test('the anchor point stays fixed on screen', () => {
    const camera: Camera = { scale: 1, tx: 0, ty: 0 };
    const anchor = { x: 400, y: 300 };
    const before = mapToView(camera, anchor);

    const zoomed = zoomAt(camera, anchor, 2, bounds);
    const after = mapToView(zoomed, anchor);

    expect(zoomed.scale).toBe(2);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  test('holds the anchor across a zoom in then out', () => {
    const camera: Camera = { scale: 1.4, tx: 33, ty: -12 };
    const anchor = { x: 210, y: 480 };
    const before = mapToView(camera, anchor);

    const roundTrip = zoomAt(zoomAt(camera, anchor, 1.6, bounds), anchor, 1 / 1.6, bounds);
    const after = mapToView(roundTrip, anchor);

    expect(roundTrip.scale).toBeCloseTo(camera.scale, 10);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  test('clamping at the ceiling still keeps the anchor put', () => {
    const camera: Camera = { scale: 2.9, tx: 10, ty: 10 };
    const anchor = { x: 100, y: 100 };
    const before = mapToView(camera, anchor);

    const zoomed = zoomAt(camera, anchor, 4, bounds);
    const after = mapToView(zoomed, anchor);

    expect(zoomed.scale).toBe(3);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  test('a no-op factor returns an equivalent camera', () => {
    const camera: Camera = { scale: 1.25, tx: -8, ty: 4 };
    const zoomed = zoomAt(camera, { x: 500, y: 400 }, 1, bounds);
    expect(zoomed.scale).toBeCloseTo(camera.scale, 10);
    expect(zoomed.tx).toBeCloseTo(camera.tx, 10);
    expect(zoomed.ty).toBeCloseTo(camera.ty, 10);
  });
});

describe('panBy', () => {
  test('translates without touching scale', () => {
    const panned = panBy({ scale: 2, tx: 5, ty: 5 }, 20, -10);
    expect(panned).toEqual({ scale: 2, tx: 25, ty: -5 });
  });
});

describe('centerOn', () => {
  test('puts the requested map point at the container centre', () => {
    const container = { width: 800, height: 600 };
    const camera = centerOn({ scale: 2, tx: 0, ty: 0 }, { x: 250, y: 125 }, container);
    const view = mapToView(camera, { x: 250, y: 125 });
    expect(view.x).toBeCloseTo(container.width / 2, 10);
    expect(view.y).toBeCloseTo(container.height / 2, 10);
  });
});

describe('fitCamera', () => {
  // The svg already letterbox-fits via preserveAspectRatio, so the identity
  // camera IS the fit; padding is the only reason to deviate from it.
  test('is identity with no padding', () => {
    expect(fitCamera(DEFAULT_FLOOR_SPACE, { width: 500, height: 800 })).toEqual(
      IDENTITY_CAMERA,
    );
  });

  test('padding zooms out while holding the space centre still', () => {
    const camera = fitCamera(DEFAULT_FLOOR_SPACE, { width: 800, height: 600 }, 0.05);
    expect(camera.scale).toBeCloseTo(1 / 1.1, 10);

    const centre = {
      x: DEFAULT_FLOOR_SPACE.width / 2,
      y: DEFAULT_FLOOR_SPACE.height / 2,
    };
    const moved = mapToView(camera, centre);
    expect(moved.x).toBeCloseTo(centre.x, 8);
    expect(moved.y).toBeCloseTo(centre.y, 8);
  });

  test('degenerate containers fall back to identity rather than NaN', () => {
    const camera = fitCamera(DEFAULT_FLOOR_SPACE, { width: 0, height: 0 }, 0.05);
    expect(Number.isFinite(camera.scale)).toBe(true);
    expect(camera).toEqual(IDENTITY_CAMERA);
  });
});

describe('screenToMap', () => {
  test('returns null when the element exposes no CTM (jsdom)', () => {
    const fakeSvg = {
      getScreenCTM: () => null,
    } as unknown as SVGSVGElement;

    expect(screenToMap(10, 10, fakeSvg, IDENTITY_CAMERA)).toBeNull();
  });
});
