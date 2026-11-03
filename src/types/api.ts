/**
 * Payload shapes carried in the `data` field of the API envelope.
 *
 * The backend still serialises buildings, logs and emergencies in their
 * pre-PostgreSQL ("legacy") document shape — `buildingName`, `maps[]`,
 * `logMessage` and so on — so these mirror that wire format. Record ids are
 * always `id` here; where the wire still says `_id` the API module renames it.
 */
import type { Permission } from '../auth/permissions';

/* --- Buildings ------------------------------------------------------------ */

/** One floor in a building's `maps[]`. */
export interface BuildingMap {
  /** The floor's display name ("Floor 1", or its number as a string). */
  floor: string;
  map: string | null;
  qrCode: string | null;
  /** How many visitor scans this floor has seen. */
  scanned: number;
  createdAt: string;
}

export interface Building {
  id: string;
  buildingName: string;
  /** The owner's user id. */
  owner: string;
  /** Floor count. */
  floors: number;
  maps: BuildingMap[];
  globalScans: unknown[];
  emergencyMode: boolean;
  /** A custom banner text; the API omits it when none is set. */
  emergencyMessage?: string;
  isDeactivated: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A building someone else owns that the user belongs to through a role. */
export interface MemberBuilding extends Building {
  role: string;
  permissions: Permission[];
}

/** Public owner summary sent beside a building (top-level `Owner`). */
export interface BuildingOwner {
  /** Wire name kept by the backend; nothing on the client reads it. */
  _id: string;
  displayName: string;
  userType: string;
}

/** GET /api/building/scan/:id/:floor */
export interface FloorView {
  buildingName: string;
  floorData: BuildingMap;
  scannedCount: number;
}

/* --- Emergencies and logs ------------------------------------------------- */

export interface LogEntry {
  id: string;
  logType: string;
  logMessage: string;
  buildingID: string;
  isEmergency: boolean;
  createdAt: string;
}

export interface EmergencyRecord {
  id: string;
  /** Present on the analytics list; the single-emergency report omits it. */
  buildingID?: string;
  isFinished: boolean;
  scanned: number;
  evacuated: number;
  calledEmergency: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/administration/analytics/:buildingId/:emergencyId */
export interface EmergencyReport {
  logs: LogEntry[];
  emergency: EmergencyRecord;
}

/** POST /api/emergency/buildings/:id/trigger */
export interface EmergencyTriggerResult {
  alreadyActive: boolean;
  emergencyId: string | null;
}

/** POST /api/emergency/buildings/:id/resolve */
export interface EmergencyResolveResult {
  alreadyResolved: boolean;
}

/* --- Account --------------------------------------------------------------- */

/** POST /api/auth/login, /register and /2fa. */
export interface AuthPayload {
  /** Only sent to the Safari/iOS fallback path. */
  token?: string;
  user?: {
    name?: string;
    company?: string;
    userType?: string;
    email?: string;
  };
}

/**
 * GET /api/settings. Every field is optional because the backend omits the
 * ones that do not apply to the account type.
 */
export interface UserSettings {
  name?: string;
  lastname?: string;
  company?: string;
  phone?: string;
  country?: string;
  email?: string;
  userType?: string;
  verified?: boolean;
  TwoFactorEnabled?: boolean;
}

/* --- Dashboard ------------------------------------------------------------- */

export interface RecentScan {
  buildingName: string | null;
  scannedAt: string | null;
  buildingID: string | null;
}

export interface ActivityPoint {
  date: string;
  count: number;
}

export interface DashboardData {
  MyBuildings: number;
  scanned: number;
  myBuildingsScanned: number;
  lastScanned: string | null;
  premiumStatus: string;
  premiumExpires: string | null;
  /** Present once the backend ships the richer payload; both are optional so
   *  the page keeps working against an older deploy. */
  recentScans?: RecentScan[];
  scanActivity?: ActivityPoint[];
}
