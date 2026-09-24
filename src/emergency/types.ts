export interface EmergencySnapshot {
  isEmergency: boolean;
  message: string | null;
  emergencyId: string | null;
  startedAt: string | null;
  counters?: {
    scanned: number;
    evacuated: number;
    calledEmergency: number;
  } | null;
}

export type BuildingEvent =
  | { type: "state"; data: EmergencySnapshot }
  | {
      type: "emergency_started";
      data: { emergencyId: string; message: string | null; startedAt: string };
    }
  | { type: "emergency_ended"; data: { endedAt: string } }
  | {
      type: "log_appended";
      data: { id?: string; message: string; type: string; createdAt: string };
    }
  | {
      type: "counters_updated";
      data: { scanned: number; evacuated: number; calledEmergency: number };
    }
  | {
      type: "closure_changed";
      data: {
        closureId: string;
        action: "created" | "updated" | "deleted";
        blocked: boolean;
        edgeIds: string[];
        nodeIds: string[];
        reason: string | null;
        endsAt: string | null;
      };
    };

export type ChannelStatus = "connecting" | "open" | "degraded" | "closed";

export interface RealtimeChannel {
  subscribe(handler: (evt: BuildingEvent) => void): () => void;
  status(): ChannelStatus;
  /** Calls `cb` immediately with the current status, then on every change. */
  onStatusChange(cb: (status: ChannelStatus) => void): () => void;
  /** Epoch ms of the last named `heartbeat` frame, or null if none has arrived. */
  lastHeartbeatAt(): number | null;
  /** Latest stream sequence seen (`id:` value or heartbeat `seq`), or null. */
  lastSeq(): number | null;
  close(): void;
}
