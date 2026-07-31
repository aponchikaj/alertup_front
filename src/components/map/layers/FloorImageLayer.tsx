import { useId } from 'react';
import { sanitizeSvg } from '../../../lib/sanitizeSvg';
import { GRID_MAJOR_EVERY, GRID_STEP } from '../drawing';
import type { FloorSpace } from '../mapSpace';
import type { FloorRecord } from '../types';

/* ============================================================================
   FloorImageLayer — the floor plan itself, lowest layer in the stack.
   ----------------------------------------------------------------------------
   Priority: raster/remote image → inline SVG markup → generated grid
   placeholder. Inline markup is uploaded by building owners and rendered to
   anonymous visitors, so it always goes through sanitizeSvg before injection.
   ========================================================================= */

export interface FloorImageLayerProps {
  floor: FloorRecord | null;
  space: FloorSpace;
  /**
   * Placeholder text when the floor has no map. Localize via this prop, or
   * pass `null` on a hand-drawn floor — there the empty grid is the canvas the
   * user asked for, not a missing asset to apologise for.
   */
  placeholderLabel?: string | null;
}

export const FloorImageLayer = ({
  floor,
  space,
  placeholderLabel = 'No floor map available',
}: FloorImageLayerProps) => {
  // Unique per instance — multiple maps on one page must not share pattern ids.
  const patternId = useId();

  if (floor?.mapImageUrl) {
    return (
      <image
        href={floor.mapImageUrl}
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  if (floor?.svgContent) {
    return (
      // Sanitized: owner-uploaded markup served to every visitor cannot be
      // trusted as-is.
      <g dangerouslySetInnerHTML={{ __html: sanitizeSvg(floor.svgContent) }} />
    );
  }

  // Graph-paper canvas. The minor spacing is GRID_STEP exactly, because that
  // is also what every drawing gesture snaps to — so each snap lands on a line
  // that is actually on screen.
  const major = GRID_STEP * GRID_MAJOR_EVERY;

  return (
    <g data-testid="floor-placeholder">
      <rect
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        fill="var(--surface-2)"
      />
      <defs>
        {/* Grid lines are drawn in the text colour at low opacity rather than
            in the border tokens: those are tuned for UI chrome and wash out
            against the canvas, which left people unsure where the cells were.
            Opacity keeps it legible in both light and dark themes. */}
        <pattern
          id={`${patternId}-minor`}
          width={GRID_STEP}
          height={GRID_STEP}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        </pattern>
        <pattern
          id={`${patternId}-major`}
          width={major}
          height={major}
          patternUnits="userSpaceOnUse"
        >
          <rect width={major} height={major} fill={`url(#${patternId}-minor)`} />
          <path
            d={`M ${major} 0 L 0 0 0 ${major}`}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />
        </pattern>
      </defs>
      <rect
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        fill={`url(#${patternId}-major)`}
      />
      {/* Hard edge on the floor itself, so the drawable area is unmistakable
          and shapes near the boundary do not look like they float off. */}
      <rect
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        fill="none"
        stroke="var(--ink)"
        strokeOpacity={0.65}
        strokeWidth={2}
      />
      {placeholderLabel && (
        <text
          x={space.width / 2}
          y={space.height / 2}
          textAnchor="middle"
          fill="var(--ink-muted)"
          fontSize={18}
        >
          {placeholderLabel}
        </text>
      )}
    </g>
  );
};

export default FloorImageLayer;
