import { simplifyStroke, summarizeSketch } from './sketchSummary';

/* The sketch board's promise: what the user gestures is what the model is
   told — closed loops become regions, open strokes become paths, everything
   scaled into floor coordinates and capped to the chat budget. */

const board = { width: 300, height: 240 };
const space = { width: 1000, height: 800 };

describe('simplifyStroke', () => {
  test('drops points closer than the step but always keeps the endpoint', () => {
    const dense = [0, 0, 1, 0, 2, 0, 3, 0, 100, 0, 101, 0];
    const out = simplifyStroke(dense, 50);
    expect(out.slice(0, 2)).toEqual([0, 0]);
    // The stroke's end survives even though it is within the step of the
    // previous kept point.
    expect(out.slice(-2)).toEqual([101, 0]);
    expect(out.length).toBeLessThan(dense.length);
  });
});

describe('summarizeSketch', () => {
  test('a closed loop becomes a region in floor coordinates', () => {
    // A rough square, 60..120 on the board — endpoints meet.
    const loop = {
      points: [60, 60, 120, 60, 120, 120, 60, 120, 61, 61],
    };
    const block = summarizeSketch([loop], board, space);
    // Board x scales by 1000/300, y by 800/240.
    expect(block).toContain('region 200 200 200 200');
    expect(block).toContain('SKETCH');
  });

  test('an open stroke becomes a path', () => {
    const line = { points: [0, 120, 150, 120, 300, 120] };
    const block = summarizeSketch([line], board, space);
    expect(block).toMatch(/path 0 400 .*1000 400/);
    // No stroke line classifies as a region (the header legend mentions the
    // word, so match line starts, not the whole block).
    expect(block.split('\n').some((line) => line.startsWith('region '))).toBe(false);
  });

  test('nothing usable drawn → empty string, so no SKETCH block is sent', () => {
    expect(summarizeSketch([], board, space)).toBe('');
    expect(summarizeSketch([{ points: [5, 5] }], board, space)).toBe('');
  });

  test('the block stays inside the chat budget no matter how wild the sketch', () => {
    const strokes = Array.from({ length: 40 }, (_, i) => ({
      points: Array.from({ length: 200 }, (_, j) => (i * 7 + j * 13) % 300),
    }));
    const block = summarizeSketch(strokes, board, space);
    expect(block.length).toBeLessThanOrEqual(1300);
  });
});
