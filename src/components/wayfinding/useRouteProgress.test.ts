import { renderHook, act } from "@testing-library/react";
import { buildFeed, useRouteProgress } from "./useRouteProgress";
import type { AssembledRoute, RouteInstruction } from "../map/types";

const floor = (id: string, floorNumber: number) => ({
  id,
  floorNumber,
  name: `Floor ${floorNumber}`,
  mapImageUrl: null,
  width: 1000,
  height: 800,
  scalePixelsPerMeter: 10,
});

// Ground floor → escalator → floor 4 → shop.
const route: AssembledRoute = {
  mode: "WAYFINDING",
  origin: { nodeId: "a", label: "Entrance", floorNumber: 1 },
  destination: {
    nodeId: "shop",
    label: "LC Waikiki",
    floorNumber: 4,
    poi: { id: "p1", name: "LC Waikiki", category: "Apparel" },
  },
  accessible: false,
  accessibleRouteUnavailable: false,
  totalDistancePx: 600,
  totalDistanceMeters: 60,
  segments: [
    {
      index: 0,
      floor: floor("f1", 1),
      nodes: [
        { id: "a", x: 0, y: 0, type: "ENTRANCE", label: "Entrance" },
        { id: "esc1", x: 100, y: 0, type: "TRANSIT", label: "Escalator A" },
      ],
      distancePx: 100,
      distanceMeters: 10,
    },
    {
      index: 1,
      floor: floor("f4", 4),
      nodes: [
        { id: "esc4", x: 100, y: 0, type: "TRANSIT", label: "Escalator A" },
        { id: "shop", x: 400, y: 0, type: "POI", label: "LC Waikiki" },
      ],
      distancePx: 300,
      distanceMeters: 30,
    },
  ],
  transitions: [
    {
      afterSegmentIndex: 0,
      transitType: "ESCALATOR",
      fromFloorNumber: 1,
      toFloorNumber: 4,
      fromNodeId: "esc1",
      toNodeId: "esc4",
      direction: "up",
      label: "Escalator A",
    },
  ],
  steps: [
    { kind: "walk", segmentIndex: 0 },
    { kind: "transit", transitionIndex: 0 },
    { kind: "walk", segmentIndex: 1 },
    { kind: "arrive" },
  ],
};

/* ----------------------------------------------------------------------------
   The same journey, narrated by the server. Two instructions share segment 0,
   which is exactly what the feed exists for: the stepper must be able to say
   "turn right at the Coffee Bar" without pretending the user changed floors.
   ------------------------------------------------------------------------- */
const instructions: RouteInstruction[] = [
  {
    index: 0,
    kind: "depart",
    distanceM: 0,
    durationSec: 0,
    segmentIndex: 0,
    text: { en: "Head toward Escalator A", ka: "გაემართე Escalator A-სკენ" },
  },
  {
    index: 1,
    kind: "right",
    distanceM: 10,
    durationSec: 8,
    segmentIndex: 0,
    landmark: { poiId: "p9", name: "Coffee Bar", relation: "before", side: "left" },
    text: { en: "Turn right at the Coffee Bar", ka: "შეუხვიე მარჯვნივ Coffee Bar-თან" },
  },
  {
    index: 2,
    kind: "transit",
    distanceM: 0,
    durationSec: 30,
    segmentIndex: 0,
    floorChange: {
      fromFloorNumber: 1,
      toFloorNumber: 4,
      transitType: "ESCALATOR",
      direction: "up",
    },
    text: { en: "Take the escalator to floor 4", ka: "ისარგებლე ესკალატორით მე-4 სართულზე" },
  },
  {
    index: 3,
    kind: "straight",
    distanceM: 30,
    durationSec: 24,
    segmentIndex: 1,
    text: { en: "Continue straight for 30 m", ka: "განაგრძე პირდაპირ 30 მ" },
  },
  {
    index: 4,
    kind: "arrive",
    distanceM: 0,
    durationSec: 0,
    segmentIndex: 1,
    text: { en: "LC Waikiki is on your right", ka: "LC Waikiki თქვენს მარჯვნივ" },
  },
];

const narratedRoute: AssembledRoute = { ...route, instructions };

describe("buildFeed", () => {
  test("buildFeed maps every instruction to the step it belongs to", () => {
    const feed = buildFeed(narratedRoute);

    // depart+right → walk step 0, transit → step 1, straight → step 2,
    // arrive → step 3.
    expect(feed.map((entry) => entry.stepIndex)).toEqual([0, 0, 1, 2, 3]);
    expect(feed.map((entry) => entry.instruction?.kind)).toEqual([
      "depart",
      "right",
      "transit",
      "straight",
      "arrive",
    ]);
  });

  test("an unmappable instruction falls back to the last mapped step", () => {
    const stray: RouteInstruction = {
      index: 5,
      kind: "straight",
      distanceM: 5,
      durationSec: 4,
      segmentIndex: 99,
      text: { en: "Keep going", ka: "განაგრძე" },
    };
    const feed = buildFeed({ ...route, instructions: [...instructions, stray] });

    expect(feed.at(-1)?.stepIndex).toBe(3);
  });

  test("falls back to an identity feed when the server sends no instructions", () => {
    const feed = buildFeed(route);

    expect(feed.map((entry) => entry.stepIndex)).toEqual([0, 1, 2, 3]);
    expect(feed.every((entry) => entry.instruction === null)).toBe(true);
  });
});

