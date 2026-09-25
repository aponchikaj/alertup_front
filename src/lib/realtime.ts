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
  "closure_changed",
  "resync_required",
] as const;

const POLL_INTERVAL_MS = 10_000;
const MAX_SSE_FAILURES_BEFORE_FALLBACK = 4;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const HIDDEN_RESYNC_THRESHOLD_MS = 60_000;
/** Two missed 25 s heartbeats (plus slack) means the feed behind the socket died. */
const STALE_AFTER_MS = 55_000;

interface ChannelOptions {
  /** member feed (live logs) instead of the public status stream */
  feed?: boolean;
}

function statusUrl(
  buildingId: string,
  feed: boolean,
  sinceSeq: string | null
): string {
  const base = `${API_BASE_URL}/api/realtime/buildings/${buildingId}/${feed ? "feed" : "status"}`;
  // Browsers only send `Last-Event-ID` on their OWN automatic reconnect; every
  // reconnect we drive ourselves has to carry the cursor in the query string.
  // The backend accepts either.
  return sinceSeq ? `${base}?sinceSeq=${encodeURIComponent(sinceSeq)}` : base;
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
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatsSeen = false;
  private lastEventId: string | null = null;
  private lastSeqValue: number | null = null;
  private lastHeartbeatAtValue: number | null = null;
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
    if (evt.type === "resync_required") {
      // The replay was truncated: frames up to `atSeq` are gone for good.
      // The cached state can no longer be trusted just because the socket
      // looks fine — rebuild it from a fresh snapshot, the same way the
      // staleness path does, rather than silently assuming we're caught up.
      void this.resync();
    }
    this.handlers.forEach((h) => h(evt));
  }

  private async resync() {
    const snapshot = await fetchSnapshot(this.buildingId);
    if (snapshot && !this.closed) this.emit({ type: "state", data: snapshot });
  }

  /**
   * Record the cursor carried by a named frame and treat the frame as proof of
   * life. `id:` values are the backend's monotonic `seq`, so a numeric one also
   * updates `lastSeq()`; a non-numeric id still resumes correctly because it is
   * echoed back verbatim as `?sinceSeq=`.
   */
  private noteFrame(eventId: string | undefined) {
    if (eventId) {
      this.lastEventId = eventId;
      const seq = Number(eventId);
      if (Number.isFinite(seq)) this.lastSeqValue = seq;
    }
    this.armStaleness();
  }

  /**
   * Arm the staleness timer — but ONLY once a named `heartbeat` frame has been
   * seen on this channel.
   *
   * Today's backend sends liveness as a `: hb` SSE *comment*, which EventSource
   * never surfaces to JavaScript. A building with no emergency therefore
   * produces zero JS-visible traffic on a perfectly healthy socket: arming on
   * connect would flip every calm building to "connection lost" after 55 s.
   * The first named heartbeat (task B15) is what proves the server speaks the
   * newer protocol; the flag then stays set for the channel's lifetime, so
   * after a reconnect silence is meaningful again straight away.
   */
  private armStaleness() {
    if (!this.heartbeatsSeen || this.closed) return;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.onStale(), STALE_AFTER_MS);
  }

  private clearStaleness() {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  /**
   * Heartbeats stopped: the socket may still look open (a dead middlebox, a
   * suspended tab, a server that stopped writing) while the feed behind it is
   * gone. Report `degraded`, pull a snapshot so state is not silently stale,
   * drop the socket and re-enter the normal backoff path — which resumes from
   * `lastEventId`.
   */
  private onStale() {
    this.staleTimer = null;
    if (this.closed) return;
    this.setStatus("degraded");
    void this.resync();
    this.es?.close();
    this.es = null;
    // Keep `degraded` visible during the wait rather than flashing "connecting".
    this.scheduleReconnect({ announceConnecting: false });
  }

  private scheduleReconnect({ announceConnecting }: { announceConnecting: boolean }) {
    this.sseFailures += 1;
    if (this.sseFailures >= MAX_SSE_FAILURES_BEFORE_FALLBACK) {
      this.startPolling();
      return;
    }
    // Exponential backoff with full jitter, then retry SSE.
    const cap = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.sseFailures);
    const delay = Math.random() * cap;
    if (announceConnecting) this.setStatus("connecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connectSse(), delay);
  }

  private connectSse() {
    if (this.closed || typeof EventSource === "undefined") {
      this.startPolling();
      return;
    }
    this.stopPolling();
    this.clearStaleness();
    this.es?.close();
    this.setStatus("connecting");

    const es = new EventSource(
      statusUrl(this.buildingId, this.feed, this.lastEventId),
      { withCredentials: true }
    );
    this.es = es;

    es.onopen = () => {
      this.sseFailures = 0;
      this.setStatus("open");
      // On a resumed connection `state` is no longer guaranteed to be the
      // first frame — replayed backlog can precede it, with the
      // authoritative snapshot landing last. Nothing here depends on order:
      // handlers apply each frame as it arrives (SNAPSHOT is idempotent) and
      // `resync_required`/heartbeat gap detection cover the case where
      // frames were dropped outright.
      this.armStaleness();
    };

    // Heartbeats are liveness only: they update the cursor and the staleness
    // timer, and lift `degraded`, but they are NOT pushed to subscribers — a
    // frame every 25 s must not re-render the React tree.
    es.addEventListener("heartbeat", (raw) => {
      const frame = raw as MessageEvent;
      this.heartbeatsSeen = true;
      this.lastHeartbeatAtValue = Date.now();
      try {
        const data = JSON.parse(frame.data) as { seq?: number };
        // `seq` here is the BUILDING's true high-water sequence, not this
        // connection's resume cursor — that distinction matters. It is read
        // ONLY to detect a shortfall (compared against `lastSeqValue`, which
        // `noteFrame` below derives solely from frame `id:` values) and is
        // never assigned into `lastSeqValue`/`lastEventId` itself. Feeding it
        // into the cursor would make a future reconnect ask to resume from a
        // point ahead of what this client actually received, skipping
        // frames forever. Sequences are wall-clock-scale and deliberately
        // non-dense, so only the PRESENCE of a shortfall is meaningful —
        // never its magnitude.
        if (
          typeof data.seq === "number" &&
          this.lastSeqValue !== null &&
          data.seq > this.lastSeqValue
        ) {
          void this.resync();
        }
      } catch {
        // Malformed heartbeat body — the frame itself is still proof of life.
      }
      if (this.currentStatus === "degraded") this.setStatus("open");
      this.noteFrame(frame.lastEventId);
    });

    for (const type of SSE_EVENT_TYPES) {
      es.addEventListener(type, (raw) => {
        const frame = raw as MessageEvent;
        this.noteFrame(frame.lastEventId);
        try {
          const data = JSON.parse(frame.data);
          this.emit({ type, data } as BuildingEvent);
        } catch {
          // malformed frame — ignore
        }
      });
    }

    es.onerror = () => {
      es.close();
      if (this.closed) return;
      this.clearStaleness();
      this.scheduleReconnect({ announceConnecting: true });
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
    // Replay the current status, mirroring subscribe()'s snapshot replay. A
    // subscriber then never has to read status() separately — which in React
    // would be a setState straight from an effect body — and cannot miss a
    // transition that lands between reading status() and subscribing.
    cb(this.currentStatus);
    return () => this.statusCbs.delete(cb);
  }

  lastHeartbeatAt(): number | null {
    return this.lastHeartbeatAtValue;
  }

  lastSeq(): number | null {
    return this.lastSeqValue;
  }

  close() {
    this.closed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearStaleness();
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
    lastHeartbeatAt: () => inner.lastHeartbeatAt(),
    lastSeq: () => inner.lastSeq(),
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
