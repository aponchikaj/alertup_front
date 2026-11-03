import { EvacuateIcon } from "../ui/safetyIcons";
import { Button } from "../ui/button";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";

/* ============================================================================
   EmergencyBanner — the persistent reminder after a bypass.
   ----------------------------------------------------------------------------
   Someone who tapped "I'm safe" keeps browsing, but the building is still on
   fire. This never goes away while the emergency is active, and it always
   offers one tap back to the exit route.
   ========================================================================= */

export interface EmergencyBannerProps {
  /** Return to evacuation routing. */
  onViewRoute?: () => void;
  className?: string;
}

export const EmergencyBanner = ({ onViewRoute, className }: EmergencyBannerProps) => {
  const { t } = useI18n();

  return (
    // `alert`/`assertive`, not `status`/`polite`: polite makes a screen reader
    // hold the announcement until the user pauses. For a banner that means
    // "the building is still in an emergency", waiting for a gap is wrong.
    <div
      role="alert"
      aria-live="assertive"
      data-testid="emergency-banner"
      className={cn(
        "sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-alarm px-4 py-3 text-center text-alarm-ink",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-bold tracking-wide">
        <EvacuateIcon title="" size={17} className="shrink-0" />
        {t("emergency.bannerText")}
      </span>
      {onViewRoute ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewRoute}
          className="text-alarm-ink underline underline-offset-2 hover:bg-black/10"
        >
          {t("emergency.bannerAction")}
        </Button>
      ) : null}
    </div>
  );
};

export default EmergencyBanner;
