import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';
import * as http from '../../apis/http';
import * as wayfindingApi from '../../apis/wayfindingApi';
import * as realtime from '../../lib/realtime';
import QRScanRoutePage from './qrScanRoutePage';

/* ============================================================================
   Scan page — the view behind every printed QR code.
   ----------------------------------------------------------------------------
   One map slot, three states: overview (you are here + evacuation preview),
   route view once a destination is picked, emergency-gated actions. These
   tests pin the state transitions; map GEOMETRY is covered by the renderer's
   own suites.
   ========================================================================= */

jest.mock('../../apis/http', () => {
  const actual = jest.requireActual('../../apis/http');
  return { ...actual, get: jest.fn(), post: jest.fn() };
});
jest.mock('../../apis/wayfindingApi');

// The emergency provider opens an SSE stream; a stub channel keeps the page
// inert and the test synchronous, while still letting a test drive a status
// change or push a `closure_changed` frame through `__setStatus`/`__emit`.
jest.mock('../../lib/realtime', () => {
  const listeners = {
    status: new Set<(s: string) => void>(),
    events: new Set<(evt: unknown) => void>(),
  };
  let status = 'open';
  return {
    createBuildingChannel: () => ({
      subscribe: (cb: (evt: unknown) => void) => {
        listeners.events.add(cb);
        return () => listeners.events.delete(cb);
      },
      onStatusChange: (cb: (s: string) => void) => {
        listeners.status.add(cb);
        cb(status);
        return () => listeners.status.delete(cb);
      },
      status: () => status,
      close: () => {},
      lastHeartbeatAt: () => null,
      lastSeq: () => null,
    }),
    __setStatus: (next: string) => {
      status = next;
      listeners.status.forEach((cb) => cb(next));
    },
    __emit: (evt: unknown) => {
      listeners.events.forEach((cb) => cb(evt));
    },
    __reset: () => {
      status = 'open';
      listeners.status.clear();
      listeners.events.clear();
    },
  };
});

const realtimeMock = realtime as unknown as {
  __setStatus: (s: string) => void;
  __emit: (evt: unknown) => void;
  __reset: () => void;
};

