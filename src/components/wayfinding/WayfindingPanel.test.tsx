import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { en } from "../../i18n/messages/en";
import * as wayfindingApi from "../../apis/wayfindingApi";
import { WayfindingPanel } from "./WayfindingPanel";
import type { AssembledRoute } from "../map/types";

/* ============================================================================
   WayfindingPanel — the route preference picker and the totals it drives.
   ----------------------------------------------------------------------------
   Everything here is driven through `externalSelection` (the scan page's own
   code path) so the search box stays out of the way. The api module is mocked
   wholesale: these tests pin the panel's behaviour, not the wire format.
   ========================================================================= */

jest.mock("../../apis/wayfindingApi");

// jsdom has no WebGL; the real probe logs a "not implemented" console error on
// every render. The 2D map is what these tests exercise anyway.
jest.mock("../map3d/useMap3dSupport", () => ({
  useMap3dSupport: () => false,
  probeWebGlSupport: () => false,
  resetSupportCache: () => {},
}));

const mockedApi = wayfindingApi as jest.Mocked<typeof wayfindingApi>;

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const floor = (id: string, floorNumber: number) => ({
  id,
  floorNumber,
  name: `Floor ${floorNumber}`,
  mapImageUrl: null,
  width: 1000,
  height: 800,
  scalePixelsPerMeter: 20,
});

/** Two floors, so the stepper has somewhere to advance to. */
const makeRoute = (overrides: Partial<AssembledRoute> = {}): AssembledRoute => ({
  mode: "WAYFINDING",
  origin: { nodeId: "n1", label: "Lobby", floorNumber: 1 },
  destination: {
    nodeId: "n9",
    label: "Cafe Aroma",
    floorNumber: 2,
    poi: { id: "p1", name: "Cafe Aroma", category: "coffee" },
  },
  accessible: false,
  accessibleRouteUnavailable: false,
  totalDistancePx: 400,
  totalDistanceMeters: 20,
  segments: [
    {
      index: 0,
      floor: floor("f1", 1),
      nodes: [
        { id: "n1", x: 0, y: 0, type: "NORMAL", label: "Lobby" },
        { id: "n2", x: 200, y: 0, type: "TRANSIT", label: "Stairs" },
      ],
      distancePx: 200,
      distanceMeters: 10,
    },
    {
      index: 1,
      floor: floor("f2", 2),
      nodes: [
        { id: "n8", x: 0, y: 0, type: "TRANSIT", label: "Stairs" },
        { id: "n9", x: 200, y: 0, type: "POI", label: "Cafe Aroma" },
      ],
      distancePx: 200,
      distanceMeters: 10,
    },
  ],
  transitions: [
    {
      afterSegmentIndex: 0,
      transitType: "STAIRS",
      fromFloorNumber: 1,
      toFloorNumber: 2,
      fromNodeId: "n2",
      toNodeId: "n8",
      direction: "up",
      label: "North stairs",
    },
  ],
  steps: [
    { kind: "walk", segmentIndex: 0 },
    { kind: "transit", transitionIndex: 0 },
    { kind: "walk", segmentIndex: 1 },
    { kind: "arrive" },
  ],
  ...overrides,
});

const POI_SELECTION = {
  kind: "poi" as const,
  poiId: "p1",
  name: "Cafe Aroma",
  token: 1,
};

const EXIT_SELECTION = {
  kind: "nearest-exit" as const,
  name: "Nearest exit",
  token: 1,
};

const renderPanel = (
  selection: (typeof POI_SELECTION | typeof EXIT_SELECTION) = POI_SELECTION,
) =>
  render(
    <LanguageProvider>
      <WayfindingPanel
        buildingId="b1"
        originNodeId="n1"
        hideSearch
        externalSelection={selection}
      />
    </LanguageProvider>,
  );

const profilePicker = () =>
  screen.getByLabelText(en.wayfinding.profileLabel) as HTMLSelectElement;

