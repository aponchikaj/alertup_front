/* ============================================================================
   Theme resolution for the 3D renderer.
   ----------------------------------------------------------------------------
   The map's colors are CSS custom properties ('var(--ink)') so the SVG map
   follows light/dark theme for free. WebGL materials need concrete colors, so
   this module resolves tokens through getComputedStyle — and re-resolves when
   the theme flips (attribute change on <html>), letting mapScene re-tint
   materials in place without rebuilding geometry.

   The resolver is injectable so the mapping logic tests in jsdom (where
   computed custom properties are empty).
   ========================================================================= */

const VAR_PATTERN = /^var\((--[a-z0-9-]+)\)$/i;

export type CssVarReader = (name: string) => string;

const defaultReader: CssVarReader = (name) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name);
};

/** Neutral fallback when a token resolves to nothing (tests, broken theme). */
const FALLBACK_COLOR = '#888888';

/**
 * Resolve a scene-spec color (a 'var(--token)' reference or a literal color)
 * to a concrete CSS color string three.js can parse.
 */
export function resolveColor(token: string, read: CssVarReader = defaultReader): string {
  const match = token.trim().match(VAR_PATTERN);
  if (!match) return token; // literal (#hex from shape fills, named colors)
  const value = read(match[1]).trim();
  return value || FALLBACK_COLOR;
}

/**
 * Watch for theme flips. The theme toggles by mutating class / data attributes
 * on <html>; any attribute mutation triggers a re-resolve. Returns a cleanup.
 */
export function watchTheme(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  return () => observer.disconnect();
}