// The AI launcher lazy-loads its drawer; irrelevant here.
jest.mock('../../components/ai/AiChatLauncher', () => ({
  AiChatLauncher: () => null,
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const mockedGet = http.get as jest.Mock;
const mockedWayfinding = wayfindingApi as jest.Mocked<typeof wayfindingApi>;

const directoryEntries = [
  {
    kind: 'poi' as const,
    poiId: 'p1',
    nodeId: 'n3',
    name: 'Cafe Aroma',
    category: 'coffee',
    nodeType: 'POI',
    floorId: 'f1',
    floorNumber: 1,
    floorName: 'Ground',
  },
  {
    kind: 'node' as const,
    poiId: null,
    nodeId: 'n2',
    name: 'Main Exit',
    category: null,
    nodeType: 'EMERGENCY_EXIT',
    floorId: 'f1',
    floorNumber: 1,
    floorName: 'Ground',
  },
];

const scanPayload = {
  qrId: 'qr_b1_1_n1',
  buildingId: 'b1',
  buildingName: 'Tbilisi Mall',
  floorNumber: '1',
  nodeId: 'n1',
  nodeType: 'path',
  nodeLabel: 'Lobby',
  nodePosition: { x: 100, y: 100 },
  connectedNodes: [],
  allFloorNodes: [
    { id: 'n1', x: 100, y: 100, type: 'path', label: 'Lobby', connections: ['n2'] },
    { id: 'n2', x: 300, y: 100, type: 'exit', label: 'Main Exit', connections: ['n1'] },
  ],
  routeNodes: [],
  floorTransitions: [],
  requiresFloorChange: false,
  emergencyRoute: {
    found: true,
    exitNodeId: 'n2',
    path: ['n1', 'n2'],
    distance: 1,
    walkingDistance: 200,
    exitNode: { id: 'n2', x: 300, y: 100, type: 'exit', label: 'Main Exit', floor: 1, connections: [] },
  },
  floorMap: {
    floor: 'Ground',
    map: null,
    imageUrl: null,
    svgContent: null,
    drawing: {
      version: 1,
      shapes: [{ id: 's1', kind: 'room', x: 50, y: 50, width: 200, height: 100, name: 'Cafe' }],
    },
    width: 1000,
    height: 800,
  },
  timestamp: new Date().toISOString(),
  scanCount: 3,
  emergency: { active: false, message: null, emergencyId: null },
  route: {
    mode: 'EVACUATION',
    origin: { nodeId: 'n1', label: 'Lobby', floorNumber: 1 },
    destination: { nodeId: 'n2', label: 'Main Exit', floorNumber: 1, poi: null },
    accessible: false,
    accessibleRouteUnavailable: false,
    totalDistancePx: 200,
    totalDistanceMeters: 12,
    segments: [
      {
        index: 0,
        floor: {
          id: 'f1', floorNumber: 1, name: 'Ground', mapImageUrl: null,
          width: 1000, height: 800, scalePixelsPerMeter: 20,
        },
        nodes: [
          { id: 'n1', x: 100, y: 100, type: 'NORMAL', label: 'Lobby' },
          { id: 'n2', x: 300, y: 100, type: 'EMERGENCY_EXIT', label: 'Main Exit' },
        ],
        distancePx: 200,
        distanceMeters: 12,
      },
    ],
    transitions: [],
    steps: [{ kind: 'walk', segmentIndex: 0 }, { kind: 'arrive' }],
  },
};

const renderPage = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/scan/route/qr_b1_1_n1']}>
        <Routes>
          <Route path="/scan/route/:qrId" element={<QRScanRoutePage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  realtimeMock.__reset();
  sessionStorage.clear();
  mockedGet.mockResolvedValue({ success: true, data: scanPayload });
  mockedWayfinding.fetchDirectory.mockResolvedValue(directoryEntries);
});

describe('scan page — directory first, map one tap away', () => {
  const toMapView = () =>
    fireEvent.click(screen.getByRole('radio', { name: en.route.viewMap }));

  test('leads with the searchable directory: shops, exits, nearest-exit pin', async () => {
    renderPage();

    expect(await screen.findByText(/Tbilisi Mall/)).toBeInTheDocument();
    expect(await screen.findByTestId('directory-panel')).toBeInTheDocument();

    // Every destination is listed, grouped, with its floor.
    expect(await screen.findByText('Cafe Aroma')).toBeInTheDocument();
    // Group headings carry their counts in a nested span; match on the name.
    expect(screen.getByText(new RegExp(en.route.directoryShops))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(en.route.directoryExits))).toBeInTheDocument();

    // Nearest exit pinned above the list.
    expect(
      screen.getByRole('button', { name: new RegExp(en.wayfinding.nearestExit) }),
    ).toBeInTheDocument();
  });

  test('search filters everything, and a miss says so', async () => {
    renderPage();
    await screen.findByText('Cafe Aroma');

    // Scoped to the panel: the nearest-exit strip below the card also names
    // the exit, and that one must NOT disappear when the list filters.
    const panel = within(screen.getByTestId('directory-panel'));
    const search = screen.getByPlaceholderText(en.route.directorySearch);
    fireEvent.change(search, { target: { value: 'cafe' } });
    expect(panel.getByText('Cafe Aroma')).toBeInTheDocument();
    expect(panel.queryByText('Main Exit')).toBeNull();

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(panel.getByText(/zzz/)).toBeInTheDocument(); // the no-match notice
    expect(panel.queryByText('Cafe Aroma')).toBeNull();
  });

  test('picking a directory entry routes to it and swaps the slot to the map', async () => {
    mockedWayfinding.fetchRoute.mockResolvedValue(scanPayload.route as never);
    renderPage();
    await screen.findByText('Cafe Aroma');

    fireEvent.click(screen.getByRole('button', { name: /Cafe Aroma/ }));

    await waitFor(() =>
      expect(mockedWayfinding.fetchRoute).toHaveBeenCalledWith(
        expect.objectContaining({ fromNodeId: 'n1', toPoiId: 'p1' }),
      ),
    );
    // The directory folds away; the route view owns the slot.
    await waitFor(() => expect(screen.queryByTestId('directory-panel')).toBeNull());
  });

  test('the floor map is one tap away and offers "Route here" on markers', async () => {
    mockedWayfinding.fetchRoute.mockResolvedValue(scanPayload.route as never);
    const { container } = renderPage();
    await screen.findByText('Cafe Aroma');

    toMapView();

    // The drawn plan renders through the shared DrawingLayer, markers included.
    expect(container.querySelector('[data-testid="drawing-layer"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="n2"]')).toBeInTheDocument();

    fireEvent.click(container.querySelector('[data-node-id="n2"]') as Element);
    const routeHere = await screen.findByRole('button', {
      name: new RegExp(en.route.routeHere),
    });
    fireEvent.click(routeHere);

    await waitFor(() =>
      expect(mockedWayfinding.fetchRoute).toHaveBeenCalledWith(
        expect.objectContaining({ fromNodeId: 'n1', toNodeId: 'n2' }),
      ),
    );
  });

  test('keeps emergency instructions and the evacuated button off calm pages', async () => {
    renderPage();
    await screen.findByText(/Tbilisi Mall/);

    expect(screen.queryByText(en.route.instructionsTitle)).toBeNull();
    expect(screen.queryByRole('button', { name: en.route.evacuated })).toBeNull();
  });

  test('"Guide me there" fetches the evacuation route into the same slot', async () => {
    mockedWayfinding.fetchEvacuationRoute.mockResolvedValue(
      scanPayload.route as never,
    );
    renderPage();
    await screen.findByText(/Tbilisi Mall/);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.route.guideMe) }));

    await waitFor(() =>
      expect(mockedWayfinding.fetchEvacuationRoute).toHaveBeenCalledWith(
        'n1',
        expect.objectContaining({}),
      ),
    );
    // The route view replaces the idle slot; the exit strip folds away.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: new RegExp(en.route.guideMe) }),
      ).toBeNull(),
    );
  });
});

