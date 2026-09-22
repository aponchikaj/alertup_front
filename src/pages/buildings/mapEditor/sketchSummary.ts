/* ============================================================================
   Sketch → words the model can reason about.
   ----------------------------------------------------------------------------
   The AI is a text model, but the sketch board is OUR canvas — so instead of
   pretending to "see" pixels, we keep the strokes as vectors, classify them
   geometrically, and describe them in floor coordinates:

     area stroke (or closed-ish loop)  → "region x y w h"    (a room/shop)
     line stroke (or open stroke)      → "path x1 y1 x2 y2…" (wall/corridor)

   The board's pen modes stamp intent onto each stroke (`kind`), so the
   summary no longer has to guess whether a wobbly loop was meant as a room —
   auto-classification remains only as the fallback for unlabeled strokes.

   The model receives real geometry it can genuinely plan around, and the
   whole block stays well inside the chat's per-message budget.
   ========================================================================= */

export interface SketchStroke {
  /** Flat [x, y, ...] in board coordinates. */
  points: number[];
  /** Pen mode the stroke was drawn with; absent strokes are auto-classified. */
  kind?: 'area' | 'line';
}

export interface SketchSize {
  width: number;
  height: number;
}

/** More strokes than this is noise, not intent. */
const MAX_STROKES = 12;

/** Points kept per described path — enough for an L or a zigzag. */
const MAX_PATH_POINTS = 10;

/** Whole block cap: must fit the server's per-message limit with room for
 *  the user's own words. */
const MAX_CHARS = 1200;

/** Endpoints closer than this fraction of the diagonal close the loop. */
const CLOSE_FRACTION = 0.1;

/** Simplification: drop points closer than this fraction of the diagonal. */
const SIMPLIFY_FRACTION = 0.04;

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Distance-based decimation — evens out fast/slow hand speeds. */
export function simplifyStroke(points: number[], minStep: number): number[] {
  if (points.length < 4) return [...points];
  const out = [points[0], points[1]];
  for (let i = 2; i + 1 < points.length; i += 2) {
    const lastX = out[out.length - 2];
    const lastY = out[out.length - 1];
    if (dist(points[i], points[i + 1], lastX, lastY) >= minStep) {
      out.push(points[i], points[i + 1]);
    }
  }
  // The final point always survives — the end of a stroke is intent.
  const endX = points[points.length - 2];
  const endY = points[points.length - 1];
  if (out[out.length - 2] !== endX || out[out.length - 1] !== endY) {
    out.push(endX, endY);
  }
  return out;
}

/**
 * Turn raw board strokes into the `SKETCH:` block sent with the message.
 * Returns an empty string when nothing usable was drawn.
 */
export function summarizeSketch(
  strokes: SketchStroke[],
  board: SketchSize,
  space: SketchSize,
): string {
  const diag = Math.hypot(board.width, board.height);
  const sx = space.width / board.width;
  const sy = space.height / board.height;

  const lines: string[] = [];
  for (const stroke of strokes.slice(0, MAX_STROKES)) {
    const simplified = simplifyStroke(stroke.points, diag * SIMPLIFY_FRACTION);
    if (simplified.length < 4) continue;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i + 1 < simplified.length; i += 2) {
      xs.push(simplified[i]);
      ys.push(simplified[i + 1]);
    }

    // Pen intent wins; geometry only decides for unlabeled strokes.
    const isRegion =
      stroke.kind === 'area' ||
      (stroke.kind === undefined &&
        simplified.length >= 8 &&
        dist(
          simplified[0],
          simplified[1],
          simplified[simplified.length - 2],
          simplified[simplified.length - 1],
        ) <=
          diag * CLOSE_FRACTION);

    if (isRegion) {
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      lines.push(
        `region ${Math.round(minX * sx)} ${Math.round(minY * sy)} ${Math.round(
          (maxX - minX) * sx,
        )} ${Math.round((maxY - minY) * sy)}`,
      );
    } else {
      const coords: string[] = [];
      const step = Math.max(1, Math.ceil(xs.length / MAX_PATH_POINTS));
      for (let i = 0; i < xs.length; i += step) {
        coords.push(`${Math.round(xs[i] * sx)} ${Math.round(ys[i] * sy)}`);
      }
      const lastIdx = xs.length - 1;
      if ((lastIdx % step) !== 0) {
        coords.push(`${Math.round(xs[lastIdx] * sx)} ${Math.round(ys[lastIdx] * sy)}`);
      }
      lines.push(`path ${coords.join(' ')}`);
    }
  }

  if (lines.length === 0) return '';

  const header = `SKETCH (rough hand layout, floor coordinates on a ${space.width}x${space.height} canvas — regions are rooms/shops, paths are walls or corridors):`;
  let block = header;
  for (const line of lines) {
    if (block.length + line.length + 1 > MAX_CHARS) break;
    block += `\n${line}`;
  }
  return block;
}
