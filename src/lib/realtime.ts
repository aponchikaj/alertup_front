// Building realtime channel: SSE transport with automatic polling fallback,
// exponential backoff + jitter, snapshot re-sync on reconnect and on
// visibility return. Ref-counted per building so the scan page, banner and
// chat drawer share one connection.

import { API_BASE_URL } from "../apis/http";
import type {
  BuildingEvent,
  ChannelStatus,
  EmergencySnapshot,
  RealtimeChannel,
} from "../emergency/types";

const SSE_EVENT_TYPES = [
  "state",
  "emergency_started",
  "emergency_ended",
  "log_appended",
  "counters_updated",
] as const;

const POLL_INTERVAL_MS = 10_000;
const MAX_SSE_FAILURES_BEFORE_FALLBACK = 4;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const HIDDEN_RESYNC_THRESHOLD_MS = 60_000;

interface ChannelOptions {
  /** member feed (live logs) instead of the public status stream */
  feed?: boolean;
}

function statusUrl(buildingId: string, feed: boolean): string {
  return `${API_BASE_URL}/api/realtime/buildings/${buildingId}/${feed ? "feed" : "status"}`;
}

async function fetchSnapshot(buildingId: string): Promise<EmergencySnapshot | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/emergency/buildings/${buildingId}/status`,
      { credentials: "include" }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: EmergencySnapshot };
    return body.data ?? null;
  } catch {
    return null;
  }
}

class BuildingChannel implements RealtimeChannel {
  private buildingId: string;
  private feed: boolean;
  private handlers = new Set<(evt: BuildingEvent) => void>();
  private statusCbs = new Set<(s: ChannelStatus) => void>();
  private currentStatus: ChannelStatus = "connecting";
  private es: EventSource | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sseFailures = 0;
  private closed = false;
  private hiddenAt: number | null = null;
  private lastSnapshot: EmergencySnapshot | null = null;
  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      this.hiddenAt = Date.now();
      return;
    }
    const hiddenFor = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = null;
    // Mobile browsers silently kill sockets in background tabs.
    if (hiddenFor > HIDDEN_RESYNC_THRESHOLD_MS) {
      void this.resync();
      if (this.currentStatus !== "open") this.connectSse();
    }
  };

  constructor(buildingId: string, options: ChannelOptions) {
    this.buildingId = buildingId;
    this.feed = Boolean(options.feed);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.connectSse();
  }

  private setStatus(status: ChannelStatus) {
    if (this.currentStatus === status || this.closed) return;
    this.currentStatus = status;
    this.statusCbs.forEach((cb) => cb(status));
  }

  private emit(evt: BuildingEvent) {
    if (evt.type === "state") this.lastSnapshot = evt.data;
    this.handlers.forEach((h) => h(evt));
  }

  private async resync() {
    const snapshot = await fetchSnapshot(this.buildingId);
    if (snapshot && !this.closed) this.emit({ type: "state", data: snapshot });
  }

  private connectSse() {
    if (this.closed || typeof EventSource === "undefined") {
      this.startPolling();
      return;
    }
    this.stopPolling();
    this.es?.close();
    this.setStatus("connecting");

    const es = new EventSource(statusUrl(this.buildingId, this.feed), {
      withCredentials: true,
    });
    this.es = es;

    es.onopen = () => {
      this.sseFailures = 0;
      this.setStatus("open");
      // The server sends a fresh `state` on connect; nothing else needed.
    };

    for (const type of SSE_EVENT_TYPES) {
      es.addEventListener(type, (raw) => {
        try {
          const data = JSON.parse((raw as MessageEvent).data);
          this.emit({ type, data } as BuildingEvent);
        } catch {
          // malformed frame — ignore
        }
      });
    }

    es.onerror = () => {
      es.close();
      if (this.closed) return;
      this.sseFailures += 1;
      if (this.sseFailures >= MAX_SSE_FAILURES_BEFORE_FALLBACK) {
        this.startPolling();
        return;
      }
      // Exponential backoff with full jitter, then retry SSE.
      const cap = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.sseFailures);
      const delay = Math.random() * cap;
      this.setStatus("connecting");
      this.reconnectTimer = setTimeout(() => this.connectSse(), delay);
    };
  }

  private startPolling() {
    if (this.pollTimer || this.closed) return;
    this.setStatus("degraded");
    void this.resync();
    this.pollTimer = setInterval(() => void this.resync(), POLL_INTERVAL_MS);
    // Keep probing SSE occasionally so we can upgrade back.
    this.reconnectTimer = setTimeout(() => {
      this.sseFailures = 0;
      this.stopPolling();
      this.connectSse();
    }, 5 * 60_000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(handler: (evt: BuildingEvent) => void): () => void {
    this.handlers.add(handler);
    // Late subscribers immediately get the last known state.
    if (this.lastSnapshot) handler({ type: "state", data: this.lastSnapshot });
    return () => this.handlers.delete(handler);
  }

  status(): ChannelStatus {
    return this.currentStatus;
  }

  onStatusChange(cb: (s: ChannelStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => this.statusCbs.delete(cb);
  }

  close() {
    this.closed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPolling();
    this.es?.close();
    this.es = null;
    this.handlers.clear();
    this.statusCbs.clear();
    this.currentStatus = "closed";
  }
}

// Ref-counted registry: one connection per (buildingId, feed).
const registry = new Map<string, { channel: BuildingChannel; refs: number }>();

export function createBuildingChannel(
  buildingId: string,
  options: ChannelOptions = {}
): RealtimeChannel {
  const key = `${buildingId}:${options.feed ? "feed" : "status"}`;
  let entry = registry.get(key);
  if (!entry || entry.channel.status() === "closed") {
    entry = { channel: new BuildingChannel(buildingId, options), refs: 0 };
    registry.set(key, entry);
  }
  entry.refs += 1;
  const inner = entry.channel;

  let released = false;
  return {
    subscribe: (h) => inner.subscribe(h),
    status: () => inner.status(),
    onStatusChange: (cb) => inner.onStatusChange(cb),
    close: () => {
      if (released) return;
      released = true;
      const current = registry.get(key);
      if (!current) return;
      current.refs -= 1;
      if (current.refs <= 0) {
        current.channel.close();
        registry.delete(key);
      }
    },
  };
}
