import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { UndoIcon, ZapIcon } from '../../../components/ui/icons';
import { useI18n } from '../../../i18n/LanguageProvider';
import type { SketchSize, SketchStroke } from './sketchSummary';

/* ============================================================================
   SketchBoard — draw the map you want, roughly.
   ----------------------------------------------------------------------------
   A small freehand pad inside the AI panel: circle where the shops go, drag
   lines where the corridors run, hit send. The strokes stay VECTORS — the
   summarizer classifies loops as regions and lines as paths, in floor
   coordinates — so a text model can genuinely plan from them; nothing here
   pretends to be computer vision.

   Kept deliberately crude: no tools, no colors, one pen. A rough gesture is
   the point — precision belongs in the editor, intent belongs here.
   ========================================================================= */

/** Board width in CSS/viewBox units; height follows the floor's aspect. */
const BOARD_WIDTH = 320;

export interface SketchBoardProps {
  open: boolean;
  onClose: () => void;
  /** The active floor's canvas, so sketches scale into real coordinates. */
  space: SketchSize;
  onSubmit: (strokes: SketchStroke[], board: SketchSize) => void;
}

export const SketchBoard = ({ open, onClose, space, onSubmit }: SketchBoardProps) => {
  const { t } = useI18n();
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [current, setCurrent] = useState<number[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const board = useMemo<SketchSize>(() => {
    const ratio = space.height > 0 && space.width > 0 ? space.height / space.width : 0.8;
    return { width: BOARD_WIDTH, height: Math.round(BOARD_WIDTH * ratio) };
  }, [space]);

  const boardPoint = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * board.width,
      y: ((e.clientY - rect.top) / rect.height) * board.height,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const point = boardPoint(e);
    if (!point) return;
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
      if (line && line.length >= 4) {
        setStrokes((all) => [...all, { points: line }]);
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

        <svg
          ref={svgRef}
          data-testid="sketch-board"
          viewBox={`0 0 ${board.width} ${board.height}`}
          className="w-full touch-none rounded-xl border border-line bg-surface-2"
          style={{ cursor: 'crosshair', aspectRatio: `${board.width} / ${board.height}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label={t('editorAi.sketchTitle')}
        >
          {strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={toPolyline(stroke.points)}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          ))}
          {current && (
            <polyline
              points={toPolyline(current)}
              fill="none"
              stroke="var(--brand)"
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
