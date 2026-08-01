import { memo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { NODE_GLYPH_PATHS, NODE_THEME } from '../mapTheme';
import type { MapNode } from '../types';

/* ============================================================================
   NodeLayer — graph nodes as markers with halo labels.
   ----------------------------------------------------------------------------
   Each node renders an invisible hit circle (r ≥ 16 map units, a real touch
   target), the visible themed marker with its meaning-carrying glyph, an
   optional selection ring, and a halo label (white stroke behind the text —
   the pattern that keeps labels readable over any floor plan). Labels hide
   below a zoom threshold so a zoomed-out map doesn't collapse into text soup.
   ========================================================================= */

export interface NodeLayerProps {
  nodes: MapNode[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onNodeClick?: (node: MapNode) => void;
  /** For editor drag flows; fires before click, does not stop panning. */
  onNodePointerDown?: (node: MapNode, e: ReactPointerEvent<SVGGElement>) => void;
  /** Master switch for labels. Default true. */
  showLabels?: boolean;
  /** Current camera scale — pair with labelMinScale to declutter. */
  scale?: number;
  /** Labels hide while scale < labelMinScale. Default 0.75. */
  labelMinScale?: number;
}

const HIT_RADIUS = 16;
const GLYPH_SCALE = 0.42;

const NodeLayerImpl = ({
  nodes,
  selectedId = null,
  hoveredId = null,
  onNodeClick,
  onNodePointerDown,
  showLabels = true,
  scale = 1,
  labelMinScale = 0.75,
}: NodeLayerProps) => {
  const labelsVisible = showLabels && scale >= labelMinScale;

  return (
    <g data-testid="node-layer">
      {nodes.map((node) => {
        const theme = NODE_THEME[node.type];
        const selected = node.id === selectedId;
        const hovered = node.id === hoveredId;
        const radius = selected ? 11 : hovered ? 10 : 9;

        return (
          <g
            key={node.id}
            data-node-id={node.id}
            data-node-type={node.type}
            className={onNodeClick ? 'cursor-pointer' : undefined}
            onClick={
              onNodeClick
                ? (e) => {
                    // A node click is not a map click.
                    e.stopPropagation();
                    onNodeClick(node);
                  }
                : undefined
            }
            onPointerDown={
              onNodePointerDown
                ? (e) => onNodePointerDown(node, e)
                : undefined
            }
          >
            {selected ? (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 5}
                fill="none"
                stroke="var(--ring)"
                strokeWidth={2}
              />
            ) : null}
            <circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={theme.fill}
              stroke="var(--canvas)"
              strokeWidth={2}
            />
            {theme.glyph ? (
              <g
                transform={`translate(${node.x - 12 * GLYPH_SCALE} ${node.y - 12 * GLYPH_SCALE}) scale(${GLYPH_SCALE})`}
                className="pointer-events-none"
              >
                <path
                  d={NODE_GLYPH_PATHS[theme.glyph]}
                  fill="none"
                  stroke="var(--canvas)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
            {labelsVisible && node.label ? (
              <text
                x={node.x}
                y={node.y - radius - 6}
                textAnchor="middle"
                fill="var(--ink)"
                // Halo: canvas-colored stroke painted behind the fill keeps
                // the label readable over any map artwork.
                stroke="var(--canvas)"
                strokeWidth={3}
                paintOrder="stroke"
                fontSize={13}
                fontWeight={600}
                className="pointer-events-none select-none"
              >
                {node.label}
              </text>
            ) : null}
            {/* Hit target last so it sits on top; r >= 16 map units keeps
                nodes tappable on phones. */}
            <circle
              cx={node.x}
              cy={node.y}
              r={HIT_RADIUS}
              fill="transparent"
              stroke="none"
            />
          </g>
        );
      })}
    </g>
  );
};

/** Memoized: drag frames update one layer's props; the others must not pay. */
export const NodeLayer = memo(NodeLayerImpl);

export default NodeLayer;
