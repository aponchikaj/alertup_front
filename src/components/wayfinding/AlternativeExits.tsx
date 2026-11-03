import { Button } from "../ui/button";
import { useI18n } from "../../i18n/LanguageProvider";
import { formatDistanceAndEta } from "../../lib/format";
import { cn } from "../../lib/cn";
import { isEmergencyRoute } from "./emergencyRoute";
import type { AssembledRoute } from "../map/types";

/* ============================================================================
   AlternativeExits — evacuation-only "or try this exit instead" list.
   ----------------------------------------------------------------------------
   The backend only ever sends `route.alternatives[]` on an evacuation route
   (mode EVACUATION, or a route requested with profile "emergency"). Every
   other route shape simply omits the field, so this renders nothing rather
   than asserting a section title over an empty list.

   Each option is a plain secondary button whose visible text — never an icon
   or a colour alone — carries the exit's label, its floor, and its distance
   and ETA, so the choice reads the same to a screen reader as it does at a
   glance.
   ========================================================================= */

const MAX_ALTERNATIVES = 2;

export interface AlternativeExitsProps {
  route: AssembledRoute;
  /** Fires with the exit node id and its display label. */
  onSelect: (exitNodeId: string, label: string) => void;
  className?: string;
}

export const AlternativeExits = ({ route, onSelect, className }: AlternativeExitsProps) => {
  const { t, lang } = useI18n();

  const alternatives = (route.alternatives ?? [])
    .filter((alt) => alt.exitNodeId !== route.destination.nodeId)
    .slice(0, MAX_ALTERNATIVES);

  if (!isEmergencyRoute(route) || alternatives.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-ink">{t("wayfinding.alternativeExits")}</h3>
      <div className="flex flex-wrap gap-2">
        {alternatives.map((alt) => {
          const label = alt.label || t("route.emergencyExit");
          return (
            <Button
              key={alt.exitNodeId}
              variant="secondary"
              onClick={() => onSelect(alt.exitNodeId, label)}
            >
              <span className="truncate">{label}</span>
              <span className="text-xs font-normal text-ink-muted">
                {t("wayfinding.floor", { number: alt.floorNumber })}
                {/* Sighted punctuation only — the accessible name reads
                    "North exit Floor 1 80 m · 3 min" without it, and a
                    "middle dot" announced mid-evacuation is pure noise. */}
                <span aria-hidden="true">{" · "}</span>
                {formatDistanceAndEta(alt.distanceM, alt.durationSec, lang)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default AlternativeExits;
