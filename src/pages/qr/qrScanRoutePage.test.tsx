import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';
import * as http from '../../apis/http';
import * as wayfindingApi from '../../apis/wayfindingApi';
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
// inert and the test synchronous.
jest.mock('../../lib/realtime', () => ({
  createBuildingChannel: () => ({
    subscribe: () => () => {},
    onStatusChange: () => () => {},
    status: () => 'idle',
    close: () => {},
    resync: () => {},
  }),
}));

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
      expect(mockedWayfinding.fetchEvacuationRoute).toHaveBeenCalledWith('n1'),
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
