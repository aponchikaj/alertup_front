import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  DRAWING_DEFAULTS,
  rectFromPoints,
  type FloorSpace,
  type MapPoint,
} from '../../../components/map';

/**
 * Floor-size mode's affordances: a highlighted canvas border with grab
 * handles on the right edge, bottom edge and corner, plus a live size chip.
 * The canvas grows from its fixed origin, so only those three sides drag.
 */
export const FloorResizeLayer = ({
  space,
  scale,
  metersLabel,
  outlinePoints,
  onBegin,
  onVertexDown,
  onMidpointDown,
  onVertexDoubleClick,
}: {
  space: FloorSpace;
  scale: number;
  metersLabel: string;
  outlinePoints: number[];
  onBegin: (axis: 'x' | 'y' | 'both', e: ReactPointerEvent<SVGElement>) => void;
  onVertexDown: (vertexIndex: number, e: ReactPointerEvent<SVGElement>) => void;
  onMidpointDown: (segmentIndex: number, e: ReactPointerEvent<SVGElement>) => void;
  onVertexDoubleClick: (vertexIndex: number) => void;
}) => {
  const k = 1 / Math.max(scale, 0.4);
  const grip = 14 * k;
  const half = grip / 2;
  const corners = Math.floor(outlinePoints.length / 2);
  return (
    <g data-testid="floor-resize-layer">
      <rect
        x={0}
        y={0}
        width={space.width}
        height={space.height}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.5 * k}
        strokeDasharray={`${8 * k} ${5 * k}`}
        style={{ pointerEvents: 'none' }}
      />
      {/* Fat invisible strips make the whole edge grabbable, not just the
          visible grip squares. */}
      <rect
        data-canvas-handle="x"
        x={space.width - half}
        y={0}
        width={grip}
        height={space.height}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={(e) => onBegin('x', e)}
      />
      <rect
        data-canvas-handle="y"
        x={0}
        y={space.height - half}
        width={space.width}
        height={grip}
        fill="transparent"
        style={{ cursor: 'ns-resize' }}
        onPointerDown={(e) => onBegin('y', e)}
      />
      <rect
        data-canvas-handle="both"
        x={space.width - grip}
        y={space.height - grip}
        width={grip * 2}
        height={grip * 2}
        fill="transparent"
        style={{ cursor: 'nwse-resize' }}
        onPointerDown={(e) => onBegin('both', e)}
      />
      {/* Visible grips over the hit strips. */}
      {(
        [
          [space.width, space.height / 2],
          [space.width / 2, space.height],
          [space.width, space.height],
        ] as const
      ).map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx - half}
          y={cy - half}
          width={grip}
          height={grip}
          rx={3 * k}
          fill="var(--surface)"
          stroke="var(--brand)"
          strokeWidth={2 * k}
          style={{ pointerEvents: 'none' }}
        />
      ))}
      {/* The footprint being edited. */}
      <polygon
        points={Array.from({ length: corners }, (_, i) =>
          `${outlinePoints[i * 2]},${outlinePoints[i * 2 + 1]}`,
        ).join(' ')}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2 * k}
        style={{ pointerEvents: 'none' }}
      />
      {/* Midpoint splitters: dragging one splits that edge and pulls the new
          corner — how HALF a border moves while the rest stays put. */}
      {Array.from({ length: corners }, (_, i) => {
        const nx = (i + 1) % corners;
        const mx = (outlinePoints[i * 2] + outlinePoints[nx * 2]) / 2;
        const my = (outlinePoints[i * 2 + 1] + outlinePoints[nx * 2 + 1]) / 2;
        return (
          <rect
            key={`m${i}`}
            data-outline-mid={i}
            x={mx - 5 * k}
            y={my - 5 * k}
            width={10 * k}
            height={10 * k}
            transform={`rotate(45 ${mx} ${my})`}
            fill="var(--surface)"
            stroke="var(--brand)"
            strokeWidth={1.5 * k}
            style={{ cursor: 'copy' }}
            onPointerDown={(e) => onMidpointDown(i, e)}
          />
        );
      })}
      {/* Corner handles: drag to move, double-tap to remove. */}
      {Array.from({ length: corners }, (_, i) => (
        <circle
          key={`v${i}`}
          data-outline-vertex={i}
          cx={outlinePoints[i * 2]}
          cy={outlinePoints[i * 2 + 1]}
          r={6.5 * k}
          fill="var(--surface)"
          stroke="var(--brand)"
          strokeWidth={2 * k}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => onVertexDown(i, e)}
          onDoubleClick={() => onVertexDoubleClick(i)}
        />
      ))}
      {/* Live size, pinned to the corner being dragged. */}
      <g
        transform={`translate(${space.width - 8 * k} ${space.height - 14 * k}) scale(${k})`}
        style={{ pointerEvents: 'none' }}
      >
        <text textAnchor="end" fontSize={14} fontWeight={700} fill="var(--brand)">
          {metersLabel}
        </text>
      </g>
    </g>
  );
};

export interface DraftLayerProps {
  boxDraft: { start: MapPoint; current: MapPoint } | null;
  wallPoints: number[];
  wallCursor: MapPoint | null;
  /** Connection being dragged from a node towards its target. */
  edgeGhost: { from: MapPoint; to: MapPoint } | null;
}

/**
 * The in-progress gesture: the rubber band while a box is being sized, and the
 * wall run with a ghost segment to the cursor. Never persisted — this is what
 * the user is doing, not what they have done.
 */
export const DraftLayer = ({ boxDraft, wallPoints, wallCursor, edgeGhost }: DraftLayerProps) => {
  const rect = boxDraft ? rectFromPoints(boxDraft.start, boxDraft.current) : null;

  const wall: string[] = [];
  for (let i = 0; i + 1 < wallPoints.length; i += 2) {
    wall.push(`${wallPoints[i]},${wallPoints[i + 1]}`);
  }
  const ghost =
    wallCursor && wallPoints.length >= 2
      ? `${wallPoints[wallPoints.length - 2]},${wallPoints[wallPoints.length - 1]} ${wallCursor.x},${wallCursor.y}`
      : null;

  return (
    <g style={{ pointerEvents: 'none' }} data-testid="draft-layer">
      {edgeGhost && (
        <line
          x1={edgeGhost.from.x}
          y1={edgeGhost.from.y}
          x2={edgeGhost.to.x}
          y2={edgeGhost.to.y}
          stroke="var(--brand)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="7 5"
          opacity={0.8}
        />
      )}
      {rect && (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={3}
          fill={DRAWING_DEFAULTS.roomFill}
          fillOpacity={0.6}
          stroke={DRAWING_DEFAULTS.roomStroke}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}

      {wall.length > 0 && (
        <polyline
          points={wall.join(' ')}
          fill="none"
          stroke={DRAWING_DEFAULTS.wallColor}
          strokeWidth={DRAWING_DEFAULTS.wallThickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.8}
        />
      )}
      {ghost && (
        <polyline
          points={ghost}
          fill="none"
          stroke={DRAWING_DEFAULTS.wallColor}
          strokeWidth={DRAWING_DEFAULTS.wallThickness}
          strokeLinecap="round"
          strokeDasharray="8 6"
          strokeOpacity={0.45}
        />
      )}
      {/* Vertex handles, so it is obvious where the run has been pinned. */}
      {wall.map((point, i) => {
        const [cx, cy] = point.split(',').map(Number);
        return (
          <circle
            key={`${point}-${i}`}
            cx={cx}
            cy={cy}
            r={4}
            fill="var(--surface)"
            stroke={DRAWING_DEFAULTS.wallColor}
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
};
