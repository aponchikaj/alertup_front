import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { SpinnerIcon, ArrowUpRightIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import { useAiChat } from "./useAiChat";
import type { AiContext } from "../../apis/aiApi";

/* ============================================================================
   AiChatDrawer — "Wayfinder AI".
   ----------------------------------------------------------------------------
   Bottom sheet on phones, side panel on desktop (the Sheet primitive handles
   the switch). When the assistant is unavailable the drawer does not pretend
   otherwise: it says so and points at the destination search, which always
   works.
   ========================================================================= */

export interface AiChatDrawerProps {
  open: boolean;
  onClose: () => void;
  context: AiContext;
  /** Focus the destination search when the assistant cannot help. */
  onOpenSearch?: () => void;
}

const CHIP_KEYS = [
  "ai.chips.nearestExit",
  "ai.chips.nearestRestroom",
  "ai.chips.foodCourt",
  "ai.chips.whereIs",
] as const;

export const AiChatDrawer = ({
  open,
  onClose,
  context,
  onOpenSearch,
}: AiChatDrawerProps) => {
  const { t } = useI18n();
  const { messages, streaming, unavailable, send, stop } = useAiChat(context);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Follow the stream as it grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || streaming) return;
    send(draft);
    setDraft("");
  };

  const handleChip = (label: string) => {
    // "Where is…" is a prompt for the user, not a question for the model.
    if (label.endsWith("…")) {
      setDraft(label.replace("…", " "));
      inputRef.current?.focus();
      return;
    }
    send(label);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("ai.title")} ariaLabel={t("ai.title")}>
      <div className="flex h-full min-h-0 flex-col">
        <p className="px-1 pb-3 text-sm text-ink-muted">{t("ai.subtitle")}</p>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1"
          aria-live="polite"
          aria-busy={streaming}
        >
          {messages.length === 0 && !unavailable ? (
            <p className="py-6 text-center text-sm text-ink-subtle">
              {t("ai.inputPlaceholder")}
            </p>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-brand text-brand-ink"
                    : "bg-surface-2 text-ink",
                  message.fallback && "border border-warning-border bg-warning-subtle",
                )}
              >
                {message.content ||
                  (streaming ? (
                    <span className="inline-flex items-center gap-2 text-ink-muted">
                      <SpinnerIcon className="size-4" aria-hidden="true" />
                      {t("ai.thinking")}
                    </span>
                  ) : null)}
              </div>
            </div>
          ))}

          {unavailable ? (
            <Alert tone="warning" title={t("ai.unavailableTitle")}>
              <p>{t("ai.unavailableBody")}</p>
              {onOpenSearch ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    onClose();
                    onOpenSearch();
                  }}
                >
                  {t("ai.unavailableCta")}
                  <ArrowUpRightIcon className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </Alert>
          ) : null}
        </div>

        {!unavailable ? (
          <>
            <div className="flex flex-wrap gap-2 px-1 pt-3">
              {CHIP_KEYS.map((key) => {
                const label = t(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChip(label)}
                    disabled={streaming}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-1 pt-3">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("ai.inputPlaceholder")}
                aria-label={t("ai.inputPlaceholder")}
                className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base text-ink outline-none placeholder:text-ink-subtle focus-visible:border-line-strong"
              />
              {streaming ? (
                <Button type="button" variant="secondary" onClick={stop}>
                  {t("ai.stop")}
                </Button>
              ) : (
                <Button type="submit" disabled={!draft.trim()}>
                  {t("ai.send")}
                </Button>
              )}
            </form>
          </>
        ) : null}

        <p className="px-1 pt-3 text-[11px] leading-snug text-ink-subtle">
          {t("ai.disclaimer")}
        </p>
      </div>
    </Sheet>
  );
};

export default AiChatDrawer;
