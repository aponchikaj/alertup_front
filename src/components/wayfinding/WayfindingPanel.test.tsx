import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { en } from "../../i18n/messages/en";
import * as wayfindingApi from "../../apis/wayfindingApi";
import { WayfindingPanel } from "./WayfindingPanel";
import type { AssembledRoute, RouteAlternative, RouteClosure } from "../map/types";

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

// The compass, on a device that has one. jsdom has no orientation events, so
// the real hook can only ever report `unsupported` here.
let mockHeading: number | null = null;
jest.mock("../../lib/useDeviceHeading", () => ({
  useDeviceHeading: () => ({
    heading: mockHeading,
    state: mockHeading === null ? "idle" : "granted",
    request: () => {},
  }),
  headingFromEvent: () => null,
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

const makeAlternative = (overrides: Partial<RouteAlternative> = {}): RouteAlternative => ({
  exitNodeId: "e1",
  label: "North exit",
  floorNumber: 1,
  distanceM: 80,
  durationSec: 90,
  route: makeRoute(),
  ...overrides,
});

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
  mockHeading = null;
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

  test("a closure with no reason shows a generic fallback, never the literal \"null\"", async () => {
    // The backend's `reason` column is nullable — `publicClosure` emits
    // `reason: row.reason ?? null` verbatim, so this is a real wire shape,
    // not a hypothetical one.
    const closure: RouteClosure = {
      id: "c1",
      floorId: "f1",
      reason: null,
      costMultiplier: null,
      endsAt: "2026-09-25T15:15:00.000Z",
      blocked: true,
    };
    mockedApi.fetchRoute.mockResolvedValue(makeRoute({ closures: [closure] }));
    renderPanel();

    await screen.findByTestId("route-stepper");
    expect(screen.getByText(en.wayfinding.closuresTitle)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(en.wayfinding.closureReasonUnknown)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^null/)).toBeNull();
    expect(screen.queryByText(/\bnull\b/)).toBeNull();
  });

  test("a closure appearing on a silent refetch lands in a region already there", async () => {
    // The realtime closure_changed path refetches under the visitor's feet.
    // If the "Route adjusted for closures" alert IS the live region, it is
    // created at the same instant as its text and a screen reader watching the
    // page has nothing to notice. The region is therefore permanent for as
    // long as a route is on screen; only its contents change.
    mockedApi.fetchRoute.mockResolvedValue(makeRoute());
    renderPanel();
    await screen.findByTestId("route-stepper");

    const region = screen.getByTestId("route-notices");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    // Empty, but never display:none — that would take the region out of the
    // accessibility tree and undo the whole point of keeping it mounted.
    expect(region.className).not.toMatch(/\bhidden\b/);

    // A refetch (here driven by the profile picker, exactly as the closure
    // event drives one) brings a route that is routed around a closure.
    mockedApi.fetchRoute.mockResolvedValue(
      makeRoute({
        closures: [
          {
            id: "c1",
            floorId: "f1",
            reason: "Burst pipe",
            costMultiplier: null,
            endsAt: null,
            blocked: true,
          },
        ],
      }),
    );
    fireEvent.change(profilePicker(), { target: { value: "wheelchair" } });

    await screen.findByText(en.wayfinding.closuresTitle);
    // Same node, now carrying the notice.
    expect(screen.getByTestId("route-notices")).toBe(region);
    expect(region).toHaveTextContent("Burst pipe");
    // One region, not two: the Alert inside must not open its own.
    expect(region.querySelectorAll("[aria-live]")).toHaveLength(0);
  });

  test("a closure with neither reason nor an end time still renders a non-empty line", async () => {
    const closure: RouteClosure = {
      id: "c1",
      floorId: "f1",
      reason: null,
      costMultiplier: null,
      endsAt: null,
      blocked: true,
    };
    mockedApi.fetchRoute.mockResolvedValue(makeRoute({ closures: [closure] }));
    renderPanel();

    await screen.findByTestId("route-stepper");
    const item = screen.getByText(en.wayfinding.closureReasonUnknown);
    expect(item).toBeInTheDocument();
    expect(item.textContent?.trim()).not.toBe("");
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

  test("re-requests the route with the compass heading exactly once", async () => {
    mockHeading = 90;
    mockedApi.fetchRoute.mockResolvedValue(makeRoute());
    renderPanel();

    await screen.findByTestId("route-stepper");

    // One silent refetch carrying the heading — and then no more, even though
    // the refetch itself lands a fresh route and re-renders the stepper.
    await waitFor(() => expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2));
    expect(mockedApi.fetchRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ toPoiId: "p1", heading: 90 }),
    );

    await act(async () => {});
    expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2);
  });

  test("a compass heading never aborts a request already in flight", async () => {
    mockedApi.fetchRoute.mockResolvedValueOnce(makeRoute());
    renderPanel();
    await screen.findByTestId("route-stepper");
    expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(1);

    // A load is under way. `lastSelectionRef` still names the OLD destination
    // (it is only written on success), so a heading refetch fired now would
    // re-request the old one and abort this request on its way out.
    let resolvePending: (route: AssembledRoute) => void = () => {};
    mockedApi.fetchRoute.mockImplementationOnce(
      () =>
        new Promise<AssembledRoute>((resolve) => {
          resolvePending = resolve;
        }),
    );
    // The compass reading lands in the render this change triggers.
    mockHeading = 90;
    fireEvent.change(profilePicker(), { target: { value: "wheelchair" } });

    await waitFor(() => expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2));
    // The heading must have stood down: a third request here is the abort.
    expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2);
    expect(mockedApi.fetchRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ profile: "wheelchair" }),
    );

    // …and the request it would have aborted still lands on screen.
    await act(async () => {
      resolvePending(makeRoute({ totalDistanceM: 120, totalDurationSec: 180 }));
    });
    expect(screen.getByText("120 m · 3 min")).toBeInTheDocument();
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