describe("useRouteProgress", () => {
  test("the floor only advances once the transit instruction is passed", () => {
    const { result } = renderHook(() => useRouteProgress(narratedRoute));

    expect(result.current.activeInstruction?.kind).toBe("depart");
    expect(result.current.displayFloorNumber).toBe(1);

    // Second instruction on the same segment: still floor 1, still step 0.
    act(() => result.current.next());
    expect(result.current.activeInstruction?.kind).toBe("right");
    expect(result.current.activeStepIndex).toBe(0);
    expect(result.current.displayFloorNumber).toBe(1);

    // On the transit instruction the map still shows the floor being left.
    act(() => result.current.next());
    expect(result.current.activeInstruction?.kind).toBe("transit");
    expect(result.current.displayFloorNumber).toBe(1);

    act(() => result.current.next());
    expect(result.current.displayFloorNumber).toBe(4);
  });

  test("syncToFloorNumber lands on the first instruction of that floor", () => {
    const { result } = renderHook(() => useRouteProgress(narratedRoute));
    act(() => result.current.syncToFloorNumber(4));

    expect(result.current.activeIndex).toBe(3);
    expect(result.current.activeInstruction?.kind).toBe("straight");
    expect(result.current.activeStep).toEqual({ kind: "walk", segmentIndex: 1 });
  });

  test("activeStepIndex always indexes a real step", () => {
    const { result } = renderHook(() => useRouteProgress(narratedRoute));
    expect(result.current.feedLength).toBe(5);

    for (let i = 0; i < result.current.feedLength; i += 1) {
      act(() => result.current.goToStep(i));
      const index = result.current.activeStepIndex;
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(narratedRoute.steps.length);
      expect(narratedRoute.steps[index]).toBeDefined();
      expect(result.current.activeStep).toBe(narratedRoute.steps[index]);
    }
  });

  test("starts on the first leg of the origin floor", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.activeSegment?.index).toBe(0);
    expect(result.current.displayFloorNumber).toBe(1);
    expect(result.current.atEnd).toBe(false);
  });

  test("during a transit the map still shows the floor being left", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.next());

    expect(result.current.activeStep).toEqual({ kind: "transit", transitionIndex: 0 });
    expect(result.current.activeTransition?.toFloorNumber).toBe(4);
    // Not yet upstairs — the user is standing at the escalator on floor 1.
    expect(result.current.displayFloorNumber).toBe(1);
  });

  test("advancing past the transit moves the map to the destination floor", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.next());
    act(() => result.current.next());

    expect(result.current.activeSegment?.index).toBe(1);
    expect(result.current.displayFloorNumber).toBe(4);
  });

  test("reaching the end reports arrival and stops advancing", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.goToStep(3));
    expect(result.current.atEnd).toBe(true);

    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(3);
  });

  test("previewing a floor does not advance progress", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.previewFloor("f4"));

    expect(result.current.isPreviewing).toBe(true);
    expect(result.current.displayFloorNumber).toBe(4);
    // Progress is untouched: the user is still walking floor 1.
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.activeSegment?.index).toBe(0);
  });

  test("previewing the floor you are already on clears the preview", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.previewFloor("f1"));
    expect(result.current.isPreviewing).toBe(false);
  });

  test("advancing clears an active preview", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.previewFloor("f4"));
    act(() => result.current.next());
    expect(result.current.isPreviewing).toBe(false);
  });

  test("a QR rescan re-anchors to the leg on the scanned floor", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    // The user took the stairs early and scanned a code on floor 4.
    act(() => result.current.syncToFloorNumber(4));

    expect(result.current.activeStep).toEqual({ kind: "walk", segmentIndex: 1 });
    expect(result.current.displayFloorNumber).toBe(4);
  });

  test("a rescan on a floor the route does not visit leaves progress alone", () => {
    const { result } = renderHook(() => useRouteProgress(route));
    act(() => result.current.syncToFloorNumber(9));
    expect(result.current.activeIndex).toBe(0);
  });

  test("handles a null route without throwing", () => {
    const { result } = renderHook(() => useRouteProgress(null));
    expect(result.current.activeStep).toBeNull();
    expect(result.current.displayFloorId).toBeNull();
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(0);
  });
});
