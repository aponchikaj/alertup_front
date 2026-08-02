import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { SpinnerIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import { useAiChat } from "./useAiChat";
import type { AiContext } from "../../apis/aiApi";

/* ============================================================================
   ProductAiWidget — "ask AlertUp anything", on the public pages.
   ----------------------------------------------------------------------------
   Floating launcher + chat sheet for visitors who have not signed up: what is
   AlertUp, how do I map my building, what does it cost. Talks to the
   anonymous /api/ai/ask endpoint through the same streaming hook as the
   in-building concierge — only the prompt chips and copy differ.
   ========================================================================= */

const CHIP_KEYS = [
  "homeAi.chipWhat",
  "homeAi.chipStart",
  "homeAi.chipEmergency",
  "homeAi.chipPricing",
] as const;

export const ProductAiWidget = ({ className }: { className?: string }) => {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const context = useMemo<AiContext>(
    () => ({ buildingId: null, locale: lang, product: true }),
    [lang],
  );
  const { messages, streaming, unavailable, send, stop, reset } = useAiChat(context);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("homeAi.open")}
        data-testid="product-ai-launcher"
        className={cn(
          "fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-lg transition hover:bg-surface-hover active:scale-[0.98]",
          className,
        )}
      >
        <span aria-hidden="true" className="inline-block size-2 rounded-full bg-brand" />
        {t("homeAi.launcher")}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("homeAi.title")}
        ariaLabel={t("homeAi.title")}
      >
        <div className="flex h-full min-h-0 flex-col">
          <p className="px-1 pb-3 text-sm text-ink-muted">{t("homeAi.subtitle")}</p>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1"
            aria-live="polite"
            aria-busy={streaming}
          >
            {messages.length === 0 && !unavailable ? (
              <p className="py-6 text-center text-sm text-ink-subtle">
                {t("homeAi.empty")}
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
                        {t("homeAi.thinking")}
                      </span>
                    ) : null)}
                </div>
              </div>
            ))}

            {unavailable ? (
              <Alert tone="warning" title={t("homeAi.unavailableTitle")}>
                <p>{t("homeAi.unavailableBody")}</p>
                {/* One transient failure must not kill the widget until a page
                    reload — reset clears the dead state and re-arms the chat. */}
                <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                  {t("homeAi.retry")}
                </Button>
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
                      onClick={() => send(label)}
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
                  placeholder={t("homeAi.placeholder")}
                  aria-label={t("homeAi.placeholder")}
                  className="min-h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base text-ink outline-none placeholder:text-ink-subtle focus-visible:border-line-strong"
                />
                {streaming ? (
                  <Button type="button" variant="secondary" onClick={stop}>
                    {t("homeAi.stop")}
                  </Button>
                ) : (
                  <Button type="submit" disabled={!draft.trim()}>
                    {t("homeAi.send")}
                  </Button>
                )}
              </form>
            </>
          ) : null}

          <p className="px-1 pt-3 text-[11px] leading-snug text-ink-subtle">
            {t("homeAi.disclaimer")}
          </p>
        </div>
      </Sheet>
    </>
  );
};

export default ProductAiWidget;
