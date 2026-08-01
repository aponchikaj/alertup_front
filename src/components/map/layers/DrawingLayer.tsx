import { memo, Fragment } from 'react';
import {
  DRAWING_DEFAULTS,
  DRAWING_ICON_COLORS,
  DRAWING_ICON_PATHS,
} from '../mapTheme';
import {
  isBoxShape,
  RESIZE_HANDLES,
  shapeBounds,
  type DrawingShape,
  type FloorDrawing,
  type ResizeHandle,
} from '../drawing';

/* ============================================================================
   DrawingLayer — the hand-drawn floor plan.
   ----------------------------------------------------------------------------
   Sits where an uploaded plan image would: below the graph layers, in map
   coordinates. The same component renders in the editor and in the visitor
   map, which is the point — what an owner draws is exactly what a visitor
   sees, with no second rendering path to drift.

   Interactivity is opt-in via `onShapeClick`/`selectedShapeId`. With neither,
   this is inert artwork and every element is pointer-events:none so it can
   never swallow a click meant for a node.
   ========================================================================= */

export interface DrawingLayerProps {
  drawing: FloorDrawing | null;
  /** Editor only: outlines the selected shape and enables hit-testing. */
  selectedShapeId?: string | null;
  onShapeClick?: (shape: DrawingShape) => void;
  onShapePointerDown?: (
    shape: DrawingShape,
    e: React.PointerEvent<SVGGElement>,
  ) => void;
  /** Editor only: press on a corner handle of the selected box or icon. */
  onResizePointerDown?: (
    shape: DrawingShape,
    handle: ResizeHandle,
    e: React.PointerEvent<SVGRectElement>,
  ) => void;
  /** Editor only: press on a vertex handle of the selected wall — dragging
   *  it reshapes the run instead of moving the whole line. */
  onWallVertexPointerDown?: (
    shape: DrawingShape,
    vertexIndex: number,
    e: React.PointerEvent<SVGCircleElement>,
  ) => void;
  /** Current camera scale, so labels and outlines stay legible when zoomed. */
  scale?: number;
  /**
   * Cursor over a shape. Defaults to a pointer, but a tool whose meaning is
   * "this click destroys what it lands on" needs to keep saying so when the
   * pointer crosses a shape, not switch to the friendly hand.
   */
  shapeCursor?: string;
}

/** Labels shrink as you zoom in so they keep a roughly constant screen size. */
const counterScale = (scale: number): number => 1 / Math.max(scale, 0.4);

/** Render one 24px-grid glyph centred on (x, y) at `size` map units. */
const Glyph = ({
  path,
  x,
  y,
  size,
  color,
  rotation,
}: {
  path: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation?: number;
}) => {
  const k = size / 24;
  const spin = rotation ? ` rotate(${rotation} ${x} ${y})` : '';
  return (
    <g transform={`${spin}translate(${x - 12 * k} ${y - 12 * k}) scale(${k})`}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

/**
 * A shop's logo, clipped into its box.
 *
 * `preserveAspectRatio="xMidYMid meet"` rather than `slice`: a tenant logo
 * that gets cropped reads as a rendering bug, whereas letterboxing reads as
 * deliberate. Broken/missing images simply do not paint — no error state is
 * shown over the plan.
 */
const ShopLogo = ({
  href,
  x,
  y,
  width,
  height,
  clipId,
}: {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clipId: string;
}) => {
  // Inset so the logo never touches the box border.
  const pad = Math.min(width, height) * 0.15;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={3} />
        </clipPath>
      </defs>
      <image
        href={href}
        x={x + pad}
        y={y + pad}
        width={Math.max(width - pad * 2, 1)}
        height={Math.max(height - pad * 2, 1)}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />
    </>
  );
};

/** Centred, clipped box label. Hidden when the box is too small to hold text. */
const BoxLabel = ({
  text,
  x,
  y,
  width,
  height,
  scale,
  offsetY = 0,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  offsetY?: number;
}) => {
  const k = counterScale(scale);
  const fontSize = 13 * k;
  // Below this the label is unreadable and just muddies the plan.
  if (height < fontSize * 1.4 || width < fontSize * 2) return null;

  // Rough character budget — cheaper and steadier than measuring text.
  const maxChars = Math.max(Math.floor(width / (fontSize * 0.58)), 3);
  const display = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + offsetY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight={600}
      fill="var(--ink)"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {display}
    </text>
  );
};

