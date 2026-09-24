import { createContext } from "react";
import type { Membership } from "./permissions";

/* ============================================================================
   App-wide auth context and its types.

   Lives apart from AuthProvider.tsx so that file exports only components —
   react-refresh keeps fast refresh working, and consumers (useAuth, guards)
   import the context without pulling the provider in.
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
