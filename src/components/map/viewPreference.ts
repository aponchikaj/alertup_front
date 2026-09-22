/* ============================================================================
   Map view preference — remembers 2D vs 3D across the scan session.
   ----------------------------------------------------------------------------
   One key for all visitor surfaces, so choosing 3D on the overview keeps the
   route view in 3D too. Session-scoped on purpose: a preference made on
   today's phone shouldn't ambush next month's visit. No three imports.
   ========================================================================= */

export type MapViewMode = '2d' | '3d';

const STORAGE_KEY = 'alertup-map-view';

export function readMapViewPreference(): MapViewMode {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

export function writeMapViewPreference(mode: MapViewMode): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — the toggle just won't persist */
  }
}
