import { useEffect } from "react";
import { Button } from "../ui/button";
import { Alert, Badge } from "../ui/feedback";
import { ArrowRightIcon, CheckCircleIcon, RouteIcon, ScanIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import { durationMinutes, formatDistance, formatDistanceAndEta } from "../../lib/format";
import { useDeviceHeading } from "../../lib/useDeviceHeading";
import { useLatestRef } from "../../lib/useLatestRef";
import type { RouteProgress } from "./useRouteProgress";
import type { InstructionKind, TransitType } from "../map/types";

/* ============================================================================
   RouteStepper — the turn-by-turn card under the map.
   ----------------------------------------------------------------------------
   The transit card is where floor tracking actually happens: it asks the user
   to confirm they arrived, which is the only signal we can fully trust short
   of a QR rescan. The rescan button sits right next to it for the stronger
   signal.

   When the server sends `instructions[]` the card renders the authored
   bilingual string verbatim — the whole point of server instructions is that
   "turn right at the Coffee Bar" is phrasing the client cannot derive. Without
   them (the backend does not emit them yet) every line falls back to the
   client templates this card has always used.
   ========================================================================= */

const TRANSIT_LABEL_KEYS: Record<TransitType, string> = {
  STAIRS: "wayfinding.transitStairs",
  ELEVATOR: "wayfinding.transitElevator",
  ESCALATOR: "wayfinding.transitEscalator",
  WALKWAY: "wayfinding.transitWalkway",
};

/**
 * CSS degrees applied to ArrowRightIcon, which points east at rest. Straight
 * ahead is "up" the card, so the neutral kinds sit at −90 and each turn is the
 * compass offset from there: −45 per 45° to the left, +45 to the right, and
 * +90 (due south) for the u-turn.
 *
 * Exhaustive over InstructionKind on purpose — a new kind from the builder
 * must fail the type check here rather than silently render an arrow pointing
 * the wrong way.
 */
const INSTRUCTION_ROTATION: Record<InstructionKind, number> = {
  depart: -90,
  straight: -90,
  slight_left: -135,
  left: 180,
  sharp_left: 135,
  uturn: 90,
  slight_right: -45,
  right: 0,
  sharp_right: 45,
  transit: -90,
  arrive: -90,
};

/**
 * The headline of whichever card is showing, and the route's only live region.
 * One region, always mounted in exactly one place, so a screen reader announces
 * each new instruction once instead of racing three regions against each other.
 */
const InstructionTitle = ({ children }: { children: string }) => (
  <p
    data-testid="instruction-title"
    aria-live="polite"
    aria-atomic="true"
    className="font-semibold text-ink"
  >
    {children}
  </p>
);

export interface RouteStepperProps {
  progress: RouteProgress;
  /** Opens the inline QR scanner to re-anchor the route. */
  onRescan?: () => void;
  /** Fires once the compass produces a bearing — the host refetches with it. */
  onHeading?: (heading: number) => void;
  className?: string;
}

export const RouteStepper = ({
  progress,
  onRescan,
  onHeading,
  className,
}: RouteStepperProps) => {
  const { t, lang } = useI18n();
  const { route, activeStep, activeSegment, activeTransition, activeInstruction, atEnd } =
    progress;
  const { heading, state: headingState, request: requestHeading } = useDeviceHeading();

  // The host owns the refetch; the stepper only reports what the compass said.
  const onHeadingRef = useLatestRef(onHeading);
  useEffect(() => {
    if (heading === null) return;
    onHeadingRef.current?.(heading);
  }, [heading, onHeadingRef]);

  if (!route || !activeStep) return null;

  const hasInstructions = (route.instructions?.length ?? 0) > 0;
  const totalSteps = hasInstructions
    ? progress.feedLength
    : route.steps.filter((s) => s.kind !== "arrive").length;
  const stepNumber = Math.min(progress.activeIndex + 1, totalSteps || 1);

  /** The authored line for this instruction, in the language on screen. */
  const serverText = activeInstruction
    ? (activeInstruction.text[lang] ?? activeInstruction.text.en)
    : null;

  const landmark = activeInstruction?.landmark ?? null;
  // `side` is required on the wire, but the route arrives as untyped JSON. A
  // landmark without a usable side says nothing rather than pointing the
  // visitor confidently in a direction nobody chose.
  const sideKey =
    landmark?.side === "left"
      ? "wayfinding.sideLeft"
      : landmark?.side === "right"
        ? "wayfinding.sideRight"
        : null;
  const landmarkLine =
    landmark && sideKey
      ? t("wayfinding.landmark", { name: landmark.name, side: t(sideKey) })
      : null;

  const instructionTotals = activeInstruction
    ? formatDistanceAndEta(
        activeInstruction.distanceM,
        activeInstruction.durationSec,
        lang,
      )
    : null;

  // What's left of the whole journey from this step onward — the number a
  // visitor actually wants mid-walk ("am I nearly there?"), not the leg length.
  const remainingDistance =
    activeStep.distanceUntilM !== undefined
      ? t("wayfinding.remaining", {
          distance: formatDistance(activeStep.distanceUntilM, lang),
        })
      : null;
  const remainingTime =
    activeStep.timeUntilSec !== undefined
      ? t("wayfinding.remainingTime", {
          minutes: durationMinutes(activeStep.timeUntilSec),
        })
      : null;
  const notStepFree = activeSegment?.accessible === false;

  // The chip only means something once the server has phrased the first
  // instruction from the heading we sent it.
  const facing =
    heading !== null && route.instructions?.[0]
      ? t("wayfinding.facing", { deg: heading })
      : null;

  // Only the opening instruction changes with which way you are facing, and a
  // permission prompt is worth showing exactly once.
  const offerCompass = progress.activeIndex === 0 && headingState === "idle";

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
          {t("wayfinding.stepOf", { current: stepNumber, total: totalSteps || 1 })}
        </p>
        {route.destination.poi?.name || route.destination.label ? (
          <p className="truncate text-xs text-ink-muted">
            {t("wayfinding.routeTo", {
              name: route.destination.poi?.name ?? route.destination.label ?? "",
            })}
          </p>
        ) : null}
      </div>

      {remainingDistance || remainingTime || notStepFree || facing ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
          {remainingDistance ? <span>{remainingDistance}</span> : null}
          {remainingDistance && remainingTime ? (
            <span aria-hidden="true">·</span>
          ) : null}
          {remainingTime ? <span>{remainingTime}</span> : null}
          {notStepFree ? (
            <Badge tone="warning">{t("wayfinding.segmentNotAccessible")}</Badge>
          ) : null}
          {facing ? <Badge>{facing}</Badge> : null}
        </div>
      ) : null}

      {route.accessibleRouteUnavailable ? (
        <Alert tone="warning" className="mb-3">
          {t("wayfinding.accessibleUnavailable")}
        </Alert>
      ) : null}

      {activeStep.kind === "walk" && activeSegment ? (
        <div className="flex items-start gap-3">
          {activeInstruction ? (
            <ArrowRightIcon
              data-testid="instruction-arrow"
              className="mt-0.5 size-5 shrink-0 text-brand"
              style={{
                transform: `rotate(${INSTRUCTION_ROTATION[activeInstruction.kind]}deg)`,
              }}
              aria-hidden="true"
            />
          ) : (
            <RouteIcon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <InstructionTitle>
              {serverText ??
                t("wayfinding.stepWalk", {
                  target:
                    activeSegment.nodes.at(-1)?.label ?? t("wayfinding.destination"),
                })}
            </InstructionTitle>
            {landmarkLine ? (
              <p className="text-sm text-ink-muted">{landmarkLine}</p>
            ) : null}
            {instructionTotals ? (
              <p className="text-sm text-ink-muted">{instructionTotals}</p>
            ) : activeSegment.distanceMeters !== null ? (
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
              <InstructionTitle>
                {serverText ??
                  t("wayfinding.takeTransit", {
                    transit: t(TRANSIT_LABEL_KEYS[activeTransition.transitType]),
                    floor: activeTransition.toFloorNumber,
                  })}
              </InstructionTitle>
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
          <InstructionTitle>{serverText ?? t("wayfinding.stepArrive")}</InstructionTitle>
        </div>
      ) : null}

      {headingState === "denied" ? (
        <Alert tone="warning" className="mt-3">
          {t("wayfinding.compassDenied")}
        </Alert>
      ) : null}

      {offerCompass ? (
        <Button
          variant="secondary"
          // Must reach requestPermission synchronously from the tap: iOS drops
          // the prompt if it is deferred.
          onClick={requestHeading}
          className="mt-3 w-full"
        >
          {t("wayfinding.useCompass")}
        </Button>
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
