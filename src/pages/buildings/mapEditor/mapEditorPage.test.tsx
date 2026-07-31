import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { ToastProvider } from '../../../components/ui/toast';
import { en } from '../../../i18n/messages/en';
import * as mapEditorApi from '../../../apis/mapEditorApi';
import * as buildingApi from '../../../apis/building';
import MapEditorPage from './mapEditorPage';
import type { EditorFloor, EditorGraph, EditorNode } from '../../../apis/mapEditorApi';

/* ============================================================================
   Map editor page — behaviour under a fully mocked API.
   ----------------------------------------------------------------------------
   getScreenCTM does not exist in jsdom, so map-space hit testing (what turns a
   press into "the user clicked *here* on this floor") always returns null.
   mapSpace is mocked with a fixed point so the place-node path is reachable;
   every other export keeps its real implementation.
   ========================================================================= */

jest.mock('../../../components/map/mapSpace', () => {
  const actual = jest.requireActual('../../../components/map/mapSpace');
  return { ...actual, screenToMap: jest.fn(() => ({ x: 321, y: 123 })) };
});

jest.mock('../../../apis/mapEditorApi');
jest.mock('../../../apis/building');

// jsdom has no ResizeObserver; MapCanvas measures its container with one.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const api = mapEditorApi as jest.Mocked<typeof mapEditorApi>;
const building = buildingApi as jest.Mocked<typeof buildingApi>;

const floor = (id: string, floorNumber: number, name: string): EditorFloor => ({
  id,
  buildingId: 'b1',
  floorNumber,
  name,
  mapImageUrl: null,
  qrCodeUrl: null,
  svgContent: null,
  width: 1000,
  height: 800,
  scalePixelsPerMeter: 20,
  scanCount: 0,
});

const node = (
  id: string,
  floorId: string,
  x: number,
  y: number,
  label: string | null = null,
): EditorNode => ({
  id,
  floorId,
  buildingId: 'b1',
  x,
  y,
  type: 'NORMAL',
  label,
  qrSlug: null,
  scanCount: 0,
});

const graph: EditorGraph = {
  floors: [floor('f1', 1, 'Ground floor'), floor('f2', 2, 'First floor')],
  nodes: [
    node('n1', 'f1', 100, 100, 'Lobby'),
    node('n2', 'f1', 300, 200, 'Corridor'),
    node('n3', 'f2', 150, 150, 'Landing'),
  ],
  edges: [],
  pois: [],
};

const renderPage = () =>
  render(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/building/b1/nodes']}>
          <Routes>
            <Route path="/building/:buildingId/nodes" element={<MapEditorPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

const mapSvg = () =>
  screen.getByLabelText(en.mapEditor.title) as unknown as SVGSVGElement;

const tool = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  api.getBuildingGraph.mockResolvedValue(graph);
  api.validateBuilding.mockResolvedValue({ ok: true, issues: [] });
  building.getBuilding.mockResolvedValue({
    Success: true,
    Message: { buildingName: 'Tbilisi Mall' },
  });
});

