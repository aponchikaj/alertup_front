import { useEffect, useRef } from "react";
import { Portal, useScrollLock, useFocusTrap } from "../ui/overlayUtils";
import { Button } from "../ui/button";
import { AlertTriangleIcon, ExitDoorIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

/* ============================================================================
   EmergencyOverlay — the full-screen alert.
   ----------------------------------------------------------------------------
   Deliberately plain: no entrance animation to wait through, no scroll-reveal,
   no dependency on JS animation running at all. Meaning is carried by the
   icon, the heading and the layout as well as the colour, because this has to
   read correctly in direct sunlight, on a cracked screen, to a colour-blind
   user who is frightened.

   role="alertdialog" + focus trap: assistive technology announces it
   immediately and keyboard focus cannot wander back to the page behind it.
   ========================================================================= */

export interface EmergencyOverlayProps {
  open: boolean;
  /** Building-supplied instruction; falls back to the generic evacuation copy. */
  message?: string | null;
  /** Switch the page into evacuation routing. */
  onShowRoute: () => void;
  /** "I'm safe" — acknowledges this emergency and returns to normal browsing. */
  onBypass: () => void;
}

export const EmergencyOverlay = ({
  open,
  message,
  onShowRoute,
  onBypass,
}: EmergencyOverlayProps) => {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  useScrollLock(open);
  useFocusTrap(panelRef, open);

  // A short haptic pulse where supported. Feature-detected and wrapped: some
  // browsers expose `vibrate` but throw when the page is not user-activated.
  useEffect(() => {
    if (!open) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* vibration unavailable — the visual alert stands on its own */
    }
  }, [open]);

  // Escape must NOT dismiss this: leaving requires an explicit choice.
  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-4"
        data-testid="emergency-overlay"
      >
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="emergency-overlay-title"
          aria-describedby="emergency-overlay-body"
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-danger-border bg-canvas shadow-xl"
        >
          <div className="flex items-center gap-3 bg-danger px-6 py-4 text-danger-ink">
            <AlertTriangleIcon className="size-8 shrink-0" aria-hidden="true" />
            <h2
              id="emergency-overlay-title"
              className="text-xl font-bold tracking-tight"
            >
              {t("emergency.overlayTitle")}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-6">
            <p id="emergency-overlay-body" className="text-base leading-relaxed text-ink">
              {message?.trim() ? message : t("emergency.overlayBodyDefault")}
            </p>
            <p className="text-sm font-semibold text-danger-text">
              {t("emergency.doNotUseElevators")}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="danger" size="lg" onClick={onShowRoute} autoFocus>
                <ExitDoorIcon className="size-5" aria-hidden="true" />
                {t("emergency.showRoute")}
              </Button>
              <Button variant="secondary" onClick={onBypass}>
                {t("emergency.bypass")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default EmergencyOverlay;
