/* eslint-disable react-hooks/refs --
   Refs here mirror the latest state and callbacks during render on purpose:
   window listeners, timers and the reducer's intent handler read them
   imperatively and must never act on a stale value. This is the pattern the
   editor was built on before it was split into hooks; moving the writes into
   effects would change when those handlers observe an update. */
import { useCallback, useRef, type MutableRefObject } from 'react';
import {
  DRAWING_DEFAULTS,
  ICON_NODE_TYPE,
  eraseHitTest,
  newShapeId,
  type DrawingShape,
  type FloorDrawing,
  type NodeType,
} from '../../../components/map';
import {
  createNode,
  deleteNode,
  toEditorEdge,
  toEditorFloor,
  toEditorNode,
  toEditorPoi,
  updateNode,
  type EditorEdge,
  type EditorGraph,
  type RawEdge,
  type RawFloor,
  type RawNode,
  type RawPoi,
} from '../../../apis/mapEditorApi';
import {
  editorReducer,
  type EditorAction,
  type EditorIntent,
  type EditorState,
} from './editorReducer';
import { ICON_KIND_KEYS } from './labels';
import { useEditorCollab, type EditorOp } from './useEditorCollab';
import { AUTO_CONNECT_RADIUS, ERASE_SHAPE_SLOP } from './editorConstants';
import { byFloorNumber, nearestNodeOnFloor } from './editorHelpers';
import type { EdgeDraft, Mutate, Setter, ToastFn, Translate } from './editorTypes';

interface UseEditorDispatchOptions {
  buildingId: string;
  t: Translate;
  toast: ToastFn;
  mutate: Mutate;
  loading: boolean;
  loadError: string | null;
  setEditor: Setter<EditorState>;
  setGraph: Setter<EditorGraph>;
  setEdgeDraft: Setter<EdgeDraft | null>;
  setPoiExpanded: Setter<boolean>;
  setInspectorOpen: Setter<boolean>;
  graphRef: MutableRefObject<EditorGraph>;
  editorRef: MutableRefObject<EditorState>;
  placeTypeRef: MutableRefObject<NodeType>;
  autoConnectRef: MutableRefObject<boolean>;
  dirtyFloorRef: MutableRefObject<string | null>;
  historyRef: MutableRefObject<Map<string, { past: FloorDrawing[]; future: FloorDrawing[] }>>;
  sendOpRef: MutableRefObject<(op: EditorOp) => void>;
  sendCursorRef: MutableRefObject<
    (x: number, y: number, floorId: string | null, tool: string) => void
  >;
  removeShapeRef: MutableRefObject<(shapeId: string) => void>;
  dispatchRef: MutableRefObject<(action: EditorAction) => void>;
  createDefaultEdgeRef: MutableRefObject<
    (sourceNodeId: string, targetNodeId: string) => Promise<EditorEdge | null>
  >;
  addShape: (shape: DrawingShape) => void;
  editDrawing: (
    mutator: (drawing: FloorDrawing) => FloorDrawing,
    options?: { history?: boolean },
  ) => void;
}

/**
 * The reducer loop and live collaboration: intents the reducer emits are
 * acted on here, `dispatch` runs the reducer, and peers' confirmed mutations
 * are folded into local state.
 */
