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


// The collab hook opens a real socket; in jsdom that means a doomed XHR poll
// loop and open handles. A stub socket keeps the page renderable while the
// collab paths simply stay dormant (never connected, no peers).
jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
    connected: false,
    volatile: { emit: jest.fn() },
  }),
}));

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

/**
 * Arm an editor tool.
 *
 * Tools live in dropdown menus rather than a flat strip, so picking one means
 * opening the menu that holds it. Which menu that is stays an implementation
 * detail here: try each in turn and click the item where it turns up.
 */
const selectTool = (name: string) => {
  // Graph tools only exist in Nodes mode — the editor opens in Draw mode so a
  // stray click cannot drop a routing node onto the plan. Try the current mode
  // first, then the other one.
  for (const attempt of [0, 1]) {
    if (attempt === 1) {
      fireEvent.click(screen.getByRole('radio', { name: en.mapEditor.modeNodes }));
    }
    const trigger = document.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
    if (!trigger) break;
    fireEvent.click(trigger);
    // Menu items carry a <kbd> shortcut hint, so the accessible name is
    // "Place node N" — match on the label prefix.
    const item = screen.queryByRole('menuitemradio', {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    });
    if (item) {
      fireEvent.click(item);
      return;
    }
    fireEvent.click(trigger); // close before switching mode
  }
  throw new Error(`No tool menu contains "${name}"`);
};

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

    selectTool(en.mapEditor.toolPlaceNode);

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

    selectTool(en.mapEditor.toolPlaceNode);

    const marker = container.querySelector('[data-node-id="n1"]') as Element;
    fireEvent.pointerDown(marker, { pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(marker, { pointerId: 2, clientX: 10, clientY: 10 });

    await waitFor(() => expect(api.createNode).not.toHaveBeenCalled());
  });
});