describe('scan page — failure states', () => {
  test('a dead QR shows the error state with a way out', async () => {
    mockedGet.mockRejectedValue(new http.ApiError('gone', 404, null));
    renderPage();

    expect(await screen.findByText(en.route.qrNotFound)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.common.back })).toBeInTheDocument();
  });
});

/* ============================================================================
   F15 item 6 — exactly one h1, in every state this page can render.
   ----------------------------------------------------------------------------
   Screen-reader users navigate by heading; a scan-review flagged this page as
   having none. At this commit `RouteHeader`/`PageHeader` already renders a
   descriptive <h1> in the loading, error and loaded states — these pin that
   so a future refactor cannot drop it back to zero. If this ever regresses,
   the fix belongs in `RouteHeader` (loaded) or the loading/error branches
   directly, all in this file.
   ========================================================================= */
describe('scan page — exactly one h1 (F15 item 6)', () => {
  test('names the page while the scan is loading', () => {
    // The fetch is mocked but unresolved at first paint.
    mockedGet.mockReturnValue(new Promise(() => {}));
    renderPage();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.route.loadingTitle);
  });

  test('names the page on a failed scan', async () => {
    mockedGet.mockRejectedValue(new http.ApiError('gone', 404, null));
    renderPage();
    await screen.findByText(en.route.qrNotFound);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.route.errorTitle);
  });

  test('names the page once the route loads', async () => {
    renderPage();
    await screen.findByText(/Tbilisi Mall/);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.route.title);
  });
});

/* ============================================================================
   F10 — connection-lost indicator + closure-driven refetch
   ----------------------------------------------------------------------------
   The stubbed realtime channel from the top of this file is driven directly
   via `realtimeMock.__setStatus` / `__emit` — a status change or an SSE frame
   without ever standing up a real EventSource.
   ========================================================================= */

