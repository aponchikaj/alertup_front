import {
  editorReducer,
  hasPendingGesture,
  initialEditorState,
  type EditorState,
} from './editorReducer';

const state = (overrides: Partial<EditorState> = {}): EditorState => ({
  ...initialEditorState,
  ...overrides,
});

describe('editorReducer — tools', () => {
  test('SET_TOOL switches the tool and clears half-built gestures', () => {
    const start = state({
      tool: 'draw-edge',
      pendingEdgeSourceId: 'n1',
      transitLinkSourceId: 'n9',
      selectedEdgeId: 'e1',
    });

    const { state: next, intent } = editorReducer(start, {
      type: 'SET_TOOL',
      tool: 'place-node',
    });

    expect(next.tool).toBe('place-node');
    expect(next.pendingEdgeSourceId).toBeNull();
    expect(next.transitLinkSourceId).toBeNull();
    expect(next.selectedEdgeId).toBeNull();
    expect(intent).toBeUndefined();
  });

  test('SET_TOOL to the current tool is identity', () => {
    const start = state({ tool: 'select', pendingEdgeSourceId: 'n1' });
    expect(editorReducer(start, { type: 'SET_TOOL', tool: 'select' }).state).toBe(
      start,
    );
  });
});

describe('editorReducer — draw-edge', () => {
  test('first click stores the source, second click emits commit-edge', () => {
    const first = editorReducer(state({ tool: 'draw-edge' }), {
      type: 'NODE_CLICKED',
      nodeId: 'a',
      floorId: 'f1',
    });
    expect(first.state.pendingEdgeSourceId).toBe('a');
    expect(first.intent).toBeUndefined();

    const second = editorReducer(first.state, {
      type: 'NODE_CLICKED',
      nodeId: 'b',
      floorId: 'f1',
    });
    expect(second.intent).toEqual({
      type: 'commit-edge',
      sourceNodeId: 'a',
      targetNodeId: 'b',
    });
    expect(second.state.pendingEdgeSourceId).toBeNull();
    expect(second.state.selectedNodeId).toBe('b');
  });

  test('clicking the source twice un-picks it instead of making a self-edge', () => {
    const start = state({ tool: 'draw-edge', pendingEdgeSourceId: 'a' });
    const { state: next, intent } = editorReducer(start, {
      type: 'NODE_CLICKED',
      nodeId: 'a',
      floorId: 'f1',
    });
    expect(intent).toBeUndefined();
    expect(next.pendingEdgeSourceId).toBeNull();
  });

  test('changing floors drops the pending edge but keeps a transit source', () => {
    const start = state({
      tool: 'draw-edge',
      activeFloorId: 'f1',
      pendingEdgeSourceId: 'a',
      transitLinkSourceId: 'z',
      selectedNodeId: 'a',
    });
    const { state: next } = editorReducer(start, {
      type: 'SET_FLOOR',
      floorId: 'f2',
    });
    expect(next.activeFloorId).toBe('f2');
    expect(next.pendingEdgeSourceId).toBeNull();
    expect(next.selectedNodeId).toBeNull();
    expect(next.transitLinkSourceId).toBe('z');
  });
});

describe('editorReducer — link-transit', () => {
  test('picks a source on one floor and commits on another', () => {
    const first = editorReducer(state({ tool: 'link-transit', activeFloorId: 'f1' }), {
      type: 'NODE_CLICKED',
      nodeId: 'up',
      floorId: 'f1',
    });
    expect(first.state.transitLinkSourceId).toBe('up');

    const switched = editorReducer(first.state, {
      type: 'SET_FLOOR',
      floorId: 'f2',
    });
    expect(switched.state.transitLinkSourceId).toBe('up');

    const second = editorReducer(switched.state, {
      type: 'NODE_CLICKED',
      nodeId: 'down',
      floorId: 'f2',
    });
    expect(second.intent).toEqual({
      type: 'commit-transit-link',
      sourceNodeId: 'up',
      targetNodeId: 'down',
    });
    expect(second.state.transitLinkSourceId).toBeNull();
  });
});

