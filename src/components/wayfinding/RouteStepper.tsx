import { Button } from "../ui/button";
import { Alert } from "../ui/feedback";
import { ArrowRightIcon, CheckCircleIcon, RouteIcon, ScanIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import type { RouteProgress } from "./useRouteProgress";
import type { TransitType } from "../map/types";

/* ============================================================================
   RouteStepper — the turn-by-turn card under the map.
   ----------------------------------------------------------------------------
   The transit card is where floor tracking actually happens: it asks the user
   to confirm they arrived, which is the only signal we can fully trust short
   of a QR rescan. The rescan button sits right next to it for the stronger
   signal.
   ========================================================================= */

const TRANSIT_LABEL_KEYS: Record<TransitType, string> = {
  STAIRS: "wayfinding.transitStairs",
  ELEVATOR: "wayfinding.transitElevator",
  ESCALATOR: "wayfinding.transitEscalator",
  WALKWAY: "wayfinding.transitWalkway",
};

export interface RouteStepperProps {
  progress: RouteProgress;
  /** Opens the inline QR scanner to re-anchor the route. */
  onRescan?: () => void;
  className?: string;
}

export const RouteStepper = ({ progress, onRescan, className }: RouteStepperProps) => {
  const { t } = useI18n();
  const { route, activeStep, activeSegment, activeTransition, atEnd } = progress;

  if (!route || !activeStep) return null;

  const walkSteps = route.steps.filter((s) => s.kind !== "arrive").length;
  const stepNumber = Math.min(progress.activeIndex + 1, walkSteps || 1);

  return (
    <div
      data-testid="route-stepper"
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("wayfinding.stepOf", { current: stepNumber, total: walkSteps || 1 })}
        </p>
        {route.destination.poi?.name || route.destination.label ? (
          <p className="truncate text-xs text-ink-muted">
            {t("wayfinding.routeTo", {
              name: route.destination.poi?.name ?? route.destination.label ?? "",
            })}
          </p>
        ) : null}
      </div>

      {route.accessibleRouteUnavailable ? (
        <Alert tone="warning" className="mb-3">
          {t("wayfinding.accessibleUnavailable")}
        </Alert>
      ) : null}

      {activeStep.kind === "walk" && activeSegment ? (
        <div className="flex items-start gap-3">
          <RouteIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {t("wayfinding.stepWalk", {
                target: activeSegment.nodes.at(-1)?.label ?? t("wayfinding.destination"),
              })}
            </p>
            {activeSegment.distanceMeters !== null ? (
              <p className="text-sm text-ink-muted">
                {t("wayfinding.distanceMeters", {
                  meters: activeSegment.distanceMeters,
                })}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeStep.kind === "transit" && activeTransition ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <ArrowRightIcon
              className={cn(
                "mt-0.5 size-5 shrink-0 text-info",
                activeTransition.direction === "up" && "-rotate-90",
                activeTransition.direction === "down" && "rotate-90",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {t("wayfinding.takeTransit", {
                  transit: t(TRANSIT_LABEL_KEYS[activeTransition.transitType]),
                  floor: activeTransition.toFloorNumber,
                })}
              </p>
              {activeTransition.label ? (
                <p className="text-sm text-ink-muted">{activeTransition.label}</p>
              ) : null}
            </div>
          </div>

          {/* The confirmation that drives floor tracking. */}
          <Button onClick={progress.next} className="w-full">
            {t("wayfinding.arrivedOnFloor", { floor: activeTransition.toFloorNumber })}
          </Button>

          {onRescan ? (
            <div className="space-y-1">
              <Button variant="secondary" onClick={onRescan} className="w-full">
                <ScanIcon className="size-4" aria-hidden="true" />
                {t("wayfinding.rescan")}
              </Button>
              <p className="text-center text-xs text-ink-subtle">
                {t("wayfinding.rescanHint")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {atEnd ? (
        <div className="flex items-center gap-3">
          <CheckCircleIcon className="size-5 shrink-0 text-success" aria-hidden="true" />
          <p className="font-semibold text-ink">{t("wayfinding.stepArrive")}</p>
        </div>
      ) : null}

      {activeStep.kind === "walk" ? (
        <Button variant="secondary" onClick={progress.next} className="mt-3 w-full">
          {t("common.next")}
        </Button>
      ) : null}
    </div>
  );
};

export default RouteStepper;
