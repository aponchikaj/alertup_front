import { CURRENT_LOCATION_COLOR } from '../mapTheme';
import type { MapPoint } from '../mapSpace';

/* ============================================================================
   UserDotLayer — "you are here".
   ----------------------------------------------------------------------------
   The pulse is an SVG-safe reimplementation of the design system's pulse-ring:
   animating a <circle>'s `r` is unreliable across browsers, so a fixed-radius
   ring is scaled instead, with `transform-box: fill-box` + `transform-origin:
   center` so the scale happens about the dot rather than the viewBox origin.
   ========================================================================= */

export interface UserDotLayerProps {
  /** Position in map coordinates; null renders nothing. */
  position: MapPoint | null;
  label?: string;
  /** Set false for print/static output. Default true. */
  animated?: boolean;
}

export const UserDotLayer = ({
  position,
  label,
  animated = true,
}: UserDotLayerProps) => {
  if (!position) return null;

  return (
    <g data-testid="user-dot-layer" className="pointer-events-none">
      {animated ? (
        <circle
          cx={position.x}
          cy={position.y}
          r={10}
          fill="none"
          stroke={CURRENT_LOCATION_COLOR}
          strokeWidth={3}
          className="map-user-pulse"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ) : null}
      <circle
        cx={position.x}
        cy={position.y}
        r={10}
        fill={CURRENT_LOCATION_COLOR}
        stroke="var(--canvas)"
        strokeWidth={3}
      />
      {label ? (
        <text
          x={position.x}
          y={position.y - 20}
          textAnchor="middle"
          fill="var(--ink)"
          stroke="var(--canvas)"
          strokeWidth={3}
          paintOrder="stroke"
          fontSize={13}
          fontWeight={700}
          className="select-none"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

export default UserDotLayer;
