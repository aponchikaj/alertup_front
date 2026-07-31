import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../../lib/cn';
import {
  DEFAULT_FLOOR_SPACE,
  IDENTITY_CAMERA,
  screenToMap,
  type Camera,
  type FloorSpace,
  type MapPoint,
} from './mapSpace';
import type { MapCameraHandlers } from './useMapCamera';

/* ============================================================================
   MapCanvas — the svg shell every map view shares.
   ----------------------------------------------------------------------------
   viewBox = the floor space, so children (layers) render in map coordinates
   inside the camera <g>. One coordinate space; no screen-space overlays, ever.
   The container is measured with a ResizeObserver (window-resize fallback for
   jsdom/older browsers) so consumers can re-fit their camera on layout
   changes.

   Interactive usage pairs it with useMapCamera:

     const { camera, svgRef, handlers, controls } = useMapCamera({ onTap });
     <MapCanvas camera={camera} svgRef={svgRef} handlers={handlers} interactive>
       <FloorImageLayer ... />
       <NodeLayer ... />
     </MapCanvas>

   Static usage just omits camera/handlers.
   ========================================================================= */

export interface MapCanvasProps {
  /** The floor's coordinate space (defaults to the normalized 1000×800). */
  space?: FloorSpace;
  /** Camera from useMapCamera; identity (full fit) when omitted. */
  camera?: Camera;
  /** Gesture handlers from useMapCamera; spread onto the svg. */
  handlers?: Partial<MapCameraHandlers>;
  /** svgRef from useMapCamera (wheel listener + hit-testing target). */
  svgRef?: RefObject<SVGSVGElement | null>;
  /** Pan/zoom affordances: grab cursor + touch-action none. */
  interactive?: boolean;
  /** Disables the transform transition while a drag is in flight. */
  isDragging?: boolean;
  /**
   * CSS cursor over the map. Overrides the default grab/grabbing pair — an
   * editor uses it to show which tool is armed, so the pointer itself answers
   * "what happens if I click here?".
   */
  cursor?: string;
  /**
   * Click on empty map, in map coordinates. Suppressed after drags, and a
   * graceful no-op where no CTM exists (jsdom). For gesture-aware taps prefer
   * useMapCamera's onTap.
   */
  onMapClick?: (point: MapPoint) => void;
  /** Fires with the measured container size (initially and on resize). */
  onContainerResize?: (size: { width: number; height: number }) => void;
  /** Layers, rendered inside the camera group in map coordinates. */
  children?: ReactNode;
  /** Sizes the map — the container is position:relative; give it a height. */
  className?: string;
  ariaLabel?: string;
}

export const MapCanvas = ({
  space = DEFAULT_FLOOR_SPACE,
  camera = IDENTITY_CAMERA,
  handlers,
  svgRef,
  interactive = false,
  isDragging = false,
  cursor,
  onMapClick,
  onContainerResize,
  children,
  className,
  ariaLabel,
}: MapCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const resolvedSvgRef = svgRef ?? internalSvgRef;

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const onResizeRef = useRef(onContainerResize);
  onResizeRef.current = onContainerResize;

  const [, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Only commit genuine changes: ResizeObserver fires on layout passes
      // that often report identical dimensions, and re-setting the same
      // object would re-render every layer for nothing.
      setContainerSize((current) => {
        if (current.width === rect.width && current.height === rect.height) {
          return current;
        }
        const next = { width: rect.width, height: rect.height };
        onResizeRef.current?.(next);
        return next;
      });
    };

    measure();

    // ResizeObserver is the accurate signal (containers resize on layout
    // changes, not just window resizes), but it is absent in jsdom and older
    // browsers — fall back to a window listener rather than throwing.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Click-vs-drag guard for onMapClick: a click that follows a pan would
  // otherwise fire with whatever point the pointer was released on.
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDownCapture = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      pressStart.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!onMapClick) return;
      const start = pressStart.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
        return;
      }
      const svg = resolvedSvgRef.current;
      if (!svg) return;
      const point = screenToMap(e.clientX, e.clientY, svg, cameraRef.current);
      if (point) onMapClick(point);
    },
    [onMapClick, resolvedSvgRef],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-xl border border-line-strong bg-surface-2',
        className,
      )}
      // touch-action none so the browser hands us pinch/drag instead of
      // scrolling the page while the user works the map.
      style={interactive ? { touchAction: 'none' } : undefined}
    >
      <svg
        ref={resolvedSvgRef}
        role="img"
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full"
        style={{
          // Dragging always wins: whatever tool is armed, a pan in flight
          // should read as a pan.
          cursor: isDragging
            ? 'grabbing'
            : (cursor ?? (interactive ? 'grab' : undefined)),
        }}
        viewBox={`0 0 ${space.width} ${space.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDownCapture={handlePointerDownCapture}
        onClick={onMapClick ? handleClick : undefined}
        {...handlers}
      >
        <g
          // CSS transform (px = user units in SVG) so the short transition can
          // smooth wheel steps; origin 0 0 keeps the camera math exact. The
          // matrix used for hit-testing comes from the outer svg, so this
          // transform never leaks into coordinate conversion.
          style={{
            transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {children}
        </g>
      </svg>
    </div>
  );
};

export default MapCanvas;