export const useEditorDispatch = ({
  buildingId,
  t,
  toast,
  mutate,
  loading,
  loadError,
  setEditor,
  setGraph,
  setEdgeDraft,
  setPoiExpanded,
  setInspectorOpen,
  graphRef,
  editorRef,
  placeTypeRef,
  autoConnectRef,
  dirtyFloorRef,
  historyRef,
  sendOpRef,
  sendCursorRef,
  removeShapeRef,
  dispatchRef,
  createDefaultEdgeRef,
  addShape,
  editDrawing,
}: UseEditorDispatchOptions) => {
  /* --- intents (the reducer asked, the page acts) ------------------------ */

  const handleIntent = useCallback(
    async (intent: EditorIntent) => {
      const current = graphRef.current;
      const floorId = editorRef.current.activeFloorId;

      switch (intent.type) {
        case 'create-node': {
          if (!floorId) return;
          const node = await mutate(() =>
            createNode(floorId, {
              buildingId,
              x: intent.x,
              y: intent.y,
              type: placeTypeRef.current,
            }),
          );
          if (!node) return;
          setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
          sendOpRef.current({ kind: 'node:upsert', node });

          // Auto-connect to the nearest neighbour, measured against the graph
          // as it was BEFORE this node landed — the new node is its own
          // nearest neighbour otherwise.
          if (autoConnectRef.current) {
            const nearest = nearestNodeOnFloor(current.nodes, floorId, intent.x, intent.y);
            if (nearest && nearest.distance <= AUTO_CONNECT_RADIUS) {
              await createDefaultEdgeRef.current(nearest.node.id, node.id);
            }
          }
          return;
        }

        case 'commit-edge':
          // Straight to a default walkway — the modal asked three questions
          // whose answers are almost always the defaults. The edge inspector
          // handles the exceptions after the fact.
          await createDefaultEdgeRef.current(intent.sourceNodeId, intent.targetNodeId);
          return;

        case 'commit-transit-link': {
          const source = current.nodes.find((n) => n.id === intent.sourceNodeId);
          const target = current.nodes.find((n) => n.id === intent.targetNodeId);
          if (source && target && source.floorId === target.floorId) {
            // The backend answers 422 here; saying so up front is kinder than
            // a round trip that ends in a red toast.
            toast({ title: t('mapEditor.pickTransitTarget'), tone: 'warning' });
            return;
          }
          setEdgeDraft({ kind: 'transit', ...intent });
          return;
        }

        case 'edit-poi':
          setPoiExpanded(true);
          setInspectorOpen(true);
          return;

        case 'toggle-exit': {
          const node = current.nodes.find((n) => n.id === intent.nodeId);
          if (!node) return;
          const nextType: NodeType =
            node.type === 'EMERGENCY_EXIT' ? 'NORMAL' : 'EMERGENCY_EXIT';
          const updated = await mutate(() =>
            updateNode(node.id, { buildingId, type: nextType }),
          );
          if (updated) {
            setGraph((g) => ({
              ...g,
              nodes: g.nodes.map((n) => (n.id === updated.id ? updated : n)),
            }));
            sendOpRef.current({ kind: 'node:upsert', node: updated });
          }
          return;
        }

        case 'delete-node': {
          const done = await mutate(async () => {
            await deleteNode(intent.nodeId);
            return true;
          });
          if (!done) return;
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.filter((n) => n.id !== intent.nodeId),
            edges: g.edges.filter(
              (e) =>
                e.sourceNodeId !== intent.nodeId && e.targetNodeId !== intent.nodeId,
            ),
            pois: g.pois.filter((p) => p.nodeId !== intent.nodeId),
          }));
          sendOpRef.current({ kind: 'node:delete', nodeId: intent.nodeId });
          // Scrub every editor reference to the dead node (selection, a
          // half-drawn edge from it, hover) — whichever path deleted it.
          dispatchRef.current({ type: 'NODE_REMOVED', nodeId: intent.nodeId });
          return;
        }

        case 'erase-at': {
          if (!floorId) return;
          // The eraser lives in Draw mode, where the routing graph is not
          // rendered — so it touches only drawn shapes. Nodes and connections
          // are deleted in Nodes mode (Delete key or inspector), where they
          // are visible. Erasing what cannot be seen is how work disappears
          // without anyone knowing why.
          const floor = current.floors.find((f) => f.id === floorId);
          const shape = floor
            ? eraseHitTest(floor.drawing?.shapes ?? [], { x: intent.x, y: intent.y }, ERASE_SHAPE_SLOP)
            : null;
          if (shape) removeShapeRef.current(shape.id);
          return;
        }

        case 'commit-wall': {
          addShape({
            id: newShapeId(),
            kind: 'wall',
            points: intent.points,
            thickness: DRAWING_DEFAULTS.wallThickness,
          });
          return;
        }

        case 'stamp-icon': {
          if (!floorId) return;
          const shapeId = newShapeId();
          const nodeType = ICON_NODE_TYPE[intent.icon];

          // A lift the router cannot see is worse than no lift: it looks
          // walkable and routes people into a dead end. So the marker and its
          // node are created together, and the shape records the link.
          let nodeId: string | undefined;
          if (nodeType) {
            const node = await mutate(() =>
              createNode(floorId, {
                buildingId,
                x: intent.x,
                y: intent.y,
                type: nodeType,
                label: t(ICON_KIND_KEYS[intent.icon]),
              }),
            );
            if (node) {
              nodeId = node.id;
              setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
              sendOpRef.current({ kind: 'node:upsert', node });
            }
          }

          addShape({
            id: shapeId,
            kind: 'icon',
            x: intent.x,
            y: intent.y,
            icon: intent.icon,
            size: 28,
            ...(nodeId ? { nodeId } : {}),
          });

          // Transit markers still need pairing with their twin on the other
          // floor; say so rather than letting it look finished.
          if (nodeType === 'TRANSIT') {
            toast({ title: t('mapEditor.transitStamped'), tone: 'info' });
          }
          return;
        }
      }
    },
    [addShape, autoConnectRef, buildingId, createDefaultEdgeRef, dispatchRef, editorRef, graphRef, mutate, placeTypeRef, removeShapeRef, sendOpRef, setEdgeDraft, setGraph, setInspectorOpen, setPoiExpanded, t, toast],
  );

  const handleIntentRef = useRef(handleIntent);
  handleIntentRef.current = handleIntent;

  const dispatch = useCallback((action: EditorAction) => {
    const { state, intent } = editorReducer(editorRef.current, action);
    editorRef.current = state;
    setEditor(state);
    if (intent) void handleIntentRef.current(intent);
  }, [editorRef, setEditor]);
  dispatchRef.current = dispatch;

  /* --- collaboration ------------------------------------------------------ */

  /**
   * Apply a peer's confirmed mutation to local state.
   *
   * Rows are re-run through the API mappers before they touch state: the relay
   * only checks shape, not content, and another editor's build could be older
   * or newer than ours. The mappers coerce numbers, default unknown enums and
   * (for drawings) re-apply the logo-URL rules, so a peer can leave us stale
   * at worst — never broken.
   */
  const applyRemoteOp = useCallback(
    (op: EditorOp) => {
      switch (op.kind) {
        case 'node:upsert': {
          const node = toEditorNode(op.node as unknown as RawNode);
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.some((n) => n.id === node.id)
              ? g.nodes.map((n) => (n.id === node.id ? node : n))
              : [...g.nodes, node],
          }));
          return;
        }

        case 'node:delete':
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.filter((n) => n.id !== op.nodeId),
            edges: g.edges.filter(
              (e) => e.sourceNodeId !== op.nodeId && e.targetNodeId !== op.nodeId,
            ),
            pois: g.pois.filter((p) => p.nodeId !== op.nodeId),
          }));
          dispatch({ type: 'NODE_REMOVED', nodeId: op.nodeId });
          return;

        case 'edge:upsert': {
          const edge = toEditorEdge(op.edge as unknown as RawEdge);
          setGraph((g) => ({
            ...g,
            edges: g.edges.some((e) => e.id === edge.id)
              ? g.edges.map((e) => (e.id === edge.id ? edge : e))
              : [...g.edges, edge],
          }));
          return;
        }

        case 'edge:delete':
          setGraph((g) => ({
            ...g,
            edges: g.edges.filter((e) => e.id !== op.edgeId),
          }));
          return;

        case 'poi:upsert': {
          const poi = toEditorPoi(op.poi as unknown as RawPoi);
          setGraph((g) => ({
            ...g,
            // Server-side, saving a POI flips its node's type; mirror it.
            nodes: g.nodes.map((n) =>
              n.id === poi.nodeId ? { ...n, type: 'POI' } : n,
            ),
            pois: g.pois.some((p) => p.nodeId === poi.nodeId)
              ? g.pois.map((p) => (p.nodeId === poi.nodeId ? poi : p))
              : [...g.pois, poi],
          }));
          return;
        }

        case 'poi:delete':
          setGraph((g) => ({
            ...g,
            pois: g.pois.filter((p) => p.nodeId !== op.nodeId),
          }));
          return;

        case 'floor:upsert': {
          const floor = toEditorFloor(op.floor as unknown as RawFloor);
          setGraph((g) => {
            const exists = g.floors.some((f) => f.id === floor.id);
            const floors = exists
              ? g.floors.map((f) => {
                  if (f.id !== floor.id) return f;
                  // Our unsaved shape edits beat the peer's snapshot of this
                  // floor: the pending flush will publish ours in a moment,
                  // and losing in-hand work to a race feels like data loss.
                  if (dirtyFloorRef.current === f.id) {
                    return { ...floor, drawing: f.drawing };
                  }
                  // Undoing over a peer's replacement would silently revert
                  // their work; the history restarts from their snapshot.
                  historyRef.current.delete(f.id);
                  return floor;
                })
              : [...g.floors, floor];
            return { ...g, floors: byFloorNumber(floors) };
          });
          return;
        }

        case 'floor:delete': {
          setGraph((g) => {
            const removedNodeIds = new Set(
              g.nodes.filter((n) => n.floorId === op.floorId).map((n) => n.id),
            );
            return {
              floors: g.floors.filter((f) => f.id !== op.floorId),
              nodes: g.nodes.filter((n) => !removedNodeIds.has(n.id)),
              edges: g.edges.filter(
                (e) =>
                  !removedNodeIds.has(e.sourceNodeId) &&
                  !removedNodeIds.has(e.targetNodeId),
              ),
              pois: g.pois.filter((p) => !removedNodeIds.has(p.nodeId)),
            };
          });
          if (editorRef.current.activeFloorId === op.floorId) {
            const next = graphRef.current.floors.find((f) => f.id !== op.floorId);
            dispatch({ type: 'SET_FLOOR', floorId: next?.id ?? null });
          }
          return;
        }

        case 'drawing':
          // Full-floor rows are relayed instead (floor:upsert); accepted for
          // forward compatibility, ignored.
          return;
      }
    },
    [dirtyFloorRef, dispatch, editorRef, graphRef, historyRef, setGraph],
  );

  const collab = useEditorCollab({
    buildingId,
    enabled: Boolean(buildingId) && !loading && !loadError,
    onRemoteOp: applyRemoteOp,
  });
  sendOpRef.current = collab.sendOp;
  sendCursorRef.current = collab.sendCursor;

  /** Delete a shape and drop any selection pointing at it. */
  const removeShape = useCallback(
    (shapeId: string) => {
      editDrawing((drawing) => ({
        ...drawing,
        shapes: drawing.shapes.filter((shape) => shape.id !== shapeId),
      }));
      dispatch({ type: 'SHAPE_REMOVED', shapeId });
    },
    [dispatch, editDrawing],
  );
  removeShapeRef.current = removeShape;

  return { handleIntentRef, dispatch, collab, removeShape };
};
