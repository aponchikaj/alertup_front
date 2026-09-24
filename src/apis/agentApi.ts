import { API_BASE_URL } from "./http";

/**
 * Client for the tool-using agents at POST /api/ai/agent/:agentId.
 *
 * Separate from aiApi.ts on purpose. That module's parser predates tool and
 * action frames, and it ships in builds already in the wild; teaching it to
 * ignore frames it has never seen is a migration, whereas a second module is
 * just a second module. Each old surface can move over when it is ready.
 *
 * Unlike aiApi.streamChat this also sends the Bearer token. Every agent is
 * authenticated, and on Safari/iOS the cookie is exactly what goes missing —
 * which is why http.ts sends both on every other call.
 */

export type AgentLocale = "en" | "ka";

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** An action the agent proposes and the host performs. Allow-listed by name. */
export interface AgentAction {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentStreamCallbacks {
  onDelta(text: string, meta: { fallback: boolean }): void;
  /** A tool ran. Used for the "checking your building…" affordance. */
  onTool(tool: { name: string; ok: boolean }): void;
  /** The agent proposes an action; the host decides whether to offer it. */
  onAction(action: AgentAction): void;
  onDone(): void;
  onError(error: unknown): void;
}

interface AgentFrame {
  delta?: string;
  done?: boolean;
  fallback?: boolean;
  tool?: { name: string; ok: boolean };
  action?: AgentAction;
}

export function streamAgent(
  agentId: string,
  body: {
    messages: AgentChatMessage[];
    buildingId: string;
    locale: AgentLocale;
    /** Where the visitor scanned in. Null for agents with no position. */
    nodeId?: string | null;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal
): void {
  void (async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const token = localStorage.getItem("userToken");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {
        // Private mode can throw on access; the cookie still carries the session.
      }

      const res = await fetch(`${API_BASE_URL}/api/ai/agent/${agentId}`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok || !res.body) {
        let message = `Assistant error (${res.status})`;
        try {
          const errorBody = await res.json();
          if (errorBody?.message || errorBody?.Message) {
            message = errorBody.message || errorBody.Message;
          }
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
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as AgentFrame;
            if (parsed.delta) {
              callbacks.onDelta(parsed.delta, { fallback: Boolean(parsed.fallback) });
            }
            if (parsed.tool) callbacks.onTool(parsed.tool);
            if (parsed.action) callbacks.onAction(parsed.action);
            if (parsed.done) {
              finished = true;
              callbacks.onDone();
            }
          } catch {
            // Not JSON — treat as a plain text delta, as aiApi does.
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
