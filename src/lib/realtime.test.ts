import { createBuildingChannel } from "./realtime";
import type { BuildingEvent, ChannelStatus } from "../emergency/types";

/**
 * onStatusChange must replay the channel's current status to a new subscriber
 * synchronously. Without that replay every consumer has to call status()
 * itself right after subscribing — and in React that is a setState directly in
 * an effect body (react-hooks/set-state-in-effect). Making the subscription
 * self-seeding removes the need for the extra call and closes the window where
 * a status change between status() and onStatusChange() would be missed.
 */
describe("createBuildingChannel().onStatusChange", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
  });

  it("invokes the callback immediately with the current status", () => {
    const channel = createBuildingChannel(`b-${Math.random()}`);
    const seen: ChannelStatus[] = [];

    const unsubscribe = channel.onStatusChange((s) => seen.push(s));

    expect(seen).toEqual([channel.status()]);

    unsubscribe();
    channel.close();
  });

  it("stops replaying and stops delivering once unsubscribed", () => {
    const channel = createBuildingChannel(`b-${Math.random()}`);
    const seen: ChannelStatus[] = [];

    const unsubscribe = channel.onStatusChange((s) => seen.push(s));
    expect(seen).toHaveLength(1);

    unsubscribe();
    channel.close();
    expect(seen).toHaveLength(1);
  });
});

/* ============================================================================
   Realtime hardening (F9) — heartbeat, staleness, closures, resumable reconnect
   ----------------------------------------------------------------------------
   jsdom has no EventSource, so the channel falls back to polling unless one is
   installed. FakeEventSource is that stand-in: it records every instance (so a
   reconnect is observable as a second instance with a different URL) and lets a
   test push a named frame with an optional `id:` value.

   `lastEventId` is STICKY, per the SSE spec: a browser's EventSource keeps one
   "last event ID buffer" per connection, and every dispatched event reports
   that buffer's current value — including a frame that carries no `id:` of
   its own, which reports whatever the last id-bearing frame set. The real
   backend never puts an `id:` on `heartbeat` or `resync_required` frames, so
   tests must dispatch those without an id and let this stand-in carry the
   previous value forward, exactly as a real EventSource would.
   ========================================================================= */

type FakeListener = (evt: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  static get last(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }

  url: string;
  withCredentials: boolean;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, FakeListener[]>();
  /** The connection's sticky "last event ID buffer" — starts empty, like a real EventSource. */
  private lastId = "";

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(init?.withCredentials);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: FakeListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(fn);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, fn: FakeListener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((l) => l !== fn)
    );
  }

  close() {
    this.closed = true;
  }

  /** Server accepted the connection. */
  open() {
    this.onopen?.();
  }

  /** Transport-level failure (the browser fires `error` and retries). */
  error() {
    this.onerror?.();
  }

  /**
   * Deliver one named SSE frame, optionally carrying an `id:` value.
   *
   * A closed EventSource can never deliver another event, so dispatching on one
   * throws rather than quietly running listeners that a real browser would have
   * detached. Without this a test can "pass" by driving a socket the production
   * code already dropped.
   *
   * Omitting `id` does NOT mean the delivered event reports an empty
   * `lastEventId` — per spec it reports the sticky buffer, i.e. whatever the
   * last id-bearing frame on this connection set (or "" if none ever has).
   */
  dispatch(type: string, data: unknown, id?: string) {
    if (this.closed) {
      throw new Error(
        `FakeEventSource: dispatch("${type}") on a closed stream (${this.url}) — a real EventSource delivers nothing after close()`
      );
    }
    if (id !== undefined) this.lastId = id;
    const evt = {
      data: JSON.stringify(data),
      lastEventId: this.lastId,
    } as MessageEvent;
    (this.listeners.get(type) ?? []).slice().forEach((fn) => fn(evt));
  }
}

const STALE_AFTER_MS = 55_000;

