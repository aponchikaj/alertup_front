import { useCallback, useMemo, useState } from "react";
import type { AssembledRoute } from "../map/types";

/* ============================================================================
   useRouteProgress — one source of truth for "where in the route am I?".
   ----------------------------------------------------------------------------
   A single `activeIndex` into route.steps drives the stepper, the floor
   switcher and the map together. Browsing floors is deliberately separate
   state (`previewFloorId`): peeking at floor 3 must not claim the user has
   walked there.
   ========================================================================= */

export interface RouteProgress {
  route: AssembledRoute | null;
  activeIndex: number;
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

  const steps = route?.steps ?? [];
  const activeStep = steps[activeIndex] ?? null;

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

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      setActiveIndex(index);
      // Advancing the route means the user moved: stop previewing.
      setPreviewFloorId(null);
    },
    [steps.length],
  );

  const next = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, Math.max(steps.length - 1, 0)));
    setPreviewFloorId(null);
  }, [steps.length]);

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
   * A QR rescan tells us the true floor. Jump to the first walk step on it, so
   * a user who took the stairs early (or wandered) lands on the right leg
   * rather than being told to keep taking an escalator they already rode.
   */
  const syncToFloorNumber = useCallback(
    (floorNumber: number) => {
      if (!route) return;
      const stepIndex = route.steps.findIndex(
        (step) =>
          step.kind === "walk" &&
          route.segments[step.segmentIndex]?.floor?.floorNumber === floorNumber,
      );
      if (stepIndex >= 0) {
        setActiveIndex(stepIndex);
        setPreviewFloorId(null);
      }
    },
    [route],
  );

  const reset = useCallback(() => {
    setActiveIndex(0);
    setPreviewFloorId(null);
  }, []);

  return {
    route,
    activeIndex,
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
