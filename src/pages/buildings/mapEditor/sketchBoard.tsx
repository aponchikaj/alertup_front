import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { UndoIcon, ZapIcon } from '../../../components/ui/icons';
import { cn } from '../../../lib/cn';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { FloorDrawing } from '../../../components/map';
import type { SketchSize, SketchStroke } from './sketchSummary';

/* ============================================================================
   SketchBoard — draw the map you want, roughly.
   ----------------------------------------------------------------------------
   A freehand pad inside the AI panel: mark where rooms go, drag lines where
   walls and corridors run, hit send. The strokes stay VECTORS — each carries
   the pen mode it was drawn with (area vs line), so the summarizer describes
   intent instead of guessing from loop closure.

   What makes sketching over an existing floor work:

     - the CURRENT floor plan renders underneath as a faint underlay, so the
       user gestures around their real rooms instead of drawing blind;
     - a light grid matches the editor's 25-unit snap, hinting at scale;
     - an eraser removes a mis-drawn stroke without clearing the board.

   Still deliberately crude beyond that: precision belongs in the editor,
   intent belongs here.
   ========================================================================= */

/** Board width in CSS/viewBox units; height follows the floor's aspect. */
const BOARD_WIDTH = 320;

/** Eraser hit radius in board units. */
const ERASE_RADIUS = 12;

type PenMode = 'area' | 'line' | 'erase';

export interface SketchBoardProps {
  open: boolean;
  onClose: () => void;
  /** The active floor's canvas, so sketches scale into real coordinates. */
  space: SketchSize;
  /** Current floor drawing, rendered as a faint underlay to sketch around. */
  underlay?: FloorDrawing | null;
  onSubmit: (strokes: SketchStroke[], board: SketchSize) => void;
}

