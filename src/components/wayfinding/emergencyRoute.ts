import type { AssembledRoute } from "../map/types";

/**
 * Whether a route should read as an evacuation route — by its `mode` (the
 * `/evacuate` endpoint) or by the `profile` it was requested with (routing to
 * a specific alternative exit keeps `mode: 'WAYFINDING'` but forces
 * `profile: 'emergency'`). Shared so the map tone and the alternative-exits
 * section agree on exactly one definition.
 */
export const isEmergencyRoute = (route: AssembledRoute): boolean =>
  route.mode === "EVACUATION" || route.profile === "emergency";
