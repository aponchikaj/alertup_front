import { useCallback, useMemo, useState } from "react";
import type { AssembledRoute, RouteInstruction } from "../map/types";

/* ============================================================================
   useRouteProgress — one source of truth for "where in the route am I?".
   ----------------------------------------------------------------------------
   A single `activeIndex` drives the stepper, the floor switcher and the map
   together. Browsing floors is deliberately separate state (`previewFloorId`):
   peeking at floor 3 must not claim the user has walked there.

   `activeIndex` indexes the *feed*, not `route.steps`. The server's
   `instructions[]` are finer-grained than steps — "leave the lobby", "turn
   right at the Coffee Bar" and "take the escalator" can all belong to the same
   walk step — so the feed is one entry per instruction, each carrying the step
   it renders on. When the backend sends no instructions (it does not yet) the
   feed is the identity over `route.steps` and every consumer behaves exactly as
   it did before.
   ========================================================================= */

/** One advance of the stepper: an instruction plus the step it belongs to. */
export interface RouteFeedEntry {
  /** Index into `route.steps` — what the map and the 3D scene consume. */
  stepIndex: number;
  /** The server instruction, or null on an identity (no-instructions) feed. */
  instruction: RouteInstruction | null;
}

/** Index of the step an instruction belongs to, or -1 when nothing matches. */
const stepIndexForInstruction = (
  route: AssembledRoute,
  instruction: RouteInstruction,
): number => {
  if (instruction.kind === "arrive") {
    return route.steps.findIndex((step) => step.kind === "arrive");
  }

  if (instruction.kind === "transit") {
    const change = instruction.floorChange;
    if (change) {
      const byFloors = route.steps.findIndex((step) => {
        if (step.kind !== "transit") return false;
        const transition = route.transitions[step.transitionIndex];
        return (
          transition?.fromFloorNumber === change.fromFloorNumber &&
          transition?.toFloorNumber === change.toFloorNumber
        );
      });
      if (byFloors >= 0) return byFloors;
    }
    // Same two floors joined twice (parallel escalator banks), or a floorChange
    // the builder could not fill: fall back to position in the walk order.
    return route.steps.findIndex(
      (step) =>
        step.kind === "transit" &&
        route.transitions[step.transitionIndex]?.afterSegmentIndex ===
          instruction.segmentIndex,
    );
  }

  return route.steps.findIndex(
    (step) => step.kind === "walk" && step.segmentIndex === instruction.segmentIndex,
  );
};

/**
 * Pure: the ordered feed the stepper walks.
 *
 * An instruction that maps to nothing (a segment index the steps do not cover)
 * is pinned to the last step we did map, so a malformed instruction shows up as
 * a redundant card rather than as a blank screen or an out-of-range step index.
 */
export function buildFeed(route: AssembledRoute | null): RouteFeedEntry[] {
  if (!route) return [];

  const instructions = route.instructions ?? [];
  if (instructions.length === 0) {
    return route.steps.map((_, stepIndex) => ({ stepIndex, instruction: null }));
  }

  const feed: RouteFeedEntry[] = [];
  let lastMapped = 0;
  for (const instruction of instructions) {
    const found = stepIndexForInstruction(route, instruction);
    const stepIndex = found >= 0 ? found : lastMapped;
    lastMapped = stepIndex;
    feed.push({ stepIndex, instruction });
  }
  return feed;
}

export interface RouteProgress {
  route: AssembledRoute | null;
  /** Position in the feed — what `next`/`previous`/`goToStep` move. */
  activeIndex: number;
  /** Position in `route.steps` — what the map and the 3D scene consume. */
  activeStepIndex: number;
  /** The server instruction being shown, or null without instructions. */
  activeInstruction: RouteInstruction | null;
  feedLength: number;
  activeStep: AssembledRoute["steps"][number] | null;
  /** Segment the user is walking, or the one they are leaving during a transit. */
  activeSegment: AssembledRoute["segments"][number] | null;
  activeTransition: AssembledRoute["transitions"][number] | null;
  /** Floor shown on the map: the preview when browsing, else the active step's. */
  displayFloorId: string | null;
  displayFloorNumber: number | null;
  previewFloorId: string | null;
  isPreviewing: boolean;
  atEnd: boolean;
  next: () => void;
  previous: () => void;
  goToStep: (index: number) => void;
  previewFloor: (floorId: string | null) => void;
  /** Re-anchor after a QR rescan: jump to the step on that floor. */
  syncToFloorNumber: (floorNumber: number) => void;
  reset: () => void;
}