export const SketchBoard = ({ open, onClose, space, underlay, onSubmit }: SketchBoardProps) => {
  const { t } = useI18n();
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [current, setCurrent] = useState<number[] | null>(null);
  const [mode, setMode] = useState<PenMode>('area');
  const svgRef = useRef<SVGSVGElement>(null);

  const board = useMemo<SketchSize>(() => {
    const ratio = space.height > 0 && space.width > 0 ? space.height / space.width : 0.8;
    return { width: BOARD_WIDTH, height: Math.round(BOARD_WIDTH * ratio) };
  }, [space]);

  /** floor units → board units. */
  const scale = space.width > 0 ? board.width / space.width : 0;
  /** The editor snaps to 25 floor units; the grid shows that rhythm here. */
  const gridStep = 25 * scale;

  const boardPoint = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * board.width,
      y: ((e.clientY - rect.top) / rect.height) * board.height,
    };
  };

  const eraseAt = (x: number, y: number) => {
    setStrokes((all) => {
      // Nearest stroke with any point inside the eraser radius loses.
      let bestIndex = -1;
      let bestDist = ERASE_RADIUS;
      all.forEach((stroke, index) => {
        for (let i = 0; i + 1 < stroke.points.length; i += 2) {
          const d = Math.hypot(stroke.points[i] - x, stroke.points[i + 1] - y);
          if (d < bestDist) {
            bestDist = d;
            bestIndex = index;
          }
        }
      });
      return bestIndex === -1 ? all : all.filter((_, index) => index !== bestIndex);
    });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const point = boardPoint(e);
    if (!point) return;
    if (mode === 'erase') {
      eraseAt(point.x, point.y);
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setCurrent([point.x, point.y]);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!current) return;
    const point = boardPoint(e);
    if (!point) return;
    setCurrent((line) => (line ? [...line, point.x, point.y] : line));
  };

  const onPointerUp = () => {
    setCurrent((line) => {
      if (line && line.length >= 4 && mode !== 'erase') {
        setStrokes((all) => [...all, { points: line, kind: mode }]);
      }
      return null;
    });
  };

  const toPolyline = (points: number[]) => {
    const pts: string[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
      pts.push(`${points[i]},${points[i + 1]}`);
    }
    return pts.join(' ');
  };

  const reset = () => {
    setStrokes([]);
    setCurrent(null);
  };

  const strokeColor = (kind?: 'area' | 'line') =>
    kind === 'line' ? 'var(--ink)' : 'var(--brand)';

  const modes: Array<{ id: PenMode; label: string }> = [
    { id: 'area', label: t('editorAi.sketchArea') },
    { id: 'line', label: t('editorAi.sketchLine') },
    { id: 'erase', label: t('editorAi.sketchErase') },
  ];

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t('editorAi.sketchTitle')}
      closeLabel={t('common.cancel')}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('editorAi.sketchLead')}</p>

        <div role="radiogroup" aria-label={t('editorAi.sketchTitle')} className="flex gap-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                mode === m.id
                  ? 'border-brand bg-brand/10 text-ink'
                  : 'border-line bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <svg
          ref={svgRef}
          data-testid="sketch-board"
          viewBox={`0 0 ${board.width} ${board.height}`}
          className="w-full touch-none rounded-xl border border-line bg-surface-2"
          style={{
            cursor: mode === 'erase' ? 'not-allowed' : 'crosshair',
            aspectRatio: `${board.width} / ${board.height}`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label={t('editorAi.sketchTitle')}
        >
          {/* Grid — the editor's 25-unit rhythm, so gestures land near scale. */}
          {gridStep > 4 && (
            <g stroke="var(--line)" strokeWidth={0.5} opacity={0.5}>
              {Array.from(
                { length: Math.floor(board.width / gridStep) },
                (_, i) => (i + 1) * gridStep,
              ).map((x) => (
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={board.height} />
              ))}
              {Array.from(
                { length: Math.floor(board.height / gridStep) },
                (_, i) => (i + 1) * gridStep,
              ).map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={board.width} y2={y} />
              ))}
            </g>
          )}

          {/* Existing floor plan, faint — sketch around it, not blind. */}
          {scale > 0 && underlay?.shapes && (
            <g opacity={0.35} pointerEvents="none">
              {underlay.shapes.map((shape) => {
                if (shape.kind === 'room' || shape.kind === 'shop') {
                  return (
                    <g key={shape.id}>
                      <rect
                        x={shape.x * scale}
                        y={shape.y * scale}
                        width={shape.width * scale}
                        height={shape.height * scale}
                        fill="var(--ink)"
                        fillOpacity={0.08}
                        stroke="var(--ink)"
                        strokeWidth={0.75}
                      />
                      {shape.name && shape.width * scale > 30 && (
                        <text
                          x={(shape.x + shape.width / 2) * scale}
                          y={(shape.y + shape.height / 2) * scale}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={7}
                          fill="var(--ink)"
                        >
                          {shape.name.slice(0, 12)}
                        </text>
                      )}
                    </g>
                  );
                }
                if (shape.kind === 'wall' || shape.kind === 'outline') {
                  return (
                    <polyline
                      key={shape.id}
                      points={toPolyline(shape.points.map((v) => v * scale))}
                      fill="none"
                      stroke="var(--ink)"
                      strokeWidth={1.25}
                    />
                  );
                }
                if (shape.kind === 'icon') {
                  return (
                    <circle
                      key={shape.id}
                      cx={shape.x * scale}
                      cy={shape.y * scale}
                      r={2.5}
                      fill="var(--brand)"
                    />
                  );
                }
                return null;
              })}
            </g>
          )}

          {strokes.map((stroke, index) =>
            stroke.kind === 'area' ? (
              <polygon
                key={index}
                points={toPolyline(stroke.points)}
                fill="var(--brand)"
                fillOpacity={0.12}
                stroke={strokeColor(stroke.kind)}
                strokeWidth={2.5}
                strokeLinejoin="round"
                opacity={0.9}
              />
            ) : (
              <polyline
                key={index}
                points={toPolyline(stroke.points)}
                fill="none"
                stroke={strokeColor(stroke.kind)}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ),
          )}
          {current && (
            <polyline
              points={toPolyline(current)}
              fill="none"
              stroke={strokeColor(mode === 'line' ? 'line' : 'area')}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={strokes.length === 0}
              onClick={() => setStrokes((all) => all.slice(0, -1))}
            >
              <UndoIcon size={15} />
              {t('mapEditor.undo')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={strokes.length === 0}
              onClick={reset}
            >
              {t('editorAi.sketchClear')}
            </Button>
          </div>
          <Button
            size="sm"
            disabled={strokes.length === 0}
            onClick={() => {
              onSubmit(strokes, board);
              reset();
              onClose();
            }}
          >
            <ZapIcon size={15} />
            {t('editorAi.sketchSend')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SketchBoard;
