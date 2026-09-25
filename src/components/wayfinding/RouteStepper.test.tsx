import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { en } from "../../i18n/messages/en";
import { ka } from "../../i18n/messages/ka";
import { RouteStepper } from "./RouteStepper";
import { useRouteProgress } from "./useRouteProgress";
import type { AssembledRoute, RouteInstruction } from "../map/types";

/* ============================================================================
   RouteStepper — what the visitor is told, one instruction at a time.
   ----------------------------------------------------------------------------
   The server's instructions[] are authored bilingually, so the stepper must
   never re-template them; it picks the active language and renders the string
   as given. Until the backend emits them (task B10) it must still produce the
   client-templated lines it produced before — these tests pin both halves.
   ========================================================================= */

const floor = (id: string, floorNumber: number) => ({
  id,
  floorNumber,
  name: `Floor ${floorNumber}`,
  mapImageUrl: null,
  width: 1000,
  height: 800,
  scalePixelsPerMeter: 10,
});

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

const instructions: RouteInstruction[] = [
  {
    index: 0,
    kind: "depart",
    distanceM: 4,
    durationSec: 4,
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

/** A shorter journey, for the "the route changed under us" case. */
const shortRoute: AssembledRoute = {
  ...route,
  destination: {
    nodeId: "kiosk",
    label: "Info kiosk",
    floorNumber: 1,
    poi: null,
  },
  segments: [route.segments[0]],
  transitions: [],
  steps: [{ kind: "walk", segmentIndex: 0 }, { kind: "arrive" }],
  instructions: [
    {
      index: 0,
      kind: "depart",
      distanceM: 6,
      durationSec: 5,
      segmentIndex: 0,
      text: { en: "Head for the info kiosk", ka: "გაემართე საინფორმაციო ჯიხურისკენ" },
    },
    {
      index: 1,
      kind: "arrive",
      distanceM: 0,
      durationSec: 0,
      segmentIndex: 0,
      text: { en: "The info kiosk is ahead", ka: "საინფორმაციო ჯიხური წინაა" },
    },
  ],
};

/** Minimal host: the stepper is driven by a real useRouteProgress, as in app. */
const Harness = ({
  route: value,
  onHeading,
}: {
  route: AssembledRoute;
  onHeading?: (heading: number) => void;
}) => {
  const progress = useRouteProgress(value);
  return <RouteStepper progress={progress} onHeading={onHeading} />;
};

const tree = (value: AssembledRoute, onHeading?: (h: number) => void) => (
  <LanguageProvider>
    <Harness route={value} onHeading={onHeading} />
  </LanguageProvider>
);

const renderStepper = (value: AssembledRoute, onHeading?: (h: number) => void) =>
  render(tree(value, onHeading));

const stepCounter = (current: number, total: number) =>
  en.wayfinding.stepOf
    .replace("{current}", String(current))
    .replace("{total}", String(total));

beforeEach(() => {
  localStorage.clear();
});

describe("RouteStepper", () => {
  test("renders the server instruction in the active language", () => {
    localStorage.setItem("alertup-lang", "ka");
    renderStepper(narratedRoute);

    // First instruction, in Georgian, not a re-templated English string.
    expect(screen.getByTestId("instruction-title")).toHaveTextContent(
      instructions[0].text.ka,
    );

    fireEvent.click(screen.getByRole("button", { name: ka.common.next }));

    expect(screen.getByTestId("instruction-title")).toHaveTextContent(
      instructions[1].text.ka,
    );
    // 10 m · 1 min, from the instruction's own distance/duration.
    expect(
      screen.getByText(
        ka.wayfinding.distanceAndEta
          .replace("{meters}", "10")
          .replace("{minutes}", "1"),
      ),
    ).toBeInTheDocument();
  });

  test("names a landmark the server text already mentions exactly once", () => {
    // B10 landed and the authored line reads "Turn right at the Coffee Bar" —
    // it already carries the landmark. Adding the client's own "Coffee Bar on
    // your left" underneath prints it twice on screen and, worse, says it
    // twice inside one aria-live announcement.
    renderStepper(narratedRoute);
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));

    const card = screen.getByTestId("route-stepper");
    expect(card).toHaveTextContent(instructions[1].text.en);
    expect(screen.queryAllByText(/Coffee Bar/)).toHaveLength(1);
    for (const side of [en.wayfinding.sideLeft, en.wayfinding.sideRight]) {
      expect(
        screen.queryByText(
          en.wayfinding.landmark
            .replace("{name}", "Coffee Bar")
            .replace("{side}", side),
        ),
      ).toBeNull();
    }
  });

  test("still adds the landmark line when the server text leaves it out", () => {
    // The other half of the same rule: an authored line that does not name the
    // landmark would otherwise lose it entirely.
    const quiet = {
      ...narratedRoute,
      instructions: [
        {
          ...instructions[1],
          text: { en: "Turn right", ka: "შეუხვიე მარჯვნივ" },
        },
      ],
    } as AssembledRoute;

    renderStepper(quiet);

    expect(
      screen.getByText(
        en.wayfinding.landmark
          .replace("{name}", "Coffee Bar")
          .replace("{side}", en.wayfinding.sideLeft),
      ),
    ).toBeInTheDocument();
  });

  test("falls back to the client templates when the route has no instructions", () => {
    renderStepper(route);

    expect(screen.queryByTestId("instruction-arrow")).toBeNull();
    expect(screen.getByTestId("instruction-title")).toHaveTextContent(
      en.wayfinding.stepWalk.replace("{target}", "Escalator A"),
    );
    expect(
      screen.getByText(en.wayfinding.distanceMeters.replace("{meters}", "10")),
    ).toBeInTheDocument();
  });

  test("an unresolvable walk step renders no headline, never a false arrival", () => {
    // F15 item 4: a `walk` step whose `activeSegment` resolves to null (an
    // out-of-range `segmentIndex`) fell through the ternary chain all the way
    // to `stepArrive` — telling an evacuating visitor they have arrived when
    // the step could not even be resolved is the wrong direction to fail in.
    const broken = {
      ...route,
      steps: [{ kind: "walk" as const, segmentIndex: 99 }],
    } as AssembledRoute;

    renderStepper(broken);

    expect(screen.getByTestId("instruction-title")).toBeEmptyDOMElement();
    expect(screen.queryByText(en.wayfinding.stepArrive)).not.toBeInTheDocument();
  });

  test("announces the active instruction politely", () => {
    renderStepper(narratedRoute);

    const title = screen.getByTestId("instruction-title");
    expect(title).toHaveAttribute("aria-live", "polite");
    expect(title).toHaveAttribute("aria-atomic", "true");
    // The turn arrow is decoration: the title already carries the meaning.
    expect(screen.getByTestId("instruction-arrow")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("keeps ONE live region across walk, transit and arrive", () => {
    // A live region only announces changes to a region the screen reader was
    // already watching. Mounting a fresh <p aria-live> per card kind means the
    // transit line and the arrival line are announced to nobody — so the SAME
    // DOM node has to survive every step kind.
    renderStepper(narratedRoute);

    const first = screen.getByTestId("instruction-title");
    expect(first).toHaveTextContent(instructions[0].text.en);

    fireEvent.click(screen.getByRole("button", { name: en.common.next }));
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));

    // Now on the transit card.
    const onTransit = screen.getByTestId("instruction-title");
    expect(onTransit).toHaveTextContent(instructions[2].text.en);
    expect(onTransit).toBe(first);

    fireEvent.click(
      screen.getByRole("button", {
        name: en.wayfinding.arrivedOnFloor.replace("{floor}", "4"),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));

    // ...and on the arrival card.
    const onArrival = screen.getByTestId("instruction-title");
    expect(onArrival).toHaveTextContent(instructions[4].text.en);
    expect(onArrival).toBe(first);
    // Exactly one region, never two racing each other.
    expect(screen.getAllByTestId("instruction-title")).toHaveLength(1);
  });

  test("a route that changes under the stepper restarts at its own first instruction", () => {
    const { rerender } = renderStepper(narratedRoute);

    // Walk into the second half of the five-entry feed.
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));
    fireEvent.click(screen.getByRole("button", { name: en.common.next }));
    fireEvent.click(
      screen.getByRole("button", {
        name: en.wayfinding.arrivedOnFloor.replace("{floor}", "4"),
      }),
    );
    expect(screen.getByText(stepCounter(4, 5))).toBeInTheDocument();

    // A silent refetch lands a shorter route. The old position means nothing
    // on it, and must not survive as an index into a feed that is now 2 long.
    rerender(tree(shortRoute));

    expect(screen.getByText(stepCounter(1, 2))).toBeInTheDocument();
    expect(screen.getByTestId("instruction-title")).toHaveTextContent(
      "Head for the info kiosk",
    );
  });

  test("skips the landmark line when the server sends no side", () => {
    // `side` is required on the wire, but the payload is untyped JSON: a
    // landmark without one must say nothing rather than confidently say
    // "on your right".
    const sideless = {
      ...narratedRoute,
      instructions: [
        {
          ...instructions[1],
          landmark: { poiId: "p9", name: "Coffee Bar", relation: "before" },
        },
      ],
    } as unknown as AssembledRoute;

    renderStepper(sideless);

    expect(screen.getByTestId("instruction-title")).toHaveTextContent(
      instructions[1].text.en,
    );
    // No landmark line at all — not one guessing a side.
    for (const side of [en.wayfinding.sideLeft, en.wayfinding.sideRight]) {
      expect(
        screen.queryByText(
          en.wayfinding.landmark
            .replace("{name}", "Coffee Bar")
            .replace("{side}", side),
        ),
      ).toBeNull();
    }
  });

  test("offers the compass only on the first instruction", () => {
    // jsdom has no orientation events, so the hook would report `unsupported`
    // and hide the button entirely. Stand one up to reach the `idle` state a
    // phone starts in.
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent =
      function DeviceOrientationEventStub() {};
    try {
      renderStepper(narratedRoute);

      expect(
        screen.getByRole("button", { name: en.wayfinding.useCompass }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: en.common.next }));

      // Past the first instruction a heading no longer changes the wording.
      expect(
        screen.queryByRole("button", { name: en.wayfinding.useCompass }),
      ).toBeNull();
    } finally {
      delete (window as unknown as Record<string, unknown>).DeviceOrientationEvent;
    }
  });
});
