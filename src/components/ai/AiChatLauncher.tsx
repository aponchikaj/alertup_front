import { useState } from "react";
import { AiChatDrawer } from "./AiChatDrawer";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import type { AiContext } from "../../apis/aiApi";

/* ============================================================================
   AiChatLauncher — floating entry point plus the drawer it opens.
   ----------------------------------------------------------------------------
   `hidden` exists so the scan page can withdraw the assistant while the
   emergency overlay is up: at that moment there is exactly one thing the user
   should be doing, and chatting is not it. It returns after a bypass.
   ========================================================================= */

export interface AiChatLauncherProps {
  context: AiContext;
  hidden?: boolean;
  onOpenSearch?: () => void;
  className?: string;
}

export const AiChatLauncher = ({
  context,
  hidden = false,
  onOpenSearch,
  className,
}: AiChatLauncherProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ai.open")}
        data-testid="ai-launcher"
        className={cn(
          "fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-lg transition hover:bg-surface-hover active:scale-[0.98]",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="inline-block size-2 rounded-full bg-brand"
        />
        {t("ai.title")}
      </button>

      <AiChatDrawer
        open={open}
        onClose={() => setOpen(false)}
        context={context}
        onOpenSearch={onOpenSearch}
      />
    </>
  );
};

export default AiChatLauncher;
