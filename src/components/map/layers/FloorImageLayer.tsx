import { useId } from 'react';
import { sanitizeSvg } from '../../../lib/sanitizeSvg';
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
  /** Placeholder text when the floor has no map. Localize via this prop. */
  placeholderLabel?: string;
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
        <pattern
          id={patternId}
          width={50}
          height={50}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 50 0 L 0 0 0 50"
            fill="none"
            stroke="var(--line)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        fill={`url(#${patternId})`}
      />
      <text
        x={space.width / 2}
        y={space.height / 2}
        textAnchor="middle"
        fill="var(--ink-muted)"
        fontSize={18}
      >
        {placeholderLabel}
      </text>
    </g>
  );
};

export default FloorImageLayer;
