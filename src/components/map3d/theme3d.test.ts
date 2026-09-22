import { resolveColor } from './theme3d';

/* Token resolution is the bridge between the CSS theme and WebGL materials —
   a wrong branch here paints the whole building the fallback grey. */

describe('resolveColor', () => {
  const reader = (name: string) =>
    ({ '--ink': ' #1a1a2e ', '--brand': '#6c5ce7' })[name] ?? '';

  test('resolves var() tokens through the reader, trimming whitespace', () => {
    expect(resolveColor('var(--ink)', reader)).toBe('#1a1a2e');
    expect(resolveColor('var(--brand)', reader)).toBe('#6c5ce7');
  });

  test('passes literals through untouched (shape fills are raw hex)', () => {
    expect(resolveColor('#ff0000', reader)).toBe('#ff0000');
    expect(resolveColor('rebeccapurple', reader)).toBe('rebeccapurple');
  });

  test('unknown tokens fall back to a visible neutral, never empty string', () => {
    expect(resolveColor('var(--does-not-exist)', reader)).toBe('#888888');
  });
});