describe('MapEditorPage — drawing edges', () => {
  test('clicking two nodes creates a default connection with no modal', async () => {
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

    selectTool(en.mapEditor.toolDrawEdge);

    fireEvent.click(container.querySelector('[data-node-id="n1"]') as Element);
    // One endpoint picked — the cancel hint is up, and nothing was created.
    expect(screen.getByText(en.mapEditor.cancelHint)).toBeInTheDocument();
    expect(api.createEdge).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('[data-node-id="n2"]') as Element);

    // The edge posts immediately with defaults — the modal is gone. Three
    // questions whose answers were almost always the defaults now live in
    // the edge inspector instead.
    await waitFor(() => expect(api.createEdge).toHaveBeenCalledTimes(1));
    expect(api.createEdge).toHaveBeenCalledWith({
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      buildingId: 'b1',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(container.querySelector('[data-edge-id="e1"]')).toBeInTheDocument(),
    );
  });

  test('clicking an edge opens the edge inspector; delete removes it', async () => {
    api.getBuildingGraph.mockResolvedValue({
      ...graph,
      edges: [
        {
          id: 'e9',
          sourceNodeId: 'n1',
          targetNodeId: 'n2',
          buildingId: 'b1',
          transitType: 'WALKWAY',
          accessible: true,
          distance: 100,
        },
      ],
    });
    api.deleteEdge.mockResolvedValue(undefined);

    const { container } = renderPage();
    await screen.findByText('Ground floor');

    // The clickable element is the fat invisible hit line inside the edge group.
    const edgeGroup = container.querySelector('[data-edge-id="e9"]') as Element;
    const hitLine = edgeGroup.querySelector('line[stroke="transparent"]') as Element;
    fireEvent.click(hitLine);

    expect(await screen.findByTestId('edge-inspector')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: new RegExp(en.mapEditor.deleteEdge) })[0],
    );
    // On narrow viewports the inspector itself lives in a Sheet (also a
    // dialog); the confirm is whichever dialog holds the confirm body text.
    await screen.findByText(en.mapEditor.deleteEdgeConfirm);
    const confirm = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryByText(en.mapEditor.deleteEdgeConfirm))!;
    fireEvent.click(within(confirm).getByRole('button', { name: en.common.delete }));

    await waitFor(() => expect(api.deleteEdge).toHaveBeenCalledWith('e9'));
    await waitFor(() =>
      expect(container.querySelector('[data-edge-id="e9"]')).toBeNull(),
    );
  });

  test('placing a node auto-connects it to the nearest neighbour', async () => {
    api.createNode.mockResolvedValue(node('new1', 'f1', 321, 123));
    api.createEdge.mockResolvedValue({
      id: 'e-auto',
      sourceNodeId: 'n2',
      targetNodeId: 'new1',
      buildingId: 'b1',
      transitType: 'WALKWAY',
      accessible: true,
    });

    renderPage();
    await screen.findByText('Ground floor');

    selectTool(en.mapEditor.toolPlaceNode);

    const svg = mapSvg();
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 40, clientY: 40 });

    // The mocked tap lands at (321, 123); n2 sits at (300, 200) — inside the
    // auto-connect radius, so the new node arrives already wired in.
    await waitFor(() => expect(api.createEdge).toHaveBeenCalledTimes(1));
    expect(api.createEdge).toHaveBeenCalledWith({
      sourceNodeId: 'n2',
      targetNodeId: 'new1',
      buildingId: 'b1',
    });
  });

  test('auto-connect can be switched off', async () => {
    api.createNode.mockResolvedValue(node('new1', 'f1', 321, 123));
    renderPage();
    await screen.findByText('Ground floor');

    selectTool(en.mapEditor.toolPlaceNode);
    fireEvent.click(screen.getByRole('checkbox', { name: en.mapEditor.autoConnect }));

    const svg = mapSvg();
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 40, clientY: 40 });

    await waitFor(() => expect(api.createNode).toHaveBeenCalledTimes(1));
    expect(api.createEdge).not.toHaveBeenCalled();
  });

  test('Escape abandons a half-drawn edge', async () => {
    const { container } = renderPage();
    await screen.findByText('Ground floor');

    selectTool(en.mapEditor.toolDrawEdge);
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
    // A new floor is sized in metres — that is what gives it a blank canvas to
    // draw on, and what fixes the scale routes are measured against.
    fireEvent.change(screen.getByLabelText(en.mapEditor.widthMeters), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText(en.mapEditor.heightMeters), {
      target: { value: '16' },
    });
    fireEvent.click(tool(en.mapEditor.addFloor));

    await waitFor(() => expect(api.createFloor).toHaveBeenCalledTimes(1));
    // 20m x 16m at the default 50 px/m is the standard 1000x800 space.
    expect(api.createFloor).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        width: 1000,
        height: 800,
        scalePixelsPerMeter: 50,
      }),
    );
    expect(await screen.findByText('Roof')).toBeInTheDocument();
  });

  test('a floor cannot be created without a canvas to draw on', async () => {
    renderPage();
    await screen.findByText('Ground floor');

    fireEvent.change(screen.getByLabelText(en.mapEditor.floorNumber), {
      target: { value: '4' },
    });
    // No size and no uploaded plan — there is nothing to draw on yet.
    expect(tool(en.mapEditor.addFloor)).toBeDisabled();
  });

  test('an out-of-range room size is rejected before it is sent', async () => {
    renderPage();
    await screen.findByText('Ground floor');

    fireEvent.change(screen.getByLabelText(en.mapEditor.floorNumber), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(en.mapEditor.widthMeters), {
      target: { value: '99999' },
    });
    fireEvent.change(screen.getByLabelText(en.mapEditor.heightMeters), {
      target: { value: '10' },
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(tool(en.mapEditor.addFloor)).toBeDisabled();
    expect(api.createFloor).not.toHaveBeenCalled();
  });
});

