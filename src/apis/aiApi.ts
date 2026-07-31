// Streaming client for POST /api/ai/chat. The one API module that bypasses
// the shared request() wrapper: it consumes the SSE-over-fetch body via
// ReadableStream. The frame parser is isolated here so the backend contract
// can evolve without touching UI code.

import { API_BASE_URL } from "./http";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiContext {
  buildingId: string | null;
  nodeId?: string | null;
  destinationNodeId?: string | null;
  locale: "en" | "ka";
}

export interface StreamCallbacks {
  onDelta: (text: string, meta: { fallback: boolean }) => void;
  onDone: () => void;
  onError: (error: unknown) => void;
}

/**
 * Send the conversation and stream the reply. Returns an abort function.
 * Frames: `data: {"delta":"..."}` lines, terminated by `data: {"done":true}`.
 */
export function streamChat(
  messages: AiChatMessage[],
  context: AiContext,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): void {
  void (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          buildingId: context.buildingId,
          nodeId: context.nodeId ?? null,
          destinationNodeId: context.destinationNodeId ?? null,
          locale: context.locale,
        }),
        signal,
      });

      if (!res.ok || !res.body) {
        let message = `Assistant error (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message || body?.Message) message = body.message || body.Message;
        } catch {
          // non-JSON error body
        }
        callbacks.onError(new Error(message));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const handleFrame = (frame: string) => {
        // Each SSE frame may hold multiple lines; we only care about data:.
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as {
              delta?: string;
              done?: boolean;
              fallback?: boolean;
            };
            if (parsed.delta) {
              callbacks.onDelta(parsed.delta, { fallback: Boolean(parsed.fallback) });
            }
            if (parsed.done) {
              finished = true;
              callbacks.onDone();
            }
          } catch {
            // Not JSON — treat as plain text delta (defensive).
            callbacks.onDelta(payload, { fallback: false });
          }
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (frame.trim()) handleFrame(frame);
        }
      }
      if (buffer.trim()) handleFrame(buffer);
      if (!finished) callbacks.onDone();
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        callbacks.onDone();
        return;
      }
      callbacks.onError(err);
    }
  })();
}