describe('editorReducer — other tools', () => {
  test('place-node turns an empty-map click into create-node with coordinates', () => {
    const { intent } = editorReducer(state({ tool: 'place-node' }), {
      type: 'MAP_CLICKED',
      x: 120.5,
      y: 44,
    });
    expect(intent).toEqual({ type: 'create-node', x: 120.5, y: 44 });
  });

  test('a map click in any non-placing tool creates nothing', () => {
    for (const tool of ['select', 'pan', 'draw-edge', 'assign-poi'] as const) {
      const { intent } = editorReducer(state({ tool }), {
        type: 'MAP_CLICKED',
        x: 10,
        y: 10,
      });
      expect(intent).toBeUndefined();
    }
  });

  test('select tool deselects on an empty-map click', () => {
    const { state: next } = editorReducer(
      state({ tool: 'select', selectedNodeId: 'a' }),
      { type: 'MAP_CLICKED', x: 1, y: 2 },
    );
    expect(next.selectedNodeId).toBeNull();
  });

  test('assign-poi selects the node and asks the page to open the POI form', () => {
    const { state: next, intent } = editorReducer(state({ tool: 'assign-poi' }), {
      type: 'NODE_CLICKED',
      nodeId: 'shop',
      floorId: 'f1',
    });
    expect(next.selectedNodeId).toBe('shop');
    expect(intent).toEqual({ type: 'edit-poi', nodeId: 'shop' });
  });

  test('mark-exit emits a toggle intent — the page decides which way it flips', () => {
    const { intent } = editorReducer(state({ tool: 'mark-exit' }), {
      type: 'NODE_CLICKED',
      nodeId: 'door',
      floorId: 'f1',
    });
    expect(intent).toEqual({ type: 'toggle-exit', nodeId: 'door' });
  });

  test('the pan tool never edits anything', () => {
    const start = state({ tool: 'pan', selectedNodeId: null });
    const { state: next, intent } = editorReducer(start, {
      type: 'NODE_CLICKED',
      nodeId: 'a',
      floorId: 'f1',
    });
    expect(next).toBe(start);
    expect(intent).toBeUndefined();
  });
});

describe('editorReducer — cancel and cleanup', () => {
  test('CANCEL clears selection and every pending gesture', () => {
    const start = state({
      tool: 'draw-edge',
      selectedNodeId: 'a',
      selectedEdgeId: 'e',
      pendingEdgeSourceId: 'a',
      transitLinkSourceId: 'b',
    });
    const { state: next } = editorReducer(start, { type: 'CANCEL' });
    expect(next).toMatchObject({
      tool: 'draw-edge',
      selectedNodeId: null,
      selectedEdgeId: null,
      pendingEdgeSourceId: null,
      transitLinkSourceId: null,
    });
  });

  test('CANCEL on an idle state is identity', () => {
    const start = state();
    expect(editorReducer(start, { type: 'CANCEL' }).state).toBe(start);
  });

  test('NODE_REMOVED scrubs every reference to the deleted node', () => {
    const start = state({
      selectedNodeId: 'gone',
      hoveredNodeId: 'gone',
      pendingEdgeSourceId: 'gone',
      transitLinkSourceId: 'gone',
    });
    const { state: next } = editorReducer(start, {
      type: 'NODE_REMOVED',
      nodeId: 'gone',
    });
    expect(next.selectedNodeId).toBeNull();
    expect(next.hoveredNodeId).toBeNull();
    expect(next.pendingEdgeSourceId).toBeNull();
    expect(next.transitLinkSourceId).toBeNull();
  });

  test('NODE_REMOVED for an unrelated node is identity', () => {
    const start = state({ selectedNodeId: 'keep' });
    expect(
      editorReducer(start, { type: 'NODE_REMOVED', nodeId: 'other' }).state,
    ).toBe(start);
  });

  test('hasPendingGesture reflects both half-built flows', () => {
    expect(hasPendingGesture(state())).toBe(false);
    expect(hasPendingGesture(state({ pendingEdgeSourceId: 'a' }))).toBe(true);
    expect(hasPendingGesture(state({ transitLinkSourceId: 'a' }))).toBe(true);
  });
});

describe('editorReducer — selection', () => {
  test('selecting a node clears an edge selection and vice versa', () => {
    const withEdge = editorReducer(state(), { type: 'SELECT_EDGE', edgeId: 'e1' })
      .state;
    expect(withEdge.selectedEdgeId).toBe('e1');

    const withNode = editorReducer(withEdge, {
      type: 'SELECT_NODE',
      nodeId: 'n1',
    }).state;
    expect(withNode.selectedNodeId).toBe('n1');
    expect(withNode.selectedEdgeId).toBeNull();
  });

  test('HOVER_NODE with the same id is identity (no re-render churn)', () => {
    const start = state({ hoveredNodeId: 'a' });
    expect(editorReducer(start, { type: 'HOVER_NODE', nodeId: 'a' }).state).toBe(
      start,
    );
  });
});
