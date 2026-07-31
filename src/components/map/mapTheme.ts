import type { IconKind } from './drawing';
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

/**
 * Glyphs for markers stamped onto a hand-drawn floor plan, same 24px grid.
 * The transit three are shared with TRANSIT_GLYPH_PATHS on purpose: a lift
 * stamped on the plan and a lift on a route edge must look identical, or the
 * drawing stops being a legend for the route.
 */
export const DRAWING_ICON_PATHS: Record<IconKind, string> = {
  ELEVATOR: TRANSIT_GLYPH_PATHS.ELEVATOR,
  ESCALATOR: TRANSIT_GLYPH_PATHS.ESCALATOR,
  STAIRS: TRANSIT_GLYPH_PATHS.STAIRS,
  ENTRANCE: NODE_GLYPH_PATHS.entrance,
  EXIT: NODE_GLYPH_PATHS.exit,
  // Door on a hinge, swinging open.
  DOOR: 'M7 20V4l10-1v18l-10-1ZM7 12H4M14 12.5v-1',
  // Restrooms.
  WC: 'M8 21v-6M8 15H6l1.5-6h1L10 15H8M8 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M16 21v-5M16 16h-2.5L16 9h.5l2.5 7H16M16 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  // Information.
  INFO: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
};

/** Tint per marker, so a lift and an exit are not just two identical glyphs. */
export const DRAWING_ICON_COLORS: Record<IconKind, string> = {
  ELEVATOR: 'var(--info)',
  ESCALATOR: 'var(--info)',
  STAIRS: 'var(--info)',
  ENTRANCE: 'var(--ink)',
  EXIT: 'var(--success)',
  DOOR: 'var(--ink-subtle)',
  WC: 'var(--ink-subtle)',
  INFO: 'var(--ink-subtle)',
};

/**
 * Default look for drawn areas.
 *
 * Room and shop outlines use the text colour rather than the border tokens:
 * a drawn box sits on a gridded canvas, and a chrome-weight border blends into
 * the grid, leaving people unsure what they had actually drawn. These read as
 * ink on paper, which is what a floor plan is.
 */
export const DRAWING_DEFAULTS = {
  wallColor: 'var(--ink)',
  wallThickness: 6,
  roomFill: 'var(--surface)',
  roomStroke: 'var(--ink)',
  shopFill: 'var(--surface)',
  shopStroke: 'var(--brand)',
  /** Outline weight for drawn areas, in map units. */
  shapeStrokeWidth: 2.5,
  selectionColor: 'var(--brand)',
} as const;
