import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat, type AiChatMessage, type AiContext } from "../../apis/aiApi";

/* ============================================================================
   useAiChat — conversation state over the streaming endpoint.
   ----------------------------------------------------------------------------
   Deltas arrive far faster than React needs to paint, so they are buffered and
   flushed once per animation frame. Without that, a fast reply re-renders the
   message list on every token and janks the sheet animation on a mid-range
   phone — which is exactly the device this runs on.
   ========================================================================= */

export interface ChatMessage extends AiChatMessage {
  id: string;
  /** Marks the static fallback the server sends when Groq is unavailable. */
  fallback?: boolean;
}

export interface UseAiChatResult {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  /** True once a request has failed — the UI degrades to a search prompt. */
  unavailable: boolean;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function useAiChat(context: AiContext): UseAiChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const flush = useCallback(() => {
    frameRef.current = null;
    const chunk = bufferRef.current;
    if (!chunk) return;
    bufferRef.current = "";
    const targetId = activeIdRef.current;
    if (!targetId) return;
    setMessages((current) =>
      current.map((m) =>
        m.id === targetId ? { ...m, content: m.content + chunk } : m,
      ),
    );
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(flush)
        : (setTimeout(flush, 16) as unknown as number);
  }, [flush]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    flush();
    setStreaming(false);
  }, [flush]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = {
        id: nextId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = nextId();
      activeIdRef.current = assistantId;

      // The wire history excludes the placeholder we are about to append.
      const history: AiChatMessage[] = [...messages, userMessage]
        .slice(-6)
        .map(({ role, content }) => ({ role, content }));

      setMessages((current) => [
        ...current,
        userMessage,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      streamChat(
        history,
        contextRef.current,
        {
          onDelta: (delta, meta) => {
            bufferRef.current += delta;
            if (meta.fallback) {
              setMessages((current) =>
                current.map((m) =>
                  m.id === assistantId ? { ...m, fallback: true } : m,
                ),
              );
            }
            scheduleFlush();
          },
          onDone: () => {
            flush();
            setStreaming(false);
            abortRef.current = null;
          },
          onError: (err) => {
            flush();
            setStreaming(false);
            abortRef.current = null;
            setUnavailable(true);
            setError(err instanceof Error ? err.message : String(err));
            // Drop the empty placeholder so the transcript has no dead turn.
            setMessages((current) =>
              current.filter((m) => !(m.id === assistantId && m.content === "")),
            );
          },
        },
        controller.signal,
      );
    },
    [messages, streaming, scheduleFlush, flush],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
    setUnavailable(false);
  }, [stop]);

  // Abandon an in-flight stream when the drawer unmounts: nobody is reading it
  // and the server aborts its Groq call as soon as the connection drops.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (frameRef.current !== null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frameRef.current);
        } else {
          clearTimeout(frameRef.current);
        }
      }
    },
    [],
  );

  return { messages, streaming, error, unavailable, send, stop, reset };
}

export default useAiChat;
