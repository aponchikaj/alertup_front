import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import type { FloorSummary } from "../map/types";

/* ============================================================================
   FloorSwitcher — segmented control over the floors a route crosses.
   ----------------------------------------------------------------------------
   Keyed by floor id, never array index: the editor's old index-keyed selector
   was the source of a whole class of "wrong floor" bugs.
   ========================================================================= */

export interface FloorSwitcherProps {
  floors: FloorSummary[];
  /** Floor currently drawn on the map. */
  activeFloorId: string | null;
  /** Floor the user is actually standing on, per route progress. */
  currentFloorId?: string | null;
  onSelect: (floorId: string) => void;
  className?: string;
}

export const FloorSwitcher = ({
  floors,
  activeFloorId,
  currentFloorId = null,
  onSelect,
  className,
}: FloorSwitcherProps) => {
  const { t } = useI18n();

  if (floors.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={t("wayfinding.changeFloor")}
      data-testid="floor-switcher"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1",
        className,
      )}
    >
      {floors.map((floor) => {
        const active = floor.id === activeFloorId;
        const isCurrent = floor.id === currentFloorId;
        return (
          <button
            key={floor.id}
            type="button"
            onClick={() => onSelect(floor.id)}
            aria-pressed={active}
            aria-label={t("wayfinding.floor", { number: floor.floorNumber })}
            className={cn(
              "relative min-h-9 rounded-full px-3 text-sm font-semibold transition",
              active
                ? "bg-brand text-brand-ink"
                : "text-ink-muted hover:bg-surface-hover hover:text-ink",
            )}
          >
            {t("wayfinding.floorShort", { number: floor.floorNumber })}
            {isCurrent ? (
              // A dot marks where the person actually is, so previewing another
              // floor never loses that anchor.
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-2 rounded-full",
                  active ? "bg-brand-ink" : "bg-danger",
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default FloorSwitcher;
