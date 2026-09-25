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
 *
 * Rendered ONCE, from a single place in the tree, so React keeps the same DOM
 * node across walk → transit → arrive. That identity is the whole mechanism: a
 * live region only announces changes to a region the screen reader was already
 * watching, so mounting a fresh <p aria-live> per card kind announced the
 * first instruction and then went silent for the rest of the journey.
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
  /**
   * The headline for whichever card is showing: the authored server line when
   * there is one, otherwise the client template for this step kind. Resolved
   * here rather than per branch so the live region below has exactly one
   * source of truth — and so the landmark check underneath can read it.
   */
  const titleText =
    serverText ??
    (activeStep.kind === "walk"
      ? // Guard BEFORE the arrive branch: a walk step whose segmentIndex does
        // not resolve (activeSegment null) must render no headline rather
        // than fall through to "You have arrived" — the wrong direction to
        // fail in for someone evacuating. The live region stays mounted with
        // empty text rather than unmounting, so its identity survives.
        (activeSegment
          ? t("wayfinding.stepWalk", {
              target: activeSegment.nodes.at(-1)?.label ?? t("wayfinding.destination"),
            })
          : "")
      : activeStep.kind === "transit" && activeTransition
        ? t("wayfinding.takeTransit", {
            transit: t(TRANSIT_LABEL_KEYS[activeTransition.transitType]),
            floor: activeTransition.toFloorNumber,
          })
        : t("wayfinding.stepArrive"));

  /**
   * The server's authored line usually NAMES the landmark already — B10 emits
   * "Turn right at Shop B" alongside `landmark: {name: "Shop B", …}`. Printing
   * "Shop B on your right" underneath it then says the same thing twice on
   * screen, and twice inside a single aria-live announcement.
   *
   * The rule: the separate line exists to rescue a landmark the sentence above
   * it dropped, so it renders only when the title does not already contain the
   * landmark's name — a plain case-insensitive substring test, which is honest
   * about what it can check. It costs a duplicate only where the server names
   * the landmark in some declined or transliterated form the title does not
   * literally contain; it never loses the landmark.
   */
  const landmarkAlreadySaid =
    landmark !== null &&
    titleText.toLowerCase().includes(landmark.name.trim().toLowerCase());

  const landmarkLine =
    landmark && sideKey && !landmarkAlreadySaid
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

  /**
   * The icon beside the title. Decoration in every case — `aria-hidden`, with
   * the direction it draws carried by `titleText` — so it is free to change
   * shape between card kinds without costing the live region its identity.
   */
  const headIcon = atEnd ? (
    <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
  ) : activeStep.kind === "transit" && activeTransition ? (
    <ArrowRightIcon
      className={cn(
        "mt-0.5 size-5 shrink-0 text-info",
        activeTransition.direction === "up" && "-rotate-90",
        activeTransition.direction === "down" && "rotate-90",
      )}
      aria-hidden="true"
    />
  ) : activeInstruction ? (
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
  );

  /** The supporting line under the title, per card kind. */
  const subLine =
    activeStep.kind === "transit"
      ? (activeTransition?.label ?? null)
      : activeStep.kind === "walk"
        ? (instructionTotals ??
          (activeSegment && activeSegment.distanceMeters !== null
            ? t("wayfinding.distanceMeters", {
                meters: activeSegment.distanceMeters,
              })
            : null))
        : null;

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

      {/* ONE headline block for all three card kinds. The icon and the lines
          under the title change; the title element itself never unmounts, so
          the live region keeps its identity across the whole walk. */}
      <div className="flex items-start gap-3">
        {headIcon}
        <div className="min-w-0">
          <InstructionTitle>{titleText}</InstructionTitle>
          {landmarkLine ? (
            <p className="text-sm text-ink-muted">{landmarkLine}</p>
          ) : null}
          {subLine ? <p className="text-sm text-ink-muted">{subLine}</p> : null}
        </div>
      </div>

      {activeStep.kind === "transit" && activeTransition ? (
        <div className="mt-3 space-y-3">
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