describe('MapEditorPage — loading and floors', () => {
  test('renders the building name and every floor', async () => {
    renderPage();

    expect(await screen.findByText('Tbilisi Mall')).toBeInTheDocument();
    expect(screen.getByText('Ground floor')).toBeInTheDocument();
    expect(screen.getByText('First floor')).toBeInTheDocument();
    expect(api.getBuildingGraph).toHaveBeenCalledWith('b1');
  });

  test('switches floors by id, not by array position', async () => {
    const { container } = renderPage();
    await screen.findByText('Ground floor');

    // Floor 1 is active on load: only its nodes are drawn.
    expect(container.querySelector('[data-node-id="n1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="n3"]')).toBeNull();

    fireEvent.click(screen.getByTestId('floor-button-f2'));

    await waitFor(() =>
      expect(container.querySelector('[data-node-id="n3"]')).toBeInTheDocument(),
    );
    expect(container.querySelector('[data-node-id="n1"]')).toBeNull();
    expect(screen.getByTestId('floor-button-f2')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('MapEditorPage — placing nodes', () => {
  test('a tap on empty map in the place-node tool creates a node', async () => {
    api.createNode.mockResolvedValue(node('new1', 'f1', 321, 123));
    const { container } = renderPage();
    await screen.findByText('Ground floor');

    fireEvent.click(tool(en.mapEditor.toolPlaceNode));

    const svg = mapSvg();
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 40, clientY: 40 });

    await waitFor(() => expect(api.createNode).toHaveBeenCalledTimes(1));
    expect(api.createNode).toHaveBeenCalledWith('f1', {
      buildingId: 'b1',
      x: 321,
      y: 123,
      type: 'NORMAL',
    });
    await waitFor(() =>
      expect(container.querySelector('[data-node-id="new1"]')).toBeInTheDocument(),
    );
  });

  test('a press that starts on a marker never stacks a node on top of it', async () => {
    const { container } = renderPage();
    await screen.findByText('Ground floor');

    fireEvent.click(tool(en.mapEditor.toolPlaceNode));

    const marker = container.querySelector('[data-node-id="n1"]') as Element;
    fireEvent.pointerDown(marker, { pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(marker, { pointerId: 2, clientX: 10, clientY: 10 });

    await waitFor(() => expect(api.createNode).not.toHaveBeenCalled());
  });
});

describe('MapEditorPage — drawing edges', () => {
  test('clicking two nodes opens the connection form and posts the edge', async () => {
    api.createEdge.mockResolvedValue({
      id: 'e1',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      buildingId: 'b1',
      transitType: 'WALKWAY',
      accessible: true,
    });

    const { container } = renderPage();
    await screen.findByText('Ground floor');

    fireEvent.click(tool(en.mapEditor.toolDrawEdge));

    fireEvent.click(container.querySelector('[data-node-id="n1"]') as Element);
    // One endpoint picked — no dialog yet, but the cancel hint is up.
    expect(screen.getByText(en.mapEditor.cancelHint)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(container.querySelector('[data-node-id="n2"]') as Element);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: en.mapEditor.saveEdge }),
    );

    await waitFor(() => expect(api.createEdge).toHaveBeenCalledTimes(1));
    expect(api.createEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceNodeId: 'n1',
        targetNodeId: 'n2',
        buildingId: 'b1',
        transitType: 'WALKWAY',
        accessible: true,
      }),
    );
  });

  test('Escape abandons a half-drawn edge', async () => {
    const { container } = renderPage();
    await screen.findByText('Ground floor');

    fireEvent.click(tool(en.mapEditor.toolDrawEdge));
    fireEvent.click(container.querySelector('[data-node-id="n1"]') as Element);
    expect(screen.getByText(en.mapEditor.cancelHint)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByText(en.mapEditor.cancelHint)).toBeNull(),
    );
  });
});

describe('MapEditorPage — validation', () => {
  test('renders the issues the backend reported and re-runs on demand', async () => {
    api.validateBuilding.mockResolvedValue({
      ok: false,
      issues: [
        {
          code: 'ORPHAN_NODE',
          severity: 'error',
          message: 'Lobby is not connected to anything.',
          nodeIds: ['n1'],
        },
        {
          code: 'NO_SCALE',
          severity: 'warning',
          message: 'Floor 2 has no scale set.',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByText('Lobby is not connected to anything.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Floor 2 has no scale set.')).toBeInTheDocument();

    expect(api.validateBuilding).toHaveBeenCalledTimes(1);
    fireEvent.click(tool(en.mapEditor.validationRun));
    await waitFor(() => expect(api.validateBuilding).toHaveBeenCalledTimes(2));
  });

  test('a clean report shows the all-clear message', async () => {
    renderPage();
    expect(
      await screen.findByText(en.mapEditor.validationPassed),
    ).toBeInTheDocument();
  });

  test('clicking an issue selects the node it names', async () => {
    api.validateBuilding.mockResolvedValue({
      ok: false,
      issues: [
        {
          code: 'ORPHAN_NODE',
          severity: 'error',
          message: 'Lobby is not connected to anything.',
          nodeIds: ['n1'],
        },
      ],
    });

    const { container } = renderPage();
    const issue = await screen.findByText('Lobby is not connected to anything.');

    fireEvent.click(issue);

    // The selection ring only renders for the selected node.
    await waitFor(() =>
      expect(
        container
          .querySelector('[data-node-id="n1"]')
          ?.querySelector('circle[stroke="var(--ring)"]'),
      ).toBeTruthy(),
    );
  });
});

describe('MapEditorPage — floors panel', () => {
  test('adding a floor posts it and appends it to the list', async () => {
    api.createFloor.mockResolvedValue(floor('f3', 3, 'Roof'));
    renderPage();
    await screen.findByText('Ground floor');

    fireEvent.change(screen.getByLabelText(en.mapEditor.floorNumber), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText(en.mapEditor.floorName), {
      target: { value: 'Roof' },
    });
    fireEvent.click(tool(en.mapEditor.addFloor));

    await waitFor(() => expect(api.createFloor).toHaveBeenCalledTimes(1));
    expect(api.createFloor).toHaveBeenCalledWith('b1', expect.any(Object));
    expect(await screen.findByText('Roof')).toBeInTheDocument();
  });
});