export function useRouteProgress(route: AssembledRoute | null): RouteProgress {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewFloorId, setPreviewFloorId] = useState<string | null>(null);

  const feed = useMemo(() => buildFeed(route), [route]);

  /**
   * A position is only meaningful on the route it was taken on. When a new
   * route arrives — a profile change, a heading refetch, a fresh destination —
   * progress restarts at its first instruction rather than carrying an index
   * across: on a shorter route that index addresses nothing, and the card would
   * silently fall back to step 0 while the counter still read the old position.
   *
   * Adjusting state during render (rather than in an effect) is deliberate:
   * React re-runs this component before committing, so the out-of-range state
   * is never rendered to the DOM, never painted and never seen by an effect.
   */
  const [progressRoute, setProgressRoute] = useState(route);
  if (progressRoute !== route) {
    setProgressRoute(route);
    setActiveIndex(0);
    setPreviewFloorId(null);
  }

  // Belt and braces for the same render: an index past the end addresses the
  // first entry, so `activeStepIndex` is always a real step.
  const safeIndex = activeIndex < feed.length ? activeIndex : 0;
  const activeEntry = feed[safeIndex] ?? null;
  const activeStepIndex = activeEntry?.stepIndex ?? 0;
  const activeInstruction = activeEntry?.instruction ?? null;

  const steps = route?.steps ?? [];
  const activeStep = steps[activeStepIndex] ?? null;

  const activeSegment = useMemo(() => {
    if (!route || !activeStep) return null;
    if (activeStep.kind === "walk") {
      return route.segments[activeStep.segmentIndex] ?? null;
    }
    if (activeStep.kind === "transit") {
      // During a transit the map still shows the floor being left.
      const transition = route.transitions[activeStep.transitionIndex];
      return transition
        ? (route.segments[transition.afterSegmentIndex] ?? null)
        : null;
    }
    return route.segments[route.segments.length - 1] ?? null;
  }, [route, activeStep]);

  const activeTransition = useMemo(() => {
    if (!route || activeStep?.kind !== "transit") return null;
    return route.transitions[activeStep.transitionIndex] ?? null;
  }, [route, activeStep]);

  const activeFloorId = activeSegment?.floor?.id ?? null;
  const displayFloorId = previewFloorId ?? activeFloorId;

  const displayFloorNumber = useMemo(() => {
    if (!route) return null;
    if (!previewFloorId) return activeSegment?.floor?.floorNumber ?? null;
    const previewed = route.segments.find((s) => s.floor?.id === previewFloorId);
    return previewed?.floor?.floorNumber ?? null;
  }, [route, previewFloorId, activeSegment]);

  const feedLength = feed.length;

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= feedLength) return;
      setActiveIndex(index);
      // Advancing the route means the user moved: stop previewing.
      setPreviewFloorId(null);
    },
    [feedLength],
  );

  const next = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, Math.max(feedLength - 1, 0)));
    setPreviewFloorId(null);
  }, [feedLength]);

  const previous = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0));
    setPreviewFloorId(null);
  }, []);

  const previewFloor = useCallback(
    (floorId: string | null) => {
      // Selecting the floor you are already on is not a preview.
      setPreviewFloorId(floorId === activeFloorId ? null : floorId);
    },
    [activeFloorId],
  );

  /**
   * A QR rescan tells us the true floor. Jump to the first feed entry whose
   * step is a walk on it, so a user who took the stairs early (or wandered)
   * lands on the right leg — and, with instructions, on that floor's *first*
   * instruction rather than partway through it.
   */
  const syncToFloorNumber = useCallback(
    (floorNumber: number) => {
      if (!route) return;
      const feedIndex = feed.findIndex((entry) => {
        const step = route.steps[entry.stepIndex];
        return (
          step?.kind === "walk" &&
          route.segments[step.segmentIndex]?.floor?.floorNumber === floorNumber
        );
      });
      if (feedIndex >= 0) {
        setActiveIndex(feedIndex);
        setPreviewFloorId(null);
      }
    },
    [route, feed],
  );

  const reset = useCallback(() => {
    setActiveIndex(0);
    setPreviewFloorId(null);
  }, []);

  return {
    route,
    activeIndex: safeIndex,
    activeStepIndex,
    activeInstruction,
    feedLength,
    activeStep,
    activeSegment,
    activeTransition,
    displayFloorId,
    displayFloorNumber,
    previewFloorId,
    isPreviewing: previewFloorId !== null,
    atEnd: activeStep?.kind === "arrive",
    next,
    previous,
    goToStep,
    previewFloor,
    syncToFloorNumber,
    reset,
  };
}

export default useRouteProgress;
