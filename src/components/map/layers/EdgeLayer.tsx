import { TRANSIT_GLYPH_PATHS } from '../mapTheme';
import type { MapEdge, MapNode, TransitType } from '../types';

/* ============================================================================
   EdgeLayer — graph connections between nodes.
   ----------------------------------------------------------------------------
   WALKWAY edges are plain solid lines; vertical transits (stairs / escalator /
   elevator) are dashed and carry a midpoint glyph naming the transit type, so
   the distinction survives without color. Inaccessible edges get their own
   dash rhythm plus a <title> tooltip.
   ========================================================================= */

export interface EdgeLayerProps {
  edges: MapEdge[];
  nodesById: Map<string, MapNode>;
  /** Marks accessible=false edges (distinct dashes + tooltip). Default true. */
  showAccessibility?: boolean;
  /** Tooltip for inaccessible edges. Localize via this prop. */
  inaccessibleLabel?: string;
  /** Editor only: highlighted edge. */
  selectedEdgeId?: string | null;
  /**
   * Editor only: makes edges clickable. A 14-unit invisible hit line backs
   * each visible one — a 2px stroke is an impossible click target.
   */
  onEdgeClick?: (edge: MapEdge) => void;
}

const isTransit = (t: TransitType): t is Exclude<TransitType, 'WALKWAY'> =>
  t !== 'WALKWAY';

/** Glyph render scale: 24-grid paths drawn at ~11px on the map. */
const GLYPH_SCALE = 0.45;

export const EdgeLayer = ({
  edges,
  nodesById,
  showAccessibility = true,
  inaccessibleLabel = 'Not wheelchair accessible',
  selectedEdgeId = null,
  onEdgeClick,
}: EdgeLayerProps) => (
  <g data-testid="edge-layer">
    {edges.map((edge) => {
      const source = nodesById.get(edge.sourceNodeId);
      const target = nodesById.get(edge.targetNodeId);
      if (!source || !target) return null;

      // Keep the narrowed type, not just a boolean: the glyph lookup is keyed
      // on the non-walkway union.
      const transitType = isTransit(edge.transitType) ? edge.transitType : null;
      const transit = transitType !== null;
      const flagged = showAccessibility && !edge.accessible;
      const selected = edge.id === selectedEdgeId;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      return (
        <g key={edge.id} data-edge-id={edge.id}>
          <line
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={selected ? 'var(--brand)' : 'var(--line-strong)'}
            strokeWidth={selected ? 3.5 : transit ? 2.5 : 2}
            strokeLinecap="round"
            // Three visually distinct treatments: solid walkway, long-dash
            // transit, dot-dash inaccessible.
            strokeDasharray={flagged ? '2 6' : transit ? '7 5' : undefined}
            opacity={selected ? 1 : 0.9}
          >
            {flagged ? <title>{inaccessibleLabel}</title> : null}
          </line>
          {onEdgeClick && (
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="transparent"
              strokeWidth={14}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onClick={() => onEdgeClick(edge)}
            />
          )}
          {transitType ? (
            <g
              transform={`translate(${midX - 12 * GLYPH_SCALE} ${midY - 12 * GLYPH_SCALE}) scale(${GLYPH_SCALE})`}
              className="pointer-events-none"
            >
              {/* Chip behind the glyph so it stays legible over the plan. */}
              <circle
                cx={12}
                cy={12}
                r={13}
                fill="var(--surface)"
                stroke="var(--line-strong)"
                strokeWidth={1.5}
              />
              <path
                d={TRANSIT_GLYPH_PATHS[transitType]}
                fill="none"
                stroke="var(--info)"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}
        </g>
      );
    })}
  </g>
);

export default EdgeLayer;
