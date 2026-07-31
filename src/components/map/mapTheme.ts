import type { NodeType, TransitType } from './types';

/* ============================================================================
   Map theme — the single mapping from domain meaning to visual treatment.
   ----------------------------------------------------------------------------
   Colors are CSS custom properties so the map follows the light/dark theme for
   free. Every semantic category also gets a distinct glyph shape: this is
   evacuation software, and meaning must never rely on color alone (color-blind
   users, low-quality print, direct sunlight on a phone).
   ========================================================================= */

export type NodeGlyph = 'exit' | 'transit' | 'entrance' | 'poi';

export interface NodeTheme {
  /** CSS color value (a var() reference into the design tokens). */
  fill: string;
  /** Optional glyph drawn inside the marker; see NODE_GLYPH_PATHS. */
  glyph?: NodeGlyph;
}

export const NODE_THEME: Record<NodeType, NodeTheme> = {
  NORMAL: { fill: 'var(--ink-subtle)' },
  ENTRANCE: { fill: 'var(--ink)', glyph: 'entrance' },
  TRANSIT: { fill: 'var(--info)', glyph: 'transit' },
  POI: { fill: 'var(--brand)', glyph: 'poi' },
  EMERGENCY_EXIT: { fill: 'var(--success)', glyph: 'exit' },
};

/** The user's own position ("you are here"). */
export const CURRENT_LOCATION_COLOR = 'var(--danger)';

export type RouteTone = 'brand' | 'danger';

/** Route path color per mode: brand for wayfinding, danger for evacuation. */
export const ROUTE_TONES: Record<RouteTone, string> = {
  brand: 'var(--brand)',
  danger: 'var(--danger)',
};

/**
 * Glyph path data on the app's 24px icon grid (stroke-rendered, matching the
 * ui/icons visual language). Render with:
 *   <g transform={`translate(${x - 12 * k} ${y - 12 * k}) scale(${k})`}>
 */
export const NODE_GLYPH_PATHS: Record<NodeGlyph, string> = {
  // Door with an outward arrow (from ExitDoorIcon).
  exit: 'M14 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M14 15.5l3.5-3.5L14 8.5M17.5 12H11',
  // Staircase.
  transit: 'M5 18h4v-4h4v-4h4V6',
  // Arrow entering downward — "way in".
  entrance: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M6 19h12',
  // Location pin.
  poi: 'M12 19s5.5-4.4 5.5-8.6a5.5 5.5 0 1 0-11 0C6.5 14.6 12 19 12 19ZM12 12.4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
};

/** Midpoint glyphs for non-walkway edges, same 24px grid. */
export const TRANSIT_GLYPH_PATHS: Record<Exclude<TransitType, 'WALKWAY'>, string> = {
  STAIRS: 'M5 18h4v-4h4v-4h4V6',
  ESCALATOR: 'M4 18h4l8-8h4M15 5h5v5',
  ELEVATOR: 'M12 6v12M8.5 9.5 12 6l3.5 3.5M8.5 14.5 12 18l3.5-3.5',
};
