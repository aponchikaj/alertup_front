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
    }
  | {
      /**
       * The server truncated a replay — either the backlog exceeded its row
       * cap or the requested resume point fell outside the retention window.
       * Frames up to `atSeq` were skipped and will never be replayed: the
       * client's cached state is no longer trustworthy and must be rebuilt
       * from a fresh snapshot rather than assumed caught up.
       */
      type: "resync_required";
      data: { reason: string; atSeq: number };
    };

export type ChannelStatus = "connecting" | "open" | "degraded" | "closed";

export interface RealtimeChannel {
  subscribe(handler: (evt: BuildingEvent) => void): () => void;
  status(): ChannelStatus;
  /** Calls `cb` immediately with the current status, then on every change. */
  onStatusChange(cb: (status: ChannelStatus) => void): () => void;
  /** Epoch ms of the last named `heartbeat` frame, or null if none has arrived. */
  lastHeartbeatAt(): number | null;
  /**
   * Latest resumable frame `id:` seen as a number, or null if none has
   * arrived yet. This is the connection's own received position — a
   * heartbeat's body `seq` (the building's wider high-water mark) is read
   * only to detect a gap and never populates this value.
   */
  lastSeq(): number | null;
  close(): void;
}