describe("WayfindingPanel — alternative exits", () => {
  test("shows at most two alternative exits with distance and ETA in evacuation mode", async () => {
    mockedApi.fetchEvacuationRoute.mockResolvedValue(
      makeRoute({
        mode: "EVACUATION",
        alternatives: [
          // Matches route.destination.nodeId ("n9") — must be excluded.
          makeAlternative({ exitNodeId: "n9", label: "Main exit" }),
          makeAlternative({
            exitNodeId: "e1",
            label: "North exit",
            floorNumber: 1,
            distanceM: 80,
            durationSec: 90,
          }),
          makeAlternative({
            exitNodeId: "e2",
            label: "South exit",
            floorNumber: 1,
            distanceM: 120,
            durationSec: 150,
          }),
          makeAlternative({
            exitNodeId: "e3",
            label: "East exit",
            floorNumber: 3,
            distanceM: 200,
            durationSec: 240,
          }),
        ],
      }),
    );

    renderPanel(EXIT_SELECTION);
    await screen.findByTestId("route-stepper");

    expect(screen.getByText(en.wayfinding.alternativeExits)).toBeInTheDocument();

    const northExit = screen.getByRole("button", { name: /North exit/ });
    expect(northExit).toHaveAccessibleName(/North exit/);
    expect(northExit).toHaveAccessibleName(/Floor 1/);
    expect(northExit).toHaveAccessibleName(/80 m/);
    expect(northExit).toHaveAccessibleName(/2 min/);

    // The "·" this component puts between the floor and the distance is
    // sighted punctuation and is hidden. (The one inside "80 m · 2 min" comes
    // from the shared distance+ETA format string, which is one quantity pair
    // spoken as a unit everywhere in the product and is left alone.)
    expect(
      northExit.querySelector('[aria-hidden="true"]')?.textContent,
    ).toContain("·");
    // So: two dots on screen, one in the accessible name.
    expect(northExit.textContent).toMatch(/·[^·]*·/);
    expect(northExit).not.toHaveAccessibleName(/·[^·]*·/);

    // At most two, and never the one that matches the primary destination.
    expect(screen.getByRole("button", { name: /South exit/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /East exit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Main exit/ })).not.toBeInTheDocument();
  });

  test("tapping an alternative exit routes to that exit node with profile emergency", async () => {
    mockedApi.fetchEvacuationRoute.mockResolvedValue(
      makeRoute({
        mode: "EVACUATION",
        alternatives: [makeAlternative({ exitNodeId: "e1", label: "North exit" })],
      }),
    );
    mockedApi.fetchRoute.mockResolvedValue(makeRoute({ mode: "EVACUATION" }));

    renderPanel(EXIT_SELECTION);
    await screen.findByTestId("route-stepper");

    fireEvent.click(screen.getByRole("button", { name: /North exit/ }));

    // The exit node id is a plain node, routed via fetchRoute + profile
    // "emergency" — never /evacuate, which the exit id was not built for.
    await waitFor(() =>
      expect(mockedApi.fetchRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          fromNodeId: "n1",
          toNodeId: "e1",
          profile: "emergency",
        }),
      ),
    );
    expect(mockedApi.fetchEvacuationRoute).toHaveBeenCalledTimes(1);
  });

  test("keeps requesting the emergency profile when a heading refetch follows an exit pick", async () => {
    // No heading yet at mount — the initial nearest-exit route must not fire one.
    mockHeading = null;
    mockedApi.fetchEvacuationRoute.mockResolvedValue(
      makeRoute({
        mode: "EVACUATION",
        alternatives: [makeAlternative({ exitNodeId: "e1", label: "North exit" })],
      }),
    );
    mockedApi.fetchRoute.mockResolvedValue(makeRoute({ mode: "EVACUATION" }));

    renderPanel(EXIT_SELECTION);
    await screen.findByTestId("route-stepper");

    fireEvent.click(screen.getByRole("button", { name: /North exit/ }));
    await waitFor(() =>
      expect(mockedApi.fetchRoute).toHaveBeenCalledWith(
        expect.objectContaining({ toNodeId: "e1", profile: "emergency" }),
      ),
    );
    expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(1);

    // The compass reading arrives only now — after the exit route already
    // committed — and the visitor's saved preference is a non-emergency
    // profile, exactly the downgrade that would hide EMERGENCY_ONLY edges.
    localStorage.setItem("alertup-route-profile", "walk");
    mockHeading = 90;
    // A UI interaction unrelated to routing (advancing the stepper) is enough
    // to re-render RouteStepper, which is where the mocked compass hook is
    // actually read.
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));

    await waitFor(() => expect(mockedApi.fetchRoute).toHaveBeenCalledTimes(2));
    expect(mockedApi.fetchRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ toNodeId: "e1", heading: 90, profile: "emergency" }),
    );
  });

  test("picking an alternative exit keeps the current route on screen while the new one loads", async () => {
    mockedApi.fetchEvacuationRoute.mockResolvedValue(
      makeRoute({
        mode: "EVACUATION",
        alternatives: [makeAlternative({ exitNodeId: "e1", label: "North exit" })],
      }),
    );
    renderPanel(EXIT_SELECTION);
    await screen.findByTestId("route-stepper");

    let resolvePending: (route: AssembledRoute) => void = () => {};
    mockedApi.fetchRoute.mockImplementationOnce(
      () =>
        new Promise<AssembledRoute>((resolve) => {
          resolvePending = resolve;
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: /North exit/ }));

    // The static fail-safe: the route (and its stepper) already on screen
    // must stay up while the new one loads, exactly like a profile change or
    // a heading refetch — this matters most mid-evacuation.
    expect(screen.getByTestId("route-stepper")).toBeInTheDocument();

    await act(async () => {
      resolvePending(makeRoute({ mode: "EVACUATION" }));
    });
    expect(screen.getByTestId("route-stepper")).toBeInTheDocument();
  });

  test("does not show an alternatives section for wayfinding routes", async () => {
    mockedApi.fetchRoute.mockResolvedValue(
      makeRoute({
        mode: "WAYFINDING",
        alternatives: [makeAlternative()],
      }),
    );

    renderPanel();
    await screen.findByTestId("route-stepper");

    expect(screen.queryByText(en.wayfinding.alternativeExits)).not.toBeInTheDocument();
  });
});
