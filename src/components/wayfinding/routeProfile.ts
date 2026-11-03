import { ROUTE_PROFILES, type RouteProfile } from '../map/types';

/* ============================================================================
   Route preference — remembered across visits.
   ----------------------------------------------------------------------------
   Mirrors the map view preference (src/components/map/viewPreference.ts), with
   one deliberate difference: localStorage, not sessionStorage. A wheelchair
   user should not have to re-pick the step-free route on every scan.

   `emergency` is a server-side profile: the evacuation engine selects it, a
   visitor never can. It is filtered out of the picker's options rather than
   removed from the type, so a route that comes back tagged `emergency` still
   type-checks.
   ========================================================================= */

/** The profiles a visitor may choose — everything but `emergency`. */
export type SelectableRouteProfile = Exclude<RouteProfile, 'emergency'>;

export const DEFAULT_ROUTE_PROFILE: SelectableRouteProfile = 'walk';

export const SELECTABLE_ROUTE_PROFILES: readonly SelectableRouteProfile[] =
  ROUTE_PROFILES.filter(
    (profile): profile is SelectableRouteProfile => profile !== 'emergency',
  );

const STORAGE_KEY = 'alertup-route-profile';

const isSelectable = (value: unknown): value is SelectableRouteProfile =>
  typeof value === 'string' &&
  (SELECTABLE_ROUTE_PROFILES as readonly string[]).includes(value);

export function readRouteProfile(): SelectableRouteProfile {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSelectable(stored) ? stored : DEFAULT_ROUTE_PROFILE;
  } catch {
    return DEFAULT_ROUTE_PROFILE;
  }
}

export function writeRouteProfile(profile: SelectableRouteProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, profile);
  } catch {
    /* storage unavailable — the preference just won't survive the session */
  }
}