const ShapeView = ({ shape, scale }: { shape: DrawingShape; scale: number }) => {
  switch (shape.kind) {
    case 'wall': {
      const points = [];
      for (let i = 0; i + 1 < shape.points.length; i += 2) {
        points.push(`${shape.points[i]},${shape.points[i + 1]}`);
      }
      return (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={DRAWING_DEFAULTS.wallColor}
          strokeWidth={shape.thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    case 'room':
      return (
        <>
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={3}
            fill={shape.fill ?? DRAWING_DEFAULTS.roomFill}
            stroke={shape.stroke ?? DRAWING_DEFAULTS.roomStroke}
            strokeWidth={DRAWING_DEFAULTS.shapeStrokeWidth}
          />
          {shape.name && (
            <BoxLabel
              text={shape.name}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              scale={scale}
            />
          )}
        </>
      );

    case 'shop': {
      const hasLogo = Boolean(shape.logoUrl);
      // With a logo the name sits under it rather than through it.
      const labelOffset = hasLogo ? shape.height * 0.34 : 0;
      const logoHeight = hasLogo ? shape.height * (shape.name ? 0.62 : 1) : 0;
      return (
        <>
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={3}
            fill={shape.fill ?? DRAWING_DEFAULTS.shopFill}
            stroke={shape.stroke ?? DRAWING_DEFAULTS.shopStroke}
            strokeWidth={DRAWING_DEFAULTS.shapeStrokeWidth}
          />
          {shape.logoUrl && (
            <ShopLogo
              href={shape.logoUrl}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={logoHeight}
              clipId={`logo-clip-${shape.id}`}
            />
          )}
          {shape.name && (
            <BoxLabel
              text={shape.name}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              scale={scale}
              offsetY={labelOffset}
            />
          )}
        </>
      );
    }

    case 'icon': {
      const color = DRAWING_ICON_COLORS[shape.icon];
      return (
        <>
          {/* Plate behind the glyph so it reads over any room fill. */}
          <circle
            cx={shape.x}
            cy={shape.y}
            r={shape.size * 0.7}
            fill="var(--surface)"
            stroke={color}
            strokeWidth={1.5}
          />
          <Glyph
            path={DRAWING_ICON_PATHS[shape.icon]}
            x={shape.x}
            y={shape.y}
            size={shape.size}
            color={color}
            rotation={shape.rotation}
          />
        </>
      );
    }

    case 'text':
      return (
        <text
          x={shape.x}
          y={shape.y}
          fontSize={shape.fontSize}
          fill="var(--ink)"
          style={{ userSelect: 'none' }}
        >
          {shape.text}
        </text>
      );

    case 'outline': {
      // The floor's footprint. Inverted fill: the INSIDE stays untouched so
      // the gridded canvas shows through (that grid is the drawing surface,
      // not decoration), while everything OUTSIDE the polygon is masked to
      // the page background — an even-odd path of a huge rect minus the
      // footprint. Never interactive here; reshaping is Floor-size mode's
      // job.
      let d = 'M -100000 -100000 H 200000 V 200000 H -100000 Z M';
      for (let i = 0; i + 1 < shape.points.length; i += 2) {
        d += ` ${shape.points[i]} ${shape.points[i + 1]}`;
      }
      d += ' Z';
      const pts: string[] = [];
      for (let i = 0; i + 1 < shape.points.length; i += 2) {
        pts.push(`${shape.points[i]},${shape.points[i + 1]}`);
      }
      return (
        <>
          <path d={d} fillRule="evenodd" fill="var(--canvas)" fillOpacity={0.92} />
          <polygon
            points={pts.join(' ')}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.7}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </>
      );
    }

    default: {
      // Exhaustiveness guard: a new shape kind must be handled above, not
      // silently dropped at runtime.
      const never: never = shape;
      return never;
    }
  }
};

const DrawingLayerImpl = ({
  drawing,
  selectedShapeId = null,
  onShapeClick,
  onShapePointerDown,
  onResizePointerDown,
  onWallVertexPointerDown,
  scale = 1,
  shapeCursor = 'pointer',
}: DrawingLayerProps) => {
  if (!drawing || drawing.shapes.length === 0) return null;

  const interactive = Boolean(onShapeClick || onShapePointerDown);

  return (
    <g
      data-testid="drawing-layer"
      // Non-interactive usage (the visitor map) must never intercept a press
      // aimed at a node underneath.
      style={interactive ? undefined : { pointerEvents: 'none' }}
    >
      {/* The footprint underlays every shape regardless of array order, and
          takes no pointer events — it is the paper. */}
      {drawing.shapes
        .filter((shape) => shape.kind === 'outline')
        .map((shape) => (
          <g key={shape.id} style={{ pointerEvents: 'none' }}>
            <ShapeView shape={shape} scale={scale} />
          </g>
        ))}
      {drawing.shapes.filter((shape) => shape.kind !== 'outline').map((shape) => {
        const selected = shape.id === selectedShapeId;
        return (
          <Fragment key={shape.id}>
            <g
              data-shape-id={shape.id}
              style={{ cursor: interactive ? shapeCursor : undefined }}
              onClick={onShapeClick ? () => onShapeClick(shape) : undefined}
              onPointerDown={
                onShapePointerDown ? (e) => onShapePointerDown(shape, e) : undefined
              }
            >
              <ShapeView shape={shape} scale={scale} />
            </g>
            {selected && (
              <SelectionOutline
                shape={shape}
                scale={scale}
                onResizePointerDown={onResizePointerDown}
                onWallVertexPointerDown={onWallVertexPointerDown}
              />
            )}
          </Fragment>
        );
      })}
    </g>
  );
};

/** Cursor per corner, so the handle looks like what it does. */
const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

/** Dashed box around the selected shape, plus corner handles on boxes. Drawn
 *  after every shape so it is never painted over by an overlapping neighbour. */
const SelectionOutline = ({
  shape,
  scale,
  onResizePointerDown,
  onWallVertexPointerDown,
}: {
  shape: DrawingShape;
  scale: number;
  onResizePointerDown?: DrawingLayerProps['onResizePointerDown'];
  onWallVertexPointerDown?: DrawingLayerProps['onWallVertexPointerDown'];
}) => {
  const bounds = shapeBounds(shape);
  const k = counterScale(scale);
  const pad = 4 * k;
  // Boxes resize from all four corners; icons scale from their south-east
  // corner (one size, not a free rectangle); walls reshape vertex by vertex.
  const resizable =
    (isBoxShape(shape) || shape.kind === 'icon') && Boolean(onResizePointerDown);
  const handles: ResizeHandle[] = isBoxShape(shape) ? [...RESIZE_HANDLES] : ['se'];
  const handleSize = 9 * k;

  const corners: Record<ResizeHandle, { x: number; y: number }> = {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  };

  return (
    <g>
      <rect
        x={bounds.x - pad}
        y={bounds.y - pad}
        width={bounds.width + pad * 2}
        height={bounds.height + pad * 2}
        fill="none"
        stroke={DRAWING_DEFAULTS.selectionColor}
        strokeWidth={2 * k}
        strokeDasharray={`${6 * k} ${4 * k}`}
        rx={4}
        style={{ pointerEvents: 'none' }}
      />
      {shape.kind === 'wall' &&
        onWallVertexPointerDown &&
        Array.from({ length: Math.floor(shape.points.length / 2) }, (_, index) => (
          <circle
            key={`v${index}`}
            data-wall-vertex={index}
            cx={shape.points[index * 2]}
            cy={shape.points[index * 2 + 1]}
            r={5.5 * k}
            fill="var(--surface)"
            stroke={DRAWING_DEFAULTS.selectionColor}
            strokeWidth={2 * k}
            style={{ cursor: 'move' }}
            onPointerDown={(e) => onWallVertexPointerDown(shape, index, e)}
          />
        ))}
      {resizable &&
        handles.map((handle) => (
          <rect
            key={handle}
            data-resize-handle={handle}
            x={corners[handle].x - handleSize / 2}
            y={corners[handle].y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            rx={2 * k}
            fill="var(--surface)"
            stroke={DRAWING_DEFAULTS.selectionColor}
            strokeWidth={2 * k}
            style={{ cursor: HANDLE_CURSORS[handle] }}
            onPointerDown={(e) => onResizePointerDown?.(shape, handle, e)}
          />
        ))}
    </g>
  );
};

/** Memoized: drag frames update one layer's props; the others must not pay. */
export const DrawingLayer = memo(DrawingLayerImpl);

export default DrawingLayer;
