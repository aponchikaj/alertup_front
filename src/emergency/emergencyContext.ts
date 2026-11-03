import { createContext } from "react";
import type { EmergencyPhase } from "./emergencyMachine";
import type { ChannelStatus, EmergencySnapshot } from "./types";

/* ============================================================================
   Emergency context and its value type.

   Kept out of EmergencyProvider.tsx so that file exports only components
   (react-refresh/only-export-components).
   ========================================================================= */

export interface EmergencyContextValue {
  phase: EmergencyPhase;
  emergencyId: string | null;
  message: string | null;
  startedAt: string | null;
  /** Live activity feed — only populated when `feed` is enabled. */
  logs: Array<{ id: string; message: string; type: string; createdAt: string }>;
  counters: EmergencySnapshot["counters"];
  connection: ChannelStatus;
  /**
   * Bumped on every `closure_changed` frame. A page that keeps a route on
   * screen watches this to know when to silently re-request it — the count
   * itself carries no meaning beyond "something changed".
   */
  closureVersion: number;
  /** The user chose "I'm safe" — acknowledges THIS emergency only. */
  bypass: () => void;
  dismissResolvedNotice: () => void;
}

export const EmergencyContext = createContext<EmergencyContextValue | null>(null);
