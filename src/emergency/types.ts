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
    };

export type ChannelStatus = "connecting" | "open" | "degraded" | "closed";

export interface RealtimeChannel {
  subscribe(handler: (evt: BuildingEvent) => void): () => void;
  status(): ChannelStatus;
  onStatusChange(cb: (status: ChannelStatus) => void): () => void;
  close(): void;
}
