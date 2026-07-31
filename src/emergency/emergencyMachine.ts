// Pure reducer for the emergency UX state machine. Keyed on emergencyId:
// bypassing an emergency acknowledges THAT emergency — a new one re-triggers
// the full overlay, the same one never re-nags.

export type EmergencyPhase =
  | "unknown"
  | "normal"
  | "emergency"
  | "bypassed"
  | "resolvedNotice";

export interface EmergencyState {
  phase: EmergencyPhase;
  emergencyId: string | null;
  message: string | null;
  startedAt: string | null;
  /** emergencyId the user acknowledged via the bypass button */
  ackedEmergencyId: string | null;
}

export type EmergencyAction =
  | {
      type: "SNAPSHOT";
      isEmergency: boolean;
      emergencyId: string | null;
      message: string | null;
      startedAt: string | null;
    }
  | { type: "EMERGENCY_STARTED"; emergencyId: string; message: string | null; startedAt: string }
  | { type: "EMERGENCY_ENDED" }
  | { type: "BYPASS" }
  | { type: "NOTICE_DISMISSED" };

export const initialEmergencyState = (
  ackedEmergencyId: string | null = null
): EmergencyState => ({
  phase: "unknown",
  emergencyId: null,
  message: null,
  startedAt: null,
  ackedEmergencyId,
});

export function emergencyReducer(
  state: EmergencyState,
  action: EmergencyAction
): EmergencyState {
  switch (action.type) {
    case "SNAPSHOT": {
      if (!action.isEmergency) {
        // A resolved emergency while we were in emergency/bypassed shows the
        // notice; from unknown/normal it is simply normal.
        if (state.phase === "emergency" || state.phase === "bypassed") {
          return {
            ...state,
            phase: "resolvedNotice",
            emergencyId: null,
            message: null,
            startedAt: null,
            ackedEmergencyId: null,
          };
        }
        return { ...state, phase: "normal", emergencyId: null, message: null, startedAt: null };
      }
      const acked =
        action.emergencyId !== null && action.emergencyId === state.ackedEmergencyId;
      return {
        ...state,
        phase: acked ? "bypassed" : "emergency",
        emergencyId: action.emergencyId,
        message: action.message,
        startedAt: action.startedAt,
      };
    }

    case "EMERGENCY_STARTED": {
      const acked = action.emergencyId === state.ackedEmergencyId;
      return {
        ...state,
        phase: acked ? "bypassed" : "emergency",
        emergencyId: action.emergencyId,
        message: action.message,
        startedAt: action.startedAt,
      };
    }

    case "EMERGENCY_ENDED": {
      if (state.phase === "emergency" || state.phase === "bypassed") {
        return {
          ...state,
          phase: "resolvedNotice",
          emergencyId: null,
          message: null,
          startedAt: null,
          ackedEmergencyId: null,
        };
      }
      return { ...state, phase: "normal", emergencyId: null, message: null, startedAt: null };
    }

    case "BYPASS": {
      if (state.phase !== "emergency" || !state.emergencyId) return state;
      return { ...state, phase: "bypassed", ackedEmergencyId: state.emergencyId };
    }

    case "NOTICE_DISMISSED": {
      if (state.phase !== "resolvedNotice") return state;
      return { ...state, phase: "normal" };
    }

    default:
      return state;
  }
}

// A bypass should not outlive the browsing session.
export const ackStorageKey = (buildingId: string) =>
  `alertup-emergency-ack:${buildingId}`;

export function readAck(buildingId: string): string | null {
  try {
    return sessionStorage.getItem(ackStorageKey(buildingId));
  } catch {
    return null;
  }
}

export function writeAck(buildingId: string, emergencyId: string | null): void {
  try {
    if (emergencyId === null) sessionStorage.removeItem(ackStorageKey(buildingId));
    else sessionStorage.setItem(ackStorageKey(buildingId), emergencyId);
  } catch {
    // storage unavailable (private mode) — bypass just won't persist reloads
  }
}
