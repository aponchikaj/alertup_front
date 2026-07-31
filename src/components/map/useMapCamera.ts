import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  DEFAULT_FLOOR_SPACE,
  centerOn,
  fitCamera,
  panBy,
  screenToMap,
  viewToMap,
  zoomAt,
  type Camera,
  type FloorSpace,
  type MapPoint,
  type ScaleBounds,
} from './mapSpace';

/* ============================================================================
   useMapCamera — camera state + gesture wiring for a MapCanvas svg.
   ----------------------------------------------------------------------------
   Owns pan (single-pointer drag), pinch zoom (two pointers, the activePointers
   pattern proven on the QR route page), wheel zoom (bound natively with
   { passive: false } — React's synthetic onWheel registers passively, so its
   preventDefault() is ignored and the page scrolls under the map; that is
   precisely how the old editor's zoom died), tap detection, and the button
   controls. The host element must have `touch-action: none` so the browser
   hands us the gesture instead of scrolling — MapCanvas sets it when it
   receives these handlers.
   ========================================================================= */

export interface UseMapCameraOptions {
  space?: FloorSpace;
  minScale?: number;
  maxScale?: number;
  /** When false, single-pointer drag no longer pans (taps still work). */
  interactive?: boolean;
  /** Fired on press-and-release without a drag, in map coordinates. */
  onTap?: (point: MapPoint) => void;
}

export interface MapCameraHandlers {
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerLeave: (e: ReactPointerEvent<SVGSVGElement>) => void;
}

export interface MapCameraControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  centerOn: (point: MapPoint) => void;
}

export interface UseMapCameraResult {
  camera: Camera;
  setCamera: Dispatch<SetStateAction<Camera>>;
  /** Attach to the MapCanvas svg element (wheel listener target). */
  svgRef: RefObject<SVGSVGElement | null>;
  /** Spread onto the svg via MapCanvas's `handlers` prop. */
  handlers: MapCameraHandlers;
  controls: MapCameraControls;
  isDragging: boolean;
}

/** Movement below this (screen px) still counts as a tap, not a drag. */
const TAP_SLOP_PX = 6;

const ZOOM_IN_FACTOR = 1.25;
const ZOOM_OUT_FACTOR = 0.8;

export function useMapCamera(options: UseMapCameraOptions = {}): UseMapCameraResult {
  const {
    space = DEFAULT_FLOOR_SPACE,
    minScale = 0.5,
    maxScale = 3,
    interactive = true,
    onTap,
  } = options;

  const bounds = useMemo<ScaleBounds>(
    () => ({ minScale, maxScale }),
    [minScale, maxScale],
  );

  const [camera, setCamera] = useState<Camera>(() => fitCamera(space));
  const [isDragging, setIsDragging] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Refs mirror state/props so the natively-bound wheel listener and the
  // pointer handlers stay referentially stable without going stale.
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const spaceRef = useRef(space);
  spaceRef.current = space;

  // Gesture state (never rendered, so refs, not state).
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number } | null>(null);
  const gesture = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  /**
   * View (viewBox) units per screen pixel — for converting pointer deltas
   * into pan translation. The CTM is authoritative; the bounding-rect fit is
   * the jsdom/pre-layout fallback.
   */
  const viewUnitsPerPx = useCallback((): number => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    if (ctm && ctm.a > 0) return 1 / ctm.a;
    const rect = svg.getBoundingClientRect();
    const { width, height } = spaceRef.current;
    if (rect.width > 0 && rect.height > 0 && width > 0 && height > 0) {
      const fit = Math.min(rect.width / width, rect.height / height);
      if (fit > 0) return 1 / fit;
    }
    return 1;
  }, []);

  /** Anchor for wheel/pinch zoom; falls back to the viewport centre. */
  const anchorFromClient = useCallback(
    (clientX: number, clientY: number): MapPoint => {
      const svg = svgRef.current;
      const cam = cameraRef.current;
      const mapped = svg ? screenToMap(clientX, clientY, svg, cam) : null;
      if (mapped) return mapped;
      const { width, height } = spaceRef.current;
      return viewToMap(cam, { x: width / 2, y: height / 2 });
    },
    [],
  );

  // Native non-passive wheel listener. React's synthetic onWheel cannot
  // preventDefault (passive), so it must be bound by hand.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const anchor = anchorFromClient(e.clientX, e.clientY);
      setCamera((c) => zoomAt(c, anchor, factor, boundsRef.current));
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [anchorFromClient]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (activePointers.current.size === 1) {
      gesture.current = {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
      if (interactiveRef.current) setIsDragging(true);
    } else if (activePointers.current.size === 2) {
      // Second finger starts a pinch; panning stops so the gestures don't
      // fight each other.
      setIsDragging(false);
      gesture.current = null;
      const [a, b] = Array.from(activePointers.current.values());
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!activePointers.current.has(e.pointerId)) return;
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.current.size >= 2 && pinchStart.current) {
        const [a, b] = Array.from(activePointers.current.values());
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart.current.distance > 0 && distance > 0) {
          // Incremental factor against the previous move keeps the zoom
          // anchored under the (possibly travelling) pinch midpoint.
          const factor = distance / pinchStart.current.distance;
          const anchor = anchorFromClient((a.x + b.x) / 2, (a.y + b.y) / 2);
          setCamera((c) => zoomAt(c, anchor, factor, boundsRef.current));
        }
        pinchStart.current = { distance };
        return;
      }

      const g = gesture.current;
      if (!g) return;
      if (
        Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > TAP_SLOP_PX
      ) {
        g.moved = true;
      }
      if (interactiveRef.current) {
        const perPx = viewUnitsPerPx();
        const dx = (e.clientX - g.lastX) * perPx;
        const dy = (e.clientY - g.lastY) * perPx;
        if (dx !== 0 || dy !== 0) setCamera((c) => panBy(c, dx, dy));
      }
      g.lastX = e.clientX;
      g.lastY = e.clientY;
    },
    [anchorFromClient, viewUnitsPerPx],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const hadPointer = activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchStart.current = null;
    if (activePointers.current.size === 0) {
      setIsDragging(false);
      const g = gesture.current;
      gesture.current = null;
      // A press-and-release that never dragged is a tap. screenToMap is null
      // when no CTM exists (jsdom, unmounted) — then this is a silent no-op.
      if (hadPointer && g && !g.moved && e.type === 'pointerup' && onTapRef.current) {
        const svg = svgRef.current;
        const point = svg
          ? screenToMap(e.clientX, e.clientY, svg, cameraRef.current)
          : null;
        if (point) onTapRef.current(point);
      }
    }
  }, []);

  const handlers = useMemo<MapCameraHandlers>(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handlePointerUp,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp],
  );

  const controls = useMemo<MapCameraControls>(() => {
    const zoomAboutViewportCenter = (factor: number) => {
      setCamera((c) => {
        const { width, height } = spaceRef.current;
        const anchor = viewToMap(c, { x: width / 2, y: height / 2 });
        return zoomAt(c, anchor, factor, boundsRef.current);
      });
    };
    return {
      zoomIn: () => zoomAboutViewportCenter(ZOOM_IN_FACTOR),
      zoomOut: () => zoomAboutViewportCenter(ZOOM_OUT_FACTOR),
      reset: () => setCamera(fitCamera(spaceRef.current)),
      centerOn: (point: MapPoint) =>
        setCamera((c) => centerOn(c, point, spaceRef.current)),
    };
  }, []);

  return { camera, setCamera, svgRef, handlers, controls, isDragging };
}

export default useMapCamera;
