import { memo } from 'react';
import { NODE_GLYPH_PATHS, NODE_THEME } from '../mapTheme';
import type { MapNode, Poi } from '../types';

/* ============================================================================
   PoiLayer — shop/amenity pins with names.
   ----------------------------------------------------------------------------
   A mall floor carries dozens of POIs, so labels are decluttered by zoom: the
   pins stay visible (they are the destinations people look for), the names
   appear once the map is zoomed in enough to read them without overlap.
   ========================================================================= */

export interface PoiLayerProps {
  pois: Poi[];
  /** Node lookup for positions — POIs are anchored to graph nodes. */
  nodesById: Map<string, MapNode>;
  /** Current camera scale, for label decluttering. */
  scale?: number;
  /** Names appear at or above this scale. Default 1. */
  labelMinScale?: number;
  selectedPoiId?: string | null;
  onPoiClick?: (poi: Poi, node: MapNode) => void;
}

const PIN_SCALE = 0.9;

const PoiLayerImpl = ({
  pois,
  nodesById,
  scale = 1,
  labelMinScale = 1,
  selectedPoiId = null,
  onPoiClick,
}: PoiLayerProps) => {
  const labelsVisible = scale >= labelMinScale;

  return (
    <g data-testid="poi-layer">
      {pois.map((poi) => {
        const node = nodesById.get(poi.nodeId);
        // A POI whose node was deleted has nothing to anchor to.
        if (!node) return null;

        const selected = poi.id === selectedPoiId;

        return (
          <g
            key={poi.id}
            data-poi-id={poi.id}
            className={onPoiClick ? 'cursor-pointer' : undefined}
            onClick={
              onPoiClick
                ? (e) => {
                    e.stopPropagation();
                    onPoiClick(poi, node);
                  }
                : undefined
            }
          >
            {/* The pin sits above the node so it does not hide the graph
                marker underneath it. */}
            <g
              transform={`translate(${node.x - 12 * PIN_SCALE} ${node.y - 30 * PIN_SCALE}) scale(${PIN_SCALE})`}
              className="pointer-events-none"
            >
              <path
                d={NODE_GLYPH_PATHS.poi}
                fill="var(--canvas)"
                stroke={NODE_THEME.POI.fill}
                strokeWidth={selected ? 2.5 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            {labelsVisible ? (
              <text
                x={node.x}
                y={node.y - 32}
                textAnchor="middle"
                fill="var(--ink)"
                stroke="var(--canvas)"
                strokeWidth={3}
                paintOrder="stroke"
                fontSize={13}
                fontWeight={600}
                className="pointer-events-none select-none"
              >
                {poi.name}
              </text>
            ) : null}
            <circle cx={node.x} cy={node.y - 18} r={18} fill="transparent" />
          </g>
        );
      })}
    </g>
  );
};

/** Memoized: drag frames update one layer's props; the others must not pay. */
export const PoiLayer = memo(PoiLayerImpl);

export default PoiLayer;
