import { useEffect, useRef, useState } from "react";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { SpinnerIcon } from "../ui/icons";
import { cn } from "../../lib/cn";
import { useI18n } from "../../i18n/LanguageProvider";
import { useAgentChat } from "./useAgentChat";
import type { AgentAction } from "../../apis/agentApi";

/* ============================================================================
   Wayfinder AI — the visitor agent, and the reason this whole thing exists.
   ----------------------------------------------------------------------------
   The old concierge could only answer "the pharmacy is on floor 2 — pick it in
   the search so the route draws". It literally asked the visitor to go and do
   the work, because it had no way to do it itself. This one calls
   show_route_to and the route appears.

   An action is offered as a BUTTON, not performed silently. The agent can be
   confidently wrong about which of two similarly-named shops you meant, and a
   map that redraws itself mid-sentence is disorienting. One tap is the whole
   cost of being sure.

   During an active emergency the HOST unmounts this entirely — an evacuating
   person should not be typing, and the overlay carries a grounded one-line
   brief instead. Unmounting rather than hiding also means the open drawer and
   its transcript go away with it, instead of waiting behind the overlay.
   ========================================================================= */

interface WayfinderAgentLauncherProps {
  buildingId: string;
  nodeId: string;
  /** Draw the route the agent proposed. */
  onShowRoute: (selection: { poiId?: string; nodeId?: string; name: string }) => void;
  /** Focus the destination search — the escape hatch when AI is down. */
  onOpenSearch?: () => void;
  className?: string;
}

const CHIP_KEYS = ["nearestExit", "nearestRestroom", "foodCourt", "whereIs"] as const;

export function WayfinderAgentLauncher({
  buildingId,
  nodeId,
  onShowRoute,
  onOpenSearch,
  className,
}: WayfinderAgentLauncherProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const chat = useAgentChat("wayfinder", {
    buildingId,
    nodeId,
    locale: lang === "ka" ? "ka" : "en",
  });

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [chat.messages, chat.streaming]);

  const runAction = (action: AgentAction) => {
    if (action.name !== "show_route_to") return;
    const name = typeof action.args.name === "string" ? action.args.name : "";
    const poiId = typeof action.args.poiId === "string" ? action.args.poiId : undefined;
    const targetNodeId = typeof action.args.nodeId === "string" ? action.args.nodeId : undefined;
    if (!poiId && !targetNodeId) return;
    onShowRoute({ poiId, nodeId: targetNodeId, name });
    setOpen(false);
  };

  return (
    <>
      <Button
        className={cn("fixed bottom-4 right-4 z-40", className)}
        data-testid="wayfinder-agent-launcher"
        onClick={() => setOpen(true)}
        aria-label={t("ai.open")}
      >
        {t("ai.title")}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("ai.title")}>
        <p className="px-4 pt-2 text-sm opacity-70">{t("ai.subtitle")}</p>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3"
          aria-live="polite"
          aria-busy={chat.streaming}
        >
          {chat.messages.length === 0 && !chat.unavailable && (
            <div className="flex flex-wrap gap-2">
              {CHIP_KEYS.map((key) => {
                const label = t(`ai.chips.${key}`);
                return (
                  <button
                    key={key}
                    type="button"
                    className="rounded-full border px-3 py-1 text-sm hover:opacity-80"
                    onClick={() => {
                      // "Where is…" is an unfinished sentence: prefill it and
                      // let them name the place rather than sending a stub.
                      if (label.endsWith("…")) setDraft(label.replace("…", " "));
                      else chat.send(label);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
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
                  ?.filter((action) => action.name === "show_route_to")
                  .map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => runAction(action)}
                    >
                      {typeof action.args.name === "string" && action.args.name
                        ? `${t("ai.showRoute")} — ${action.args.name}`
                        : t("ai.showRoute")}
                    </Button>
                  ))}
              </div>
            </div>
          ))}

          {chat.streaming && (
            <p className="flex items-center gap-2 text-sm opacity-70">
              <SpinnerIcon />
              {chat.activeTool ? t("ai.searching") : t("ai.thinking")}
            </p>
          )}

          {chat.unavailable && (
            <Alert tone="warning" title={t("ai.unavailableTitle")}>
              <p>{t("ai.unavailableBody")}</p>
              {onOpenSearch && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setOpen(false);
                    onOpenSearch();
                  }}
                >
                  {t("ai.unavailableCta")}
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
            maxLength={500}
            placeholder={t("ai.inputPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
          {chat.streaming ? (
            <Button type="button" variant="secondary" onClick={chat.stop}>
              {t("ai.stop")}
            </Button>
          ) : (
            <Button type="submit" disabled={!draft.trim()}>
              {t("ai.send")}
            </Button>
          )}
        </form>

        <p className="px-3 pb-3 text-xs opacity-60">{t("ai.disclaimer")}</p>
      </Sheet>
    </>
  );
}
