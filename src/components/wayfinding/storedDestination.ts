import type { DestinationSelection } from "./DestinationSearch";

/* ============================================================================
   Session-scoped memory of the destination the user is walking to.

   Lets a QR rescan on another floor re-anchor the same journey instead of
   starting over. Kept out of WayfindingPanel.tsx so that file exports only
   components (react-refresh/only-export-components).
   ========================================================================= */

const DESTINATION_STORAGE_PREFIX = "alertup-route-dest:";

export interface StoredDestination {
  kind: DestinationSelection["kind"];
  poiId?: string;
  nodeId?: string;
  name: string;
}

export function readStoredDestination(buildingId: string): StoredDestination | null {
  try {
    const raw = sessionStorage.getItem(DESTINATION_STORAGE_PREFIX + buildingId);
    return raw ? (JSON.parse(raw) as StoredDestination) : null;
  } catch {
    return null;
  }
}

export function writeStoredDestination(
  buildingId: string,
  destination: StoredDestination | null,
): void {
  try {
    const key = DESTINATION_STORAGE_PREFIX + buildingId;
    if (destination) sessionStorage.setItem(key, JSON.stringify(destination));
    else sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable — the journey just won't survive a rescan */
  }
}
