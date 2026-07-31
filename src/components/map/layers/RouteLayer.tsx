import { useMemo } from 'react';
import { ROUTE_TONES, type RouteTone } from '../mapTheme';
import type { RouteSegment } from '../types';

/* ============================================================================
   RouteLayer — the walking path for one floor segment.
   ----------------------------------------------------------------------------
   Animation is pure CSS (keyframes `route-draw` and `route-march` in
   index.css), deliberately: the anime.js page hook scans the DOM once on
   mount, so it never sees content that arrives with a fetch — and this layer
   always arrives with a fetch. CSS also honours the global reduced-motion
   kill-switch without any JS branch, which matters on the scan route page
   where motion is restricted by policy.
   ========================================================================= */

export interface RouteLayerProps {
  /** The segment to draw; null renders nothing. */
  segment: RouteSegment | null;
  /** brand for wayfinding, danger for evacuation. Default brand. */
  tone?: RouteTone;
  /** Casing + line width in map units. Default 5. */
  strokeWidth?: number;
  /** Set false to render a static line (e.g. print). Default true. */
  animated?: boolean;
}

export const RouteLayer = ({
  segment,
  tone = 'brand',
  strokeWidth = 5,
  animated = true,
}: RouteLayerProps) => {
  const path = useMemo(() => {
    if (!segment || segment.nodes.length < 2) return null;
    return segment.nodes
      .map((node, i) => `${i === 0 ? 'M' : 'L'} ${node.x} ${node.y}`)
      .join(' ');
  }, [segment]);

  if (!path || !segment) return null;

  const color = ROUTE_TONES[tone];
  const first = segment.nodes[0];
  const last = segment.nodes[segment.nodes.length - 1];

  return (
    <g data-testid="route-layer" className="pointer-events-none">
      {/* Casing: a canvas-colored underlay so the route stays legible over a
          busy floor plan, the same trick as the halo on node labels. */}
      <path
        d={path}
        fill="none"
        stroke="var(--canvas)"
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // pathLength normalizes the geometry to 1 unit, so the draw-on
        // keyframes work identically for a 20px hop and a 2000px corridor.
        pathLength={animated ? 1 : undefined}
        className={animated ? 'route-path-draw' : undefined}
      />
      {/* Marching dashes on top convey direction of travel. */}
      {animated ? (
        <path
          d={path}
          fill="none"
          stroke="var(--canvas)"
          strokeWidth={strokeWidth * 0.45}
          strokeLinecap="round"
          strokeDasharray="6 14"
          opacity={0.9}
          className="route-path-march"
        />
      ) : null}
      {/* Start cap and destination marker anchor the two ends of the leg. */}
      <circle cx={first.x} cy={first.y} r={strokeWidth} fill={color} />
      <circle
        cx={last.x}
        cy={last.y}
        r={strokeWidth + 3}
        fill="none"
        stroke={color}
        strokeWidth={3}
      />
      <circle cx={last.x} cy={last.y} r={strokeWidth - 1} fill={color} />
    </g>
  );
};

export default RouteLayer;
