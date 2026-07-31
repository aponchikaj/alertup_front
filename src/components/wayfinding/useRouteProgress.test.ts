import { renderHook, act } from "@testing-library/react";
import { useRouteProgress } from "./useRouteProgress";
import type { AssembledRoute } from "../map/types";

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

describe("useRouteProgress", () => {
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
