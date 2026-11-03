import { useCallback, useEffect, useRef, useState } from "react";
import {
  streamAgent,
  type AgentAction,
  type AgentChatMessage,
  type AgentLocale,
} from "../../apis/agentApi";

/* ============================================================================
   Shared conversation state for the tool-using agents.
   ----------------------------------------------------------------------------
   useAiChat.ts serves the three older surfaces and understands text deltas
   only. Rather than widen it — and risk the scan page's concierge, which is a
   safety surface — agents get their own hook that also carries tools and
   actions. The two can converge once every surface has moved over.

   Two behaviours here are deliberate:

   - An assistant turn that produced no text is removed on completion, so a
     failed or empty answer leaves no dead bubble in the transcript.
   - Actions are buffered during the stream and attached to the assistant turn
     only when it finishes. A "Show me the route" button appearing beside a
     half-written sentence invites a tap on an answer that has not landed yet.
   ========================================================================= */

/** Matches the server's per-turn cap; sending more is refused with a 422. */
const MAX_SENT_MESSAGES = 6;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  fallback?: boolean;
  actions?: AgentAction[];
}

export interface UseAgentChatOptions {
  buildingId: string;
  locale: AgentLocale;
  /** Where the visitor scanned in, for agents that route from a position. */
  nodeId?: string | null;
  /** Fired as each action arrives, for hosts that act immediately. */
  onAction?: (action: AgentAction) => void;
}

export interface UseAgentChatResult {
  messages: AgentMessage[];
  streaming: boolean;
  /** The tool currently running, for a "checking…" affordance. */
  activeTool: string | null;
  unavailable: boolean;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
}

export function useAgentChat(
  agentId: string,
  { buildingId, locale, nodeId = null, onAction }: UseAgentChatOptions
): UseAgentChatResult {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // `send` reads the transcript without depending on it, so its identity stays
  // stable across every streamed token. Mirrored in an effect rather than
  // during render: writing a ref while rendering is a tearing hazard under
  // concurrent rendering, and the effect still runs before any user event.
  const messagesRef = useRef<AgentMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Same reason: the caller usually passes a fresh inline callback each render.
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // A closed drawer must not leave a stream running behind it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return;

      const history: AgentChatMessage[] = [
        ...messagesRef.current.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user" as const, content },
      ].slice(-MAX_SENT_MESSAGES);

      setMessages((prev) => [
        ...prev,
        { role: "user", content },
        { role: "assistant", content: "" },
      ]);
      setStreaming(true);
      setUnavailable(false);

      const controller = new AbortController();
      abortRef.current = controller;
      const pendingActions: AgentAction[] = [];

      streamAgent(
        agentId,
        { messages: history, buildingId, nodeId, locale },
        {
          onDelta: (delta, meta) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role !== "assistant") return prev;
              next[next.length - 1] = {
                ...last,
                content: last.content + delta,
                fallback: last.fallback || meta.fallback,
              };
              return next;
            });
          },
          onTool: (tool) => setActiveTool(tool.name),
          onAction: (action) => {
            pendingActions.push(action);
            onActionRef.current?.(action);
          },
          onDone: () => {
            setStreaming(false);
            setActiveTool(null);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role !== "assistant") return prev;
              if (!last.content) return next.slice(0, -1);
              if (pendingActions.length) {
                next[next.length - 1] = { ...last, actions: [...pendingActions] };
              }
              return next;
            });
          },
          onError: () => {
            setStreaming(false);
            setActiveTool(null);
            setUnavailable(true);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant" && !last.content) return next.slice(0, -1);
              return next;
            });
          },
        },
        controller.signal
      );
    },
    [agentId, buildingId, locale, nodeId]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setActiveTool(null);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setActiveTool(null);
    setUnavailable(false);
  }, []);

  return { messages, streaming, activeTool, unavailable, send, stop, reset };
}
