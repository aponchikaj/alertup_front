import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAuthState } from "../apis/me";
import type { Membership, Permission } from "./permissions";

/* ============================================================================
   App-wide auth context. One /api/me round-trip at mount replaces the
   per-guard and per-navigation fetches; guards and the navbar consume the
   shared state and call refresh() when they need a fresh verdict.
   ========================================================================= */

export type AuthStatus = "loading" | "guest" | "authed" | "error";

/** Deliberately loose — /api/me's user shape is still evolving. */
export interface MeUser {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  lastname?: string;
  company?: string;
  userType?: string;
  verified?: boolean;
  [key: string]: unknown;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: MeUser | null;
  memberships: Record<string, Membership>;
  ownedBuildingIds: string[];
  /** Human-readable failure text when status === "error". */
  error: string;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * /api/me does not return memberships yet — tolerate absence and coerce
 * whatever arrives into the typed shape, dropping malformed entries.
 */
const readMemberships = (user: MeUser | null): Record<string, Membership> => {
  const raw = user?.memberships;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, Membership> = {};
  for (const [buildingId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const { role, permissions } = entry as { role?: unknown; permissions?: unknown };
    out[buildingId] = {
      role: typeof role === "string" ? role : "",
      permissions: Array.isArray(permissions)
        ? (permissions.filter((p): p is Permission => typeof p === "string") as Permission[])
        : [],
    };
  }
  return out;
};

/** Legacy `user.Buildings`: an array of building ids (or objects with _id). */
const readOwnedBuildingIds = (user: MeUser | null): string[] => {
  const raw = user?.Buildings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : (entry as { _id?: unknown } | null)?._id,
    )
    .filter((id): id is string => typeof id === "string");
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MeUser | null>(null);
  const [memberships, setMemberships] = useState<Record<string, Membership>>({});
  const [ownedBuildingIds, setOwnedBuildingIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Monotonic sequence — a slow, stale response must never overwrite the
  // verdict of a newer refresh() (e.g. right after login).
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    setStatus("loading");

    const result = await getAuthState();
    if (seq !== seqRef.current) return;

    if (result.state === "authenticated") {
      const nextUser = (result.user ?? null) as MeUser | null;
      setUser(nextUser);
      setMemberships(readMemberships(nextUser));
      setOwnedBuildingIds(readOwnedBuildingIds(nextUser));
      setError("");
      setStatus("authed");
      return;
    }

    setUser(null);
    setMemberships({});
    setOwnedBuildingIds([]);

    if (result.state === "unauthenticated") {
      setError("");
      setStatus("guest");
    } else {
      setError(result.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, memberships, ownedBuildingIds, error, refresh }),
    [status, user, memberships, ownedBuildingIds, error, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
