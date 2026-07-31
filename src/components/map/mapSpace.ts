/* ============================================================================
   Map coordinate space — pure math, no React.
   ----------------------------------------------------------------------------
   One coordinate space rules everything: the floor's viewBox ("map units").
   The camera is a translate+scale applied to a <g> INSIDE the svg, so layers
   render in map units and never do their own screen math.

     view  = map * scale + t          (mapToView)
     map   = (view - t) / scale       (viewToMap)

   Screen → view conversion goes through getScreenCTM().inverse() — the browser
   owns the letterbox created by preserveAspectRatio, and hand-rolled letterbox
   math is exactly what skewed the old editor renderer. getScreenCTM is absent
   in jsdom, so everything except `screenToMap` is testable without a DOM, and
   `screenToMap` degrades to null (callers must treat that as "no hit").
   ========================================================================= */

export interface FloorSpace {
  width: number;
  height: number;
}

/** Uploaded floor plans are normalized to this viewBox by the pipeline. */
export const DEFAULT_FLOOR_SPACE: FloorSpace = { width: 1000, height: 800 };

/** Pan/zoom state, in map units. Applied as translate(tx, ty) scale(scale). */
export interface Camera {
  scale: number;
  tx: number;
  ty: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface ScaleBounds {
  minScale: number;
  maxScale: number;
}

export const DEFAULT_SCALE_BOUNDS: ScaleBounds = { minScale: 0.5, maxScale: 3 };

export const IDENTITY_CAMERA: Camera = { scale: 1, tx: 0, ty: 0 };

export const clampScale = (
  scale: number,
  bounds: ScaleBounds = DEFAULT_SCALE_BOUNDS,
): number => Math.min(Math.max(scale, bounds.minScale), bounds.maxScale);

/** Map units → view (viewBox) units under the camera. */
export const mapToView = (camera: Camera, point: MapPoint): MapPoint => ({
  x: point.x * camera.scale + camera.tx,
  y: point.y * camera.scale + camera.ty,
});

/** View (viewBox) units → map units under the camera. */
export const viewToMap = (camera: Camera, point: MapPoint): MapPoint => ({
  x: (point.x - camera.tx) / camera.scale,
  y: (point.y - camera.ty) / camera.scale,
});

/**
 * Zoom by `factor` about a map-space anchor: the anchor keeps the exact same
 * view position before and after, which is what makes wheel zoom feel glued
 * to the cursor. Derivation: v = p·s + t must equal p·s' + t', so
 * t' = t + p·(s − s').
 */
export const zoomAt = (
  camera: Camera,
  mapPoint: MapPoint,
  factor: number,
  bounds: ScaleBounds = DEFAULT_SCALE_BOUNDS,
): Camera => {
  const scale = clampScale(camera.scale * factor, bounds);
  return {
    scale,
    tx: camera.tx + mapPoint.x * (camera.scale - scale),
    ty: camera.ty + mapPoint.y * (camera.scale - scale),
  };
};

/** Pan by a delta expressed in view (viewBox) units. */
export const panBy = (camera: Camera, dx: number, dy: number): Camera => ({
  scale: camera.scale,
  tx: camera.tx + dx,
  ty: camera.ty + dy,
});

/**
 * Keep the current zoom but pan so `mapPoint` lands at the centre of the
 * viewport (= the centre of the space, since the viewBox is the space).
 */
export const centerOn = (
  camera: Camera,
  mapPoint: MapPoint,
  space: FloorSpace,
): Camera => ({
  scale: camera.scale,
  tx: space.width / 2 - mapPoint.x * camera.scale,
  ty: space.height / 2 - mapPoint.y * camera.scale,
});

/**
 * Initial fit. The canvas renders viewBox="0 0 w h" with
 * preserveAspectRatio="xMidYMid meet", so the browser already letterbox-fits
 * the space into whatever the container measures — the identity camera IS the
 * fit. `container` only guards degenerate measurements (jsdom, display:none),
 * and `padding` (fraction of the space) pulls back slightly so edge nodes are
 * not glued to the frame; the space centre stays fixed while doing so.
 */
export const fitCamera = (
  space: FloorSpace,
  container?: { width: number; height: number } | null,
  padding = 0,
): Camera => {
  if (
    (container && (container.width <= 0 || container.height <= 0)) ||
    padding <= 0
  ) {
    return { ...IDENTITY_CAMERA };
  }
  const scale = 1 / (1 + padding * 2);
  return zoomAt(
    IDENTITY_CAMERA,
    { x: space.width / 2, y: space.height / 2 },
    scale,
    { minScale: scale, maxScale: 1 },
  );
};

/**
 * Client (screen) coordinates → map coordinates, via the browser's own
 * screen→viewBox matrix. Pass the camera to also undo pan/zoom; omit it to get
 * raw viewBox coordinates. Returns null when the CTM is unavailable (element
 * not laid out, or a non-rendering environment like jsdom) — callers must
 * no-op on null rather than guess.
 */
export const screenToMap = (
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
  camera?: Camera,
): MapPoint | null => {
  if (typeof svgEl.getScreenCTM !== 'function' || typeof DOMPoint === 'undefined') {
    return null;
  }
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const view = { x: p.x, y: p.y };
  return camera ? viewToMap(camera, view) : view;
};