describe("createBuildingChannel() realtime hardening", () => {
  let idCounter = 0;
  const nextBuildingId = () => `hardening-${(idCounter += 1)}`;

  beforeEach(() => {
    FakeEventSource.instances = [];
    jest.useFakeTimers();
    // Full-jitter backoff: pinned so reconnect delays are deterministic.
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
    (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  });

  afterEach(() => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("records heartbeat time without emitting an event to subscribers, and does not let its body seq overwrite the resumable cursor", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const events: BuildingEvent[] = [];
    channel.subscribe((e) => events.push(e));

    const es = FakeEventSource.last;
    es.open();
    // A real named frame establishes the resumable cursor. The backend
    // never puts an `id:` on a heartbeat frame itself, so it is dispatched
    // with none — the fake's sticky `lastEventId` then carries this frame's
    // id forward, exactly as a real EventSource would.
    const payload = { scanned: 0, evacuated: 0, calledEmergency: 0 };
    es.dispatch("counters_updated", payload, "7");
    const at = Date.now();
    es.dispatch("heartbeat", { seq: 7, serverTime: new Date(at).toISOString() });

    // A 25 s timer must not push React state around, and its own body must
    // not be what set the cursor to 7 — the counters_updated frame already did.
    expect(events).toEqual([{ type: "counters_updated", data: payload }]);
    expect(channel.lastSeq()).toBe(7);
    expect(channel.lastHeartbeatAt()).toBe(at);
    expect(channel.status()).toBe("open");

    channel.close();
  });

  it("keeps a heartbeat's body seq out of the resumable cursor even when it is the very first frame received", () => {
    // The one case where a leak would NOT be silently corrected by the next
    // `noteFrame` call: no real frame has arrived yet, so the sticky
    // `lastEventId` is still "" — and `noteFrame`'s `if (eventId)` guard
    // skips an empty id entirely, leaving whatever `lastSeqValue` already
    // holds untouched. A variant that reintroduces
    // `this.lastSeqValue = data.seq` leaks the heartbeat's building-wide
    // seq straight through, uncorrected, and is caught here.
    const channel = createBuildingChannel(nextBuildingId());
    const es = FakeEventSource.last;
    es.open();

    es.dispatch("heartbeat", { seq: 50, serverTime: "2026-09-25T00:00:00.000Z" });

    expect(channel.lastSeq()).toBeNull();

    channel.close();
  });

  it("stays open through a long silence until a heartbeat has ever been seen", () => {
    // Today's backend sends only a `: hb` SSE comment, which EventSource never
    // surfaces — a calm building is genuinely silent and must not be reported
    // as a lost connection.
    const channel = createBuildingChannel(nextBuildingId());
    FakeEventSource.last.open();

    jest.advanceTimersByTime(10 * 60_000);

    expect(channel.status()).toBe("open");
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.last.closed).toBe(false);

    channel.close();
  });

  it("degrades when heartbeats stop, then recovers on a fresh resumed socket", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const first = FakeEventSource.last;
    first.open();
    // A real named frame sets the resumable cursor; the heartbeat that
    // follows carries no id of its own (the backend never puts one on a
    // heartbeat) but still proves liveness and arms the staleness timer.
    first.dispatch("counters_updated", { scanned: 0, evacuated: 0, calledEmergency: 0 }, "1");
    first.dispatch("heartbeat", { seq: 1, serverTime: "2026-09-25T00:00:00.000Z" });

    jest.advanceTimersByTime(STALE_AFTER_MS);

    expect(channel.status()).toBe("degraded");
    expect(first.closed).toBe(true);
    // Staleness re-syncs from the snapshot endpoint so state is not lost.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/emergency/buildings/"),
      expect.objectContaining({ credentials: "include" })
    );

    // The dropped socket is gone for good: recovery can only come from the
    // backoff path opening a NEW stream, resumed from the last id seen.
    jest.advanceTimersByTime(1_000); // full-jitter backoff, Math.random pinned
    expect(FakeEventSource.instances).toHaveLength(2);
    const second = FakeEventSource.last;
    expect(second).not.toBe(first);
    expect(second.url).toContain("?sinceSeq=1");

    second.open();
    expect(channel.status()).toBe("open");

    second.dispatch("counters_updated", { scanned: 0, evacuated: 0, calledEmergency: 0 }, "2");
    second.dispatch("heartbeat", { seq: 2, serverTime: "2026-09-25T00:01:00.000Z" });
    expect(channel.status()).toBe("open");
    expect(channel.lastSeq()).toBe(2);

    // `heartbeatsSeen` is sticky, so the replacement socket is policed from the
    // moment it opens rather than getting a free pass.
    jest.advanceTimersByTime(STALE_AFTER_MS);
    expect(channel.status()).toBe("degraded");
    expect(second.closed).toBe(true);

    channel.close();
  });

  it("keeps staleness armed on a replacement socket that never beats", () => {
    // `heartbeatsSeen` is sticky for the channel's lifetime: a server that
    // spoke heartbeats before a transport drop is expected to speak them after,
    // so the replacement socket is policed from `onopen` — without waiting for
    // it to prove itself first.
    const channel = createBuildingChannel(nextBuildingId());
    const first = FakeEventSource.last;
    first.open();
    // No id — the backend never puts one on a heartbeat frame.
    first.dispatch("heartbeat", { seq: 1, serverTime: "2026-09-25T00:00:00.000Z" });

    first.error(); // transport drop, not staleness
    jest.advanceTimersByTime(1_000);
    const second = FakeEventSource.last;
    expect(second).not.toBe(first);
    second.open();
    expect(channel.status()).toBe("open");

    // Not one heartbeat on this socket — the arming must come from the sticky
    // flag, not from a fresh one.
    jest.advanceTimersByTime(STALE_AFTER_MS);

    expect(channel.status()).toBe("degraded");
    expect(second.closed).toBe(true);

    channel.close();
  });

  it("degrades when a backend that was sending heartbeats goes quiet mid-session", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const es = FakeEventSource.last;
    es.open();

    // Several healthy beats at the server's 25 s cadence: each one re-arms.
    // None carries an id of its own — the backend never puts one on a
    // heartbeat frame.
    for (const seq of [1, 2, 3]) {
      jest.advanceTimersByTime(25_000);
      es.dispatch("heartbeat", { seq, serverTime: `2026-09-25T00:00:${seq}0.000Z` });
      expect(channel.status()).toBe("open");
    }

    // ...then the server stops writing while the socket still looks alive.
    jest.advanceTimersByTime(STALE_AFTER_MS - 1_000);
    expect(channel.status()).toBe("open");

    jest.advanceTimersByTime(1_000);
    expect(channel.status()).toBe("degraded");
    expect(es.closed).toBe(true);
    // No real named frame ever arrived in this session, only heartbeats —
    // the cursor stays null.
    expect(channel.lastSeq()).toBeNull();

    channel.close();
  });

  it("re-arms the staleness timer on every named data frame", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const es = FakeEventSource.last;
    es.open();
    // No id — the backend never puts one on a heartbeat frame.
    es.dispatch("heartbeat", { seq: 1, serverTime: "2026-09-25T00:00:00.000Z" });

    jest.advanceTimersByTime(40_000);
    es.dispatch("counters_updated", { scanned: 1, evacuated: 0, calledEmergency: 0 }, "2");

    // 56 s after the heartbeat: stale only if the data frame did not re-arm.
    jest.advanceTimersByTime(16_000);
    expect(channel.status()).toBe("open");
    expect(channel.lastSeq()).toBe(2);

    // 55 s after the data frame.
    jest.advanceTimersByTime(STALE_AFTER_MS - 16_000);
    expect(channel.status()).toBe("degraded");

    channel.close();
  });

  it("resumes a manual reconnect with ?sinceSeq=<last event id>", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const first = FakeEventSource.last;
    expect(first.url).not.toContain("sinceSeq");
    first.open();
    // A real named frame is what carries a resumable id in production — a
    // heartbeat never does.
    first.dispatch("counters_updated", { scanned: 0, evacuated: 0, calledEmergency: 0 }, "42");

    first.error();
    jest.advanceTimersByTime(1_000); // full-jitter backoff, Math.random pinned

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.last.url).toContain("?sinceSeq=42");

    channel.close();
  });

  it("delivers closure_changed frames to subscribers", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const events: BuildingEvent[] = [];
    channel.subscribe((e) => events.push(e));

    const payload = {
      closureId: "c1",
      action: "created" as const,
      blocked: true,
      edgeIds: ["e1", "e2"],
      nodeIds: [],
      reason: "spill",
      endsAt: null,
    };
    FakeEventSource.last.open();
    FakeEventSource.last.dispatch("closure_changed", payload, "9");

    expect(events).toEqual([{ type: "closure_changed", data: payload }]);

    channel.close();
  });

  it("resyncs when a heartbeat's seq is ahead of what this connection has received, without leaking that seq into the resume cursor", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const es = FakeEventSource.last;
    es.open();
    // Establish a baseline: this connection has genuinely received frame 5.
    es.dispatch("counters_updated", { scanned: 1, evacuated: 0, calledEmergency: 0 }, "5");

    (global.fetch as jest.Mock).mockClear();

    // The heartbeat carries no id of its own (the backend never puts one on
    // a heartbeat frame), so the sticky cursor stays at 5 — but its body
    // reports the building is at 50 — frames 6..50 were emitted and this
    // socket never saw them. The size of that gap is irrelevant; only the
    // fact that seq > what we've received matters.
    es.dispatch("heartbeat", { seq: 50, serverTime: "2026-09-25T00:00:00.000Z" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/emergency/buildings/"),
      expect.objectContaining({ credentials: "include" })
    );

    // A reconnect must resume from the last real frame id we actually
    // received (5), never from the heartbeat's building-wide seq (50) —
    // feeding 50 into the cursor would ask the server to resume from a point
    // ahead of what this client actually saw and skip frames forever.
    es.error();
    jest.advanceTimersByTime(1_000); // full-jitter backoff, Math.random pinned
    expect(FakeEventSource.last.url).toContain("?sinceSeq=5");
    expect(FakeEventSource.last.url).not.toContain("sinceSeq=50");

    channel.close();
  });

  it("does not resync on a heartbeat whose seq merely matches what was already received", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const es = FakeEventSource.last;
    es.open();
    es.dispatch("counters_updated", { scanned: 1, evacuated: 0, calledEmergency: 0 }, "5");

    (global.fetch as jest.Mock).mockClear();

    // No frames missed: the heartbeat's seq does not exceed what this
    // connection has already received. No id — the backend never puts one
    // on a heartbeat frame.
    es.dispatch("heartbeat", { seq: 5, serverTime: "2026-09-25T00:00:00.000Z" });

    expect(global.fetch).not.toHaveBeenCalled();

    channel.close();
  });

  it("treats resync_required as an instruction to rebuild state without dropping the connection", () => {
    const channel = createBuildingChannel(nextBuildingId());
    const events: BuildingEvent[] = [];
    channel.subscribe((e) => events.push(e));
    const es = FakeEventSource.last;
    es.open();

    (global.fetch as jest.Mock).mockClear();

    // No id — the backend never puts one on a resync_required frame either.
    es.dispatch("resync_required", { reason: "backlog_truncated", atSeq: 120 });

    // A truncated replay means missed frames that will never be replayed —
    // the client must rebuild from a fresh snapshot rather than assume it
    // is caught up.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/emergency/buildings/"),
      expect.objectContaining({ credentials: "include" })
    );
    expect(events).toEqual([
      { type: "resync_required", data: { reason: "backlog_truncated", atSeq: 120 } },
    ]);

    // The socket itself is healthy — a truncated replay is not a transport
    // failure, so resync must not tear the connection down.
    expect(es.closed).toBe(false);
    expect(channel.status()).toBe("open");

    channel.close();
  });
});