describe('scan page — connection status and closures', () => {
  test('the connection-lost notice shows only while an emergency is active and the channel is degraded', async () => {
    renderPage();
    await screen.findByText(/Tbilisi Mall/);

    // Calm building, degraded channel: still just everyday wayfinding — no notice.
    act(() => realtimeMock.__setStatus('degraded'));
    expect(screen.queryByText(en.emergency.connectionLost)).toBeNull();

    // The stream reports an emergency while the channel is still degraded.
    act(() =>
      realtimeMock.__emit({
        type: 'state',
        data: {
          isEmergency: true,
          emergencyId: 'e1',
          message: 'Fire on level 2',
          startedAt: new Date().toISOString(),
        },
      }),
    );
    expect(screen.getByText(en.emergency.connectionLost)).toBeInTheDocument();

    // Connection recovers: the notice must go even though the emergency is
    // still live — it names a transport problem, not the emergency itself.
    act(() => realtimeMock.__setStatus('open'));
    expect(screen.queryByText(en.emergency.connectionLost)).toBeNull();
  });

  test('the connection-lost notice lands in a live region that was already mounted', async () => {
    // A screen reader only announces a change INSIDE a region it is already
    // watching. Mounting the whole role=status alert at the moment the channel
    // dies means the one person who most needs to know the route is frozen is
    // the one person who is never told. The region is therefore permanent and
    // only its content changes.
    renderPage();
    await screen.findByText(/Tbilisi Mall/);

    const region = screen.getByTestId('connection-status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();

    act(() => realtimeMock.__setStatus('degraded'));
    act(() =>
      realtimeMock.__emit({
        type: 'state',
        data: {
          isEmergency: true,
          emergencyId: 'e1',
          message: 'Fire on level 2',
          startedAt: new Date().toISOString(),
        },
      }),
    );

    // Same node, now carrying the notice — not a replacement node.
    expect(screen.getByTestId('connection-status')).toBe(region);
    expect(region).toHaveTextContent(en.emergency.connectionLost);
    // And exactly one live region: the Alert inside must not open a second.
    expect(region.querySelectorAll('[aria-live]')).toHaveLength(0);
  });

  test('a closure_changed frame refetches the currently displayed route', async () => {
    mockedWayfinding.fetchRoute.mockResolvedValue(scanPayload.route as never);
    renderPage();
    await screen.findByText('Cafe Aroma');

    fireEvent.click(screen.getByRole('button', { name: /Cafe Aroma/ }));
    await waitFor(() => expect(mockedWayfinding.fetchRoute).toHaveBeenCalledTimes(1));

    act(() =>
      realtimeMock.__emit({
        type: 'closure_changed',
        data: {
          closureId: 'c1',
          action: 'created',
          blocked: true,
          edgeIds: ['e1'],
          nodeIds: [],
          reason: 'Spill on floor',
          endsAt: null,
        },
      }),
    );

    await waitFor(() => expect(mockedWayfinding.fetchRoute).toHaveBeenCalledTimes(2));
    expect(mockedWayfinding.fetchRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromNodeId: 'n1', toPoiId: 'p1' }),
    );
    // The route the visitor was already following is still the one on screen.
    expect(screen.getByText(/Cafe Aroma/)).toBeInTheDocument();
  });

  test('a failed closure refetch keeps the displayed route on screen', async () => {
    mockedWayfinding.fetchRoute.mockResolvedValueOnce(scanPayload.route as never);
    renderPage();
    await screen.findByText('Cafe Aroma');

    fireEvent.click(screen.getByRole('button', { name: /Cafe Aroma/ }));
    await waitFor(() => expect(mockedWayfinding.fetchRoute).toHaveBeenCalledTimes(1));

    mockedWayfinding.fetchRoute.mockRejectedValueOnce(new Error('Network down'));
    act(() =>
      realtimeMock.__emit({
        type: 'closure_changed',
        data: {
          closureId: 'c1',
          action: 'updated',
          blocked: true,
          edgeIds: [],
          nodeIds: ['n2'],
          reason: 'Spill on floor',
          endsAt: null,
        },
      }),
    );

    await waitFor(() => expect(mockedWayfinding.fetchRoute).toHaveBeenCalledTimes(2));
    // The static fail-safe: the route already on screen must not be cleared
    // by a refetch that failed.
    expect(screen.getByText(/Cafe Aroma/)).toBeInTheDocument();
    expect(screen.queryByTestId('directory-panel')).toBeNull();
  });
});