beforeEach(() => {
  // reset, not clear: a `…Once` queued by a test must not leak into the next.
  jest.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("WayfindingPanel — route preference", () => {
  test("changing the profile refetches the same destination and resets progress", async () => {
    mockedApi.fetchRoute.mockResolvedValue(makeRoute());
    renderPanel();

    await screen.findByTestId("route-stepper");
    expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(1);

    // Walk one step forward so a reset is observable.
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));
    expect(
      screen.getByText(en.wayfinding.stepOf.replace("{current}", "2").replace("{total}", "3")),
    ).toBeInTheDocument();

    fireEvent.change(profilePicker(), { target: { value: "wheelchair" } });

    await waitFor(() => expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2));
    expect(mockedApi.fetchRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fromNodeId: "n1",
        toPoiId: "p1",
        profile: "wheelchair",
      }),
    );

    // Back to the top of the route.
    await waitFor(() =>
      expect(
        screen.getByText(
          en.wayfinding.stepOf.replace("{current}", "1").replace("{total}", "3"),
        ),
      ).toBeInTheDocument(),
    );
  });

  test("persists the chosen profile to localStorage", async () => {
    mockedApi.fetchRoute.mockResolvedValue(makeRoute());
    renderPanel();
    await screen.findByTestId("route-stepper");

    fireEvent.change(profilePicker(), { target: { value: "min_floor_changes" } });

    await waitFor(() =>
      expect(localStorage.getItem("alertup-route-profile")).toBe("min_floor_changes"),
    );
  });

  test("a failed refetch keeps the previous route on screen and shows the error", async () => {
    mockedApi.fetchRoute.mockResolvedValueOnce(makeRoute());
    renderPanel();
    await screen.findByTestId("route-stepper");

    mockedApi.fetchRoute.mockRejectedValueOnce(new Error("Network down"));
    fireEvent.change(profilePicker(), { target: { value: "elevator_first" } });

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    // The static fail-safe: the last good route stays on the map.
    expect(screen.getByTestId("route-stepper")).toBeInTheDocument();
  });

  test("renders route warnings and the distance/ETA header", async () => {
    mockedApi.fetchRoute.mockResolvedValue(
      makeRoute({
        totalDistanceM: 120,
        totalDurationSec: 180,
        warnings: [
          { code: "ELEVATOR_CLOSED", message: "The north elevator is out of service." },
        ],
      }),
    );
    renderPanel();

    await screen.findByTestId("route-stepper");
    expect(screen.getByText("120 m · 3 min")).toBeInTheDocument();
    expect(screen.getByText(en.wayfinding.warningsTitle)).toBeInTheDocument();
    expect(
      screen.getByText("The north elevator is out of service."),
    ).toBeInTheDocument();
  });

  test("nearest exit asks for accessible, never a profile", async () => {
    // /evacuate reads `accessible=true` only; a non-emergency `profile` would
    // be read as a downgrade and hide EMERGENCY_ONLY edges.
    localStorage.setItem("alertup-route-profile", "wheelchair");
    mockedApi.fetchEvacuationRoute.mockResolvedValue(
      makeRoute({ mode: "EVACUATION" }),
    );

    renderPanel(EXIT_SELECTION);
    await screen.findByTestId("route-stepper");

    expect(mockedApi.fetchEvacuationRoute).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({ accessible: true }),
    );
    const [, options] = mockedApi.fetchEvacuationRoute.mock.calls[0];
    expect(options).not.toHaveProperty("profile");
  });

  test("starting over mid-refetch is not undone when the stale response lands", async () => {
    mockedApi.fetchRoute.mockResolvedValueOnce(makeRoute());
    renderPanel();
    await screen.findByTestId("route-stepper");

    // A refetch that is still in flight when the user bails out.
    let resolveRefetch: (route: AssembledRoute) => void = () => {};
    mockedApi.fetchRoute.mockImplementationOnce(
      () =>
        new Promise<AssembledRoute>((resolve) => {
          resolveRefetch = resolve;
        }),
    );
    fireEvent.change(profilePicker(), { target: { value: "wheelchair" } });

    fireEvent.click(screen.getByRole("button", { name: en.wayfinding.startOver }));
    expect(screen.queryByTestId("route-stepper")).toBeNull();

    await act(async () => {
      resolveRefetch(makeRoute());
    });

    // The superseded response must not resurrect the route the user dismissed.
    expect(screen.queryByTestId("route-stepper")).toBeNull();
    expect(sessionStorage.getItem("alertup-route-dest:b1")).toBeNull();
  });
});
