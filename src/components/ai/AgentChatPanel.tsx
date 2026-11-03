import { useEffect, useRef, useState } from "react";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { SpinnerIcon, ZapIcon } from "../ui/icons";
import { cn } from "../../lib/cn";
import { useI18n } from "../../i18n/LanguageProvider";
import { useAgentChat } from "./useAgentChat";
import type { AgentAction } from "../../apis/agentApi";

/* ============================================================================
   The owner-facing agent panel.
   ----------------------------------------------------------------------------
   The Safety Auditor and the analyst are the same shape — a side sheet, some
   seed prompts, a transcript, and actions the owner taps — so they share one
   component parameterised by an i18n namespace rather than existing as two
   near-identical files. The visitor launcher stays separate: it is a floating
   button on a phone with its own chip behaviour, not a panel.

   Every namespace supplies the same key set: title, lead, placeholder, send,
   stop, thinking, checking, empty, s1..s3, unavailableTitle/Body/Cta,
   disclaimer, and action_<name> for each action it can offer.
   ========================================================================= */

export interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  /** Which agent answers — 'auditor', 'analyst', … */
  agentId: string;
  buildingId: string;
  /** i18n namespace holding this agent's copy. */
  namespace: string;
  /** Actions this host can perform. Anything else is ignored, so a new server
   *  action can never drive an older client. */
  knownActions?: string[];
  onRunAction?: (action: AgentAction) => void;
  /** The deterministic thing to do when the assistant is unreachable. */
  onFallbackAction?: () => void;
  className?: string;
}

export function AgentChatPanel({
  open,
  onClose,
  agentId,
  buildingId,
  namespace,
  knownActions = [],
  onRunAction,
  onFallbackAction,
  className,
}: AgentChatPanelProps) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const allowed = new Set(knownActions);

  const chat = useAgentChat(agentId, {
    buildingId,
    locale: lang === "ka" ? "ka" : "en",
  });

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [chat.messages, chat.streaming]);

  const key = (suffix: string) => `${namespace}.${suffix}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(key("title"))}
      className={cn("flex flex-col", className)}
    >
      <p className="px-4 pt-2 text-sm opacity-70">{t(key("lead"))}</p>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-busy={chat.streaming}
      >
        {chat.messages.length === 0 && !chat.unavailable && (
          <div className="space-y-2">
            <p className="text-sm opacity-70">{t(key("empty"))}</p>
            {(["s1", "s2", "s3"] as const).map((seed) => (
              <button
                key={seed}
                type="button"
                className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:opacity-80"
                // Prefilled, not sent: a seed prompt is a starting point the
                // owner usually wants to edit before asking.
                onClick={() => setDraft(t(key(seed)))}
              >
                {t(key(seed))}
              </button>
            ))}
          </div>
        )}

        {chat.messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "mb-3 flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                message.role === "user" ? "bg-[var(--accent)] text-white" : "border",
                message.fallback && "border-amber-400"
              )}
            >
              {message.content}
              {message.actions
                ?.filter((action) => allowed.has(action.name))
                .map((action, actionIndex) => (
                  <Button
                    key={actionIndex}
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => onRunAction?.(action)}
                  >
                    <ZapIcon /> {t(key(`action_${action.name}`))}
                  </Button>
                ))}
            </div>
          </div>
        ))}

        {chat.streaming && (
          <p className="flex items-center gap-2 text-sm opacity-70">
            <SpinnerIcon />
            {chat.activeTool
              ? t(key("checking"), { tool: chat.activeTool })
              : t(key("thinking"))}
          </p>
        )}

        {chat.unavailable && (
          <Alert tone="warning" title={t(key("unavailableTitle"))}>
            <p>{t(key("unavailableBody"))}</p>
            {onFallbackAction && (
              <Button size="sm" className="mt-2" onClick={onFallbackAction}>
                {t(key("unavailableCta"))}
              </Button>
            )}
          </Alert>
        )}
      </div>

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          chat.send(draft);
          setDraft("");
        }}
      >
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          value={draft}
          maxLength={2000}
          placeholder={t(key("placeholder"))}
          onChange={(event) => setDraft(event.target.value)}
        />
        {chat.streaming ? (
          <Button type="button" variant="secondary" onClick={chat.stop}>
            {t(key("stop"))}
          </Button>
        ) : (
          <Button type="submit" disabled={!draft.trim()}>
            {t(key("send"))}
          </Button>
        )}
      </form>

      <p className="px-3 pb-3 text-xs opacity-60">{t(key("disclaimer"))}</p>
    </Sheet>
  );
}