describe('MapEditorPage — drawing, undo and delete', () => {
  /** Draw a wall via the UI: arm the tool, two taps, Enter to finish. */
  const drawWall = async () => {
    selectTool(en.mapEditor.toolDrawWall);
    const svg = mapSvg();
    fireEvent.pointerDown(svg, { pointerId: 5, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(svg, { pointerId: 5, clientX: 30, clientY: 30 });
    fireEvent.pointerDown(svg, { pointerId: 6, clientX: 80, clientY: 80 });
    fireEvent.pointerUp(svg, { pointerId: 6, clientX: 80, clientY: 80 });
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByTestId('drawing-layer');
  };

  test('Ctrl+Z undoes the last drawn shape; Ctrl+Shift+Z brings it back', async () => {
    renderPage();
    await screen.findByText('Ground floor');
    await drawWall();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() =>
      expect(screen.queryByTestId('drawing-layer')).toBeNull(),
    );

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(await screen.findByTestId('drawing-layer')).toBeInTheDocument();
  });

  test('Delete removes the selected shape', async () => {
    const { container } = renderPage();
    await screen.findByText('Ground floor');
    await drawWall();

    selectTool(en.mapEditor.toolSelect);
    fireEvent.click(container.querySelector('[data-shape-id]') as Element);
    fireEvent.keyDown(window, { key: 'Delete' });

    await waitFor(() =>
      expect(screen.queryByTestId('drawing-layer')).toBeNull(),
    );
  });

  test('pressing a tool shortcut arms the tool, switching mode if needed', async () => {
    renderPage();
    await screen.findByText('Ground floor');

    // "N" = place node, a Nodes-mode tool — the shortcut flips the mode too.
    fireEvent.keyDown(window, { key: 'n' });
    expect(
      screen.getByRole('radio', { name: en.mapEditor.modeNodes }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});

describe('MapEditorPage — eraser', () => {
  /** Tap the map at the mocked screenToMap point (321, 123). */
  const tapMap = () => {
    const svg = mapSvg();
    fireEvent.pointerDown(svg, { pointerId: 9, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(svg, { pointerId: 9, clientX: 50, clientY: 50 });
  };

  test('a tap near a node deletes it — no dead-centre click required', async () => {
    api.getBuildingGraph.mockResolvedValue({
      ...graph,
      nodes: [...graph.nodes, node('near', 'f1', 325, 125)],
    });
    api.deleteNode.mockResolvedValue(undefined);

    const { container } = renderPage();
    await screen.findByText('Ground floor');

    selectTool(en.mapEditor.toolErase);
    tapMap();

    // (321, 123) is ~4.5 units from the node at (325, 125) — well inside the
    // eraser's radius even though the click missed the marker element.
    await waitFor(() => expect(api.deleteNode).toHaveBeenCalledWith('near'));
    await waitFor(() =>
      expect(container.querySelector('[data-node-id="near"]')).toBeNull(),
    );
  });

  test('a tap on a connection deletes it when no node is nearer', async () => {
    api.getBuildingGraph.mockResolvedValue({
      ...graph,
      nodes: [node('a', 'f1', 321, 50), node('b', 'f1', 321, 200)],
      edges: [
        {
          id: 'e-target',
          sourceNodeId: 'a',
          targetNodeId: 'b',
          buildingId: 'b1',
          transitType: 'WALKWAY',
          accessible: true,
        },
      ],
    });
    api.deleteEdge.mockResolvedValue(undefined);

    const { container } = renderPage();
    await screen.findByText('Ground floor');

    selectTool(en.mapEditor.toolErase);
    tapMap();

    // The tap sits ON the a—b segment but 70+ units from either endpoint:
    // too far for the node radius, dead-on for the edge.
    await waitFor(() => expect(api.deleteEdge).toHaveBeenCalledWith('e-target'));
    expect(api.deleteNode).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(container.querySelector('[data-edge-id="e-target"]')).toBeNull(),
    );
  });

  test('a tap near a drawn shape deletes it', async () => {
    // No nodes at all, so nothing outranks the shape.
    api.getBuildingGraph.mockResolvedValue({ ...graph, nodes: [], edges: [] });
    renderPage();
    await screen.findByText('Ground floor');

    // Draw a wall at the mocked point, then erase with a tap beside it.
    selectTool(en.mapEditor.toolDrawWall);
    tapMap();
    tapMap();
    fireEvent.keyDown(window, { key: 'Enter' });
    await screen.findByTestId('drawing-layer');

    selectTool(en.mapEditor.toolErase);
    tapMap();

    await waitFor(() =>
      expect(screen.queryByTestId('drawing-layer')).toBeNull(),
    );
  });
});
