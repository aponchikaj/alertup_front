import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  DrawingLayer,
  DRAWING_DEFAULTS,
  EdgeLayer,
  EMPTY_DRAWING,
  FloorImageLayer,
  GRID_STEP,
  ICON_KINDS,
  ICON_NODE_TYPE,
  MapCanvas,
  NodeLayer,
  PoiLayer,
  clampToSpace,
  eraseHitTest,
  isBoxShape,
  newShapeId,
  pointSegmentDistance,
  rectFromPoints,
  screenToMap,
  shapeCenter,
  snapPoint,
  translateShape,
  useMapCamera,
  type DrawingShape,
  type FloorDrawing,
  type FloorSpace,
  type IconKind,
  type MapNode,
  type MapPoint,
  type NodeType,
  type ResizeHandle,
  type TransitType,
} from '../../../components/map';
import { Alert, Badge, EmptyState, Skeleton } from '../../../components/ui/feedback';
import { Button } from '../../../components/ui/button';
import { PageHeader, PageShell } from '../../../components/ui/layout';
import { Select } from '../../../components/ui/select';
import { Sheet } from '../../../components/ui/sheet';
import { useToast } from '../../../components/ui/toast';
import {
  AlertTriangleIcon,
  ExitDoorIcon,
  LayersIcon,
  MapIcon,
  MapPinIcon,
  PenIcon,
  PlusIcon,
  RefreshIcon,
  RouteIcon,
  ScanIcon,
  SquareIcon,
  StampIcon,
  TrashIcon,
  MaximizeIcon,
  MinimizeIcon,
  UndoIcon,
  RedoIcon,
} from '../../../components/ui/icons';
import SimpleQRCodeDisplay from '../../../components/simpleQRCodeDisplay';
import { cn } from '../../../lib/cn';
import { useI18n } from '../../../i18n/LanguageProvider';
import { errorMessage } from '../../../apis/http';
import { getBuilding } from '../../../apis/building';
import type { Node as LegacyNode } from '../../../apis/nodesApi';
import {
  createEdge,
  createFloor,
  deleteEdge,
  createNode,
  createTransitLink,
  deleteFloor,
  deleteNode,
  deletePoi,
  getBuildingGraph,
  savePoi,
  toEditorEdge,
  toEditorFloor,
  updateEdge,
  toEditorNode,
  toEditorPoi,
  updateFloor,
  updateNode,
  uploadShopLogo,
  validateBuilding,
  type EditorEdge,
  type EditorGraph,
  type EditorNode,
  type FloorInput,
  type RawEdge,
  type RawFloor,
  type RawNode,
  type RawPoi,
  type ValidationReport,
} from '../../../apis/mapEditorApi';
import {
  editorReducer,
  hasPendingGesture,
  initialEditorState,
  isDrawTool,
  type EditorAction,
  type EditorIntent,
  type EditorTool,
} from './editorReducer';
import { EdgeFormModal, type EdgeFormValues } from './edgeFormModal';
import { FloorsPanel } from './floorsPanel';
import { NodeInspector, type PoiFormValues } from './nodeInspector';
import { ShapeInspector } from './shapeInspector';
import { EdgeInspector } from './edgeInspector';
import { TransitLinkHelper } from './transitLinkHelper';
import { ICON_KIND_KEYS } from './labels';
import { useEditorCollab, type EditorOp } from './useEditorCollab';
import { PeerCursorsLayer, PresenceAvatars } from './collabUi';
import { ToolMenu, type ToolMenuItem } from './toolMenu';
import { ValidationPanel } from './validationPanel';

/* ============================================================================
   Map editor page (F3).
   ----------------------------------------------------------------------------
   Loads the building graph once and keeps it in local state; every mutation
   goes out, and only the row the server hands back is merged in. There is no
   optimistic "assume it worked" path for anything structural — this graph is
   what evacuation routing runs on, so the client never invents a node id.

   Interaction lives in editorReducer.ts (pure). This file owns exactly the
   things a reducer must not: fetches, timers, toasts and the camera.
   ========================================================================= */

const EMPTY_GRAPH: EditorGraph = { floors: [], nodes: [], edges: [], pois: [] };

/** Node PATCH after a drag. Long enough to coalesce a nudge-and-adjust. */
const DRAG_COMMIT_DELAY_MS = 150;

/**
 * Drawing PATCH debounce. Much longer than the node one: a drawing saves the
 * whole shape list at once, and drawing is a rapid-fire activity (drag a box,
 * nudge it, rename it). Coalescing hard keeps that to one request.
 */
const DRAWING_COMMIT_DELAY_MS = 700;

/** Snapping uses the drawn grid's own spacing, so every point the user places
 *  lands on a line they can see. See GRID_STEP for why these are one number. */
const SNAP_STEP = GRID_STEP;

/** Below this a drag is a mis-click, not a box the user meant to draw. */
const MIN_BOX_SIZE = 8;

/**
 * Auto-connect radius in map units (6 m at the default 50 px/m scale).
 *
 * Placing a chain of corridor nodes used to mean constant tool switching:
 * place, connect, place, connect. With auto-connect on, each new node links
 * itself to the nearest existing node within this radius, so a corridor is
 * one click per node. The radius is deliberately conservative — linking
 * across a wall to the room next door would silently create a route through
 * concrete.
 */
const AUTO_CONNECT_RADIUS = 300;

/**
 * Eraser hit tolerances, in map units. The eraser hit-tests geometry around
 * the tap instead of relying on the click landing on an exact SVG stroke —
 * a 6-unit wall or a 2-unit edge line is not a clickable target, and an
 * eraser that only works on dead-centre clicks reads as broken.
 */
const ERASE_NODE_RADIUS = 26;
const ERASE_EDGE_DISTANCE = 16;
const ERASE_SHAPE_SLOP = 8;

const DESKTOP_QUERY = '(min-width: 64rem)';

/** Select and pan belong to both modes — they edit nothing. */
const COMMON_TOOLS: ToolMenuItem[] = [
  { tool: 'select', labelKey: 'mapEditor.toolSelect', Icon: ScanIcon, shortcut: 'V' },
  { tool: 'pan', labelKey: 'mapEditor.toolPan', Icon: MapIcon, shortcut: 'H' },
];

const GRAPH_TOOLS: ToolMenuItem[] = [
  ...COMMON_TOOLS,
  { tool: 'place-node', labelKey: 'mapEditor.toolPlaceNode', Icon: PlusIcon, shortcut: 'N' },
  { tool: 'draw-edge', labelKey: 'mapEditor.toolDrawEdge', Icon: RouteIcon, shortcut: 'C' },
  { tool: 'assign-poi', labelKey: 'mapEditor.toolAssignPoi', Icon: MapPinIcon, shortcut: 'P' },
  { tool: 'link-transit', labelKey: 'mapEditor.toolLinkTransit', Icon: LayersIcon, shortcut: 'T' },
  { tool: 'mark-exit', labelKey: 'mapEditor.toolMarkExit', Icon: ExitDoorIcon, shortcut: 'X' },
];

const DRAW_TOOLS: ToolMenuItem[] = [
  ...COMMON_TOOLS,
  { tool: 'draw-wall', labelKey: 'mapEditor.toolDrawWall', Icon: PenIcon, shortcut: 'W' },
  { tool: 'draw-room', labelKey: 'mapEditor.toolDrawRoom', Icon: SquareIcon, shortcut: 'R' },
  { tool: 'stamp-icon', labelKey: 'mapEditor.toolStampIcon', Icon: StampIcon, shortcut: 'M' },
  { tool: 'erase', labelKey: 'mapEditor.toolErase', Icon: TrashIcon, shortcut: 'E' },
];

/**
 * key -> tool, flipping the editor into the right mode as it switches. "W"
 * means "wall" from anywhere; making the user check which mode is showing
 * first would defeat the point of a shortcut.
 */
const TOOL_SHORTCUTS: Record<string, { tool: EditorTool; nodesMode?: boolean }> = {
  v: { tool: 'select' },
  h: { tool: 'pan' },
  n: { tool: 'place-node', nodesMode: true },
  c: { tool: 'draw-edge', nodesMode: true },
  p: { tool: 'assign-poi', nodesMode: true },
  t: { tool: 'link-transit', nodesMode: true },
  x: { tool: 'mark-exit', nodesMode: true },
  w: { tool: 'draw-wall', nodesMode: false },
  r: { tool: 'draw-room', nodesMode: false },
  m: { tool: 'stamp-icon', nodesMode: false },
  e: { tool: 'erase', nodesMode: false },
};

const NODE_TYPE_KEYS: Record<NodeType, string> = {
  NORMAL: 'mapEditor.typeNormal',
  ENTRANCE: 'mapEditor.typeEntrance',
  TRANSIT: 'mapEditor.typeTransit',
  POI: 'mapEditor.typePoi',
  EMERGENCY_EXIT: 'mapEditor.typeEmergencyExit',
};

/** The legacy QR component predates the graph model; map onto its node shape. */
const LEGACY_TYPES: Record<NodeType, LegacyNode['type']> = {
  NORMAL: 'path',
  ENTRANCE: 'path',
  POI: 'path',
  TRANSIT: 'stairs',
  EMERGENCY_EXIT: 'exit',
};

const byFloorNumber = <T extends { floorNumber: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.floorNumber - b.floorNumber);

/** Tracks the lg breakpoint so the inspector renders in exactly one place. */
const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return isDesktop;
};

export const MapEditorPage = () => {
  const { buildingId = '' } = useParams<{ buildingId: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();

  const [graph, setGraph] = useState<EditorGraph>(EMPTY_GRAPH);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState('');

  const [editor, setEditor] = useState(initialEditorState);
  const [placeType, setPlaceType] = useState<NodeType>('NORMAL');
  const [pending, setPending] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [edgeDraft, setEdgeDraft] = useState<{
    kind: 'edge' | 'transit';
    sourceNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const [qrNode, setQrNode] = useState<EditorNode | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [poiExpanded, setPoiExpanded] = useState(false);

  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);

  // Rubber band for the room/shop tools, and the cursor that previews the next
  // wall segment. Both are ephemeral pointer state, so they live here rather
  // than in the reducer — same reasoning as the existing node drag.
  const [boxDraft, setBoxDraft] = useState<{ start: MapPoint; current: MapPoint } | null>(
    null,
  );
  const [wallCursor, setWallCursor] = useState<MapPoint | null>(null);

  // Live drag from a node towards its connection target (draw-edge tool).
  // Ephemeral pointer state, same reasoning as boxDraft.
  const [edgeDrag, setEdgeDrag] = useState<{
    sourceNodeId: string;
    current: MapPoint;
  } | null>(null);
  const edgeDragRef = useRef(edgeDrag);
  edgeDragRef.current = edgeDrag;

  // Drawing a floor plan wants every pixel it can get, so the editor can take
  // over the viewport with the toolbar floating over the canvas.
  const [fullscreen, setFullscreen] = useState(false);

  /*
   * Drawing and graph-wiring are separate modes, and drawing is the default.
   *
   * Both used to be armed at once, which meant a stray click while sketching a
   * shop could drop a routing node onto the plan — invisible work that then
   * shows up as an orphan in validation days later. Nodes now have to be
   * switched on deliberately.
   */
  const [nodesMode, setNodesMode] = useState(false);
  const nodesModeRef = useRef(nodesMode);
  nodesModeRef.current = nodesMode;

  // Refs mirror state for the imperative paths (window listeners, timers, the
  // intent handler) so none of them can act on a stale graph.
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const placeTypeRef = useRef(placeType);
  placeTypeRef.current = placeType;

  // Relays a confirmed mutation to the other editors in the room. A ref
  // because the mutation handlers above are declared before the collab hook
  // below can exist — it is filled in as soon as the hook returns.
  const sendOpRef = useRef<(op: EditorOp) => void>(() => {});
  const sendCursorRef = useRef<
    (x: number, y: number, floorId: string | null, tool: string) => void
  >(() => {});
  // Filled once removeShape exists below; the erase-at intent needs it.
  const removeShapeRef = useRef<(shapeId: string) => void>(() => {});
  // Filled once dispatch exists below; intents that cascade need it.
  const dispatchRef = useRef<(action: EditorAction) => void>(() => {});

  /* --- mutation plumbing ------------------------------------------------- */

  const mutate = useCallback(
    async <T,>(run: () => Promise<T>): Promise<T | null> => {
      setPending((n) => n + 1);
      try {
        const result = await run();
        setSavedAt(Date.now());
        return result;
      } catch (err) {
        toast({ title: errorMessage(err), tone: 'danger' });
        return null;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [toast],
  );

  /**
   * Create a connection with defaults: plain walkway, step-free, cost derived
   * from distance. Connections used to open a three-field modal; now they are
   * one gesture, and the edge inspector adjusts the rare non-default case.
   */
  const createDefaultEdge = useCallback(
    async (sourceNodeId: string, targetNodeId: string): Promise<EditorEdge | null> => {
      const created = await mutate(() =>
        createEdge({ sourceNodeId, targetNodeId, buildingId }),
      );
      if (!created) return null;
      setGraph((g) => ({ ...g, edges: [...g.edges, created] }));
      sendOpRef.current({ kind: 'edge:upsert', edge: created });
      return created;
    },
    [buildingId, mutate],
  );

  const createDefaultEdgeRef = useRef(createDefaultEdge);
  createDefaultEdgeRef.current = createDefaultEdge;

  /** Auto-connect toggle (place-node tool). On by default: a node nobody
   *  connects is an orphan the validator flags later anyway. */
  const [autoConnect, setAutoConnect] = useState(true);
  const autoConnectRef = useRef(autoConnect);
  autoConnectRef.current = autoConnect;

  /* --- drawing: mutate locally, persist on a debounce -------------------- */

  // Shapes are edited far more often than they are saved (drag a box, nudge
  // it, rename it), and the whole shape list goes over in one PATCH. So unlike
  // the graph mutations above — which are strictly server-authoritative — the
  // drawing is applied optimistically and flushed on a timer. It is safe here
  // precisely because routing does not read it: the worst case for a dropped
  // save is a lost rectangle, not a route into a wall.
  const drawingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyFloorRef = useRef<string | null>(null);

  /**
   * Per-floor undo history for the drawing. Graph mutations are excluded on
   * purpose: they are server-authoritative rows with cascading deletes, and a
   * half-faked undo of those is worse than none. Shapes are local-first, so
   * undo can be exact.
   */
  const historyRef = useRef(
    new Map<string, { past: FloorDrawing[]; future: FloorDrawing[] }>(),
  );
  // Bumped on every history change so canUndo/canRedo re-render.
  const [historyVersion, setHistoryVersion] = useState(0);

  const HISTORY_CAP = 50;

  /** Pushes closer together than this merge into one undo step — a typed
   *  name or a nudge-nudge-nudge should undo as a unit. */
  const HISTORY_COALESCE_MS = 800;
  const lastPushRef = useRef(new Map<string, number>());

  const pushHistory = useCallback((floorId: string, drawing: FloorDrawing) => {
    const now = Date.now();
    const last = lastPushRef.current.get(floorId) ?? 0;
    lastPushRef.current.set(floorId, now);
    const entry = historyRef.current.get(floorId) ?? { past: [], future: [] };
    if (now - last < HISTORY_COALESCE_MS && entry.past.length > 0) {
      // Still inside the same burst: the snapshot from its start stands.
      entry.future = [];
      return;
    }
    entry.past.push(drawing);
    if (entry.past.length > HISTORY_CAP) entry.past.shift();
    // A new edit invalidates the redo branch — standard history semantics.
    entry.future = [];
    historyRef.current.set(floorId, entry);
    setHistoryVersion((v) => v + 1);
  }, []);

  const pushHistoryRef = useRef(pushHistory);
  pushHistoryRef.current = pushHistory;

  const flushDrawing = useCallback(async () => {
    const floorId = dirtyFloorRef.current;
    dirtyFloorRef.current = null;
    if (!floorId) return;
    const floor = graphRef.current.floors.find((f) => f.id === floorId);
    if (!floor) return;
    const saved = await mutate(() => updateFloor(floorId, { drawing: floor.drawing }));
    // Peers get the server-normalized row, not our optimistic copy — their
    // view of the drawing is exactly what a refresh would give them.
    if (saved) sendOpRef.current({ kind: 'floor:upsert', floor: saved });
  }, [mutate]);

  const flushRef = useRef(flushDrawing);
  flushRef.current = flushDrawing;

  const scheduleDrawingSave = useCallback((floorId: string) => {
    dirtyFloorRef.current = floorId;
    if (drawingTimerRef.current) clearTimeout(drawingTimerRef.current);
    drawingTimerRef.current = setTimeout(() => {
      drawingTimerRef.current = null;
      void flushRef.current();
    }, DRAWING_COMMIT_DELAY_MS);
  }, []);

  /** Apply a change to the active floor's drawing and queue a save. */
  const editDrawing = useCallback(
    (
      mutator: (drawing: FloorDrawing) => FloorDrawing,
      options: { history?: boolean } = {},
    ) => {
      const floorId = editorRef.current.activeFloorId;
      if (!floorId) return;
      // Drag moves call this per pointer frame; they snapshot once on the
      // first frame (history: false afterwards) so undo steps whole gestures,
      // not individual pixels.
      if (options.history !== false) {
        const before =
          graphRef.current.floors.find((f) => f.id === floorId)?.drawing ??
          EMPTY_DRAWING;
        pushHistory(floorId, before);
      }
      setGraph((g) => ({
        ...g,
        floors: g.floors.map((floor) =>
          floor.id === floorId
            ? { ...floor, drawing: mutator(floor.drawing ?? EMPTY_DRAWING) }
            : floor,
        ),
      }));
      scheduleDrawingSave(floorId);
    },
    [pushHistory, scheduleDrawingSave],
  );

  const applyHistory = useCallback(
    (direction: 'undo' | 'redo') => {
      const floorId = editorRef.current.activeFloorId;
      if (!floorId) return;
      const entry = historyRef.current.get(floorId);
      const from = direction === 'undo' ? entry?.past : entry?.future;
      if (!entry || !from || from.length === 0) return;

      const current =
        graphRef.current.floors.find((f) => f.id === floorId)?.drawing ??
        EMPTY_DRAWING;
      const restored = from.pop() as FloorDrawing;
      (direction === 'undo' ? entry.future : entry.past).push(current);
      setHistoryVersion((v) => v + 1);

      setGraph((g) => ({
        ...g,
        floors: g.floors.map((floor) =>
          floor.id === floorId ? { ...floor, drawing: restored } : floor,
        ),
      }));
      // A restored state may drop the selected shape; the reducer scrubs it.
      const selected = editorRef.current.selectedShapeId;
      if (selected && !restored.shapes.some((shape) => shape.id === selected)) {
        dispatch({ type: 'SHAPE_REMOVED', shapeId: selected });
      }
      scheduleDrawingSave(floorId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleDrawingSave],
  );

  const applyHistoryRef = useRef(applyHistory);
  applyHistoryRef.current = applyHistory;

  const addShape = useCallback(
    (shape: DrawingShape) => {
      editDrawing((drawing) => ({ ...drawing, shapes: [...drawing.shapes, shape] }));
    },
    [editDrawing],
  );

  const patchShape = useCallback(
    (shapeId: string, patch: Partial<DrawingShape>) => {
      editDrawing((drawing) => ({
        ...drawing,
        shapes: drawing.shapes.map((shape) =>
          shape.id === shapeId ? ({ ...shape, ...patch } as DrawingShape) : shape,
        ),
      }));
    },
    [editDrawing],
  );

  // An unsaved drawing must not be lost to a navigation. Flushing on unmount
  // is best-effort — the request is already in flight by the time React tears
  // the tree down.
  useEffect(
    () => () => {
      if (drawingTimerRef.current) {
        clearTimeout(drawingTimerRef.current);
        void flushRef.current();
      }
    },
    [],
  );

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
          const point = { x: intent.x, y: intent.y };

          // Nodes first: they render on top, so they win ties — same rule the
          // eye applies. Then connections, then drawn shapes (topmost first).
          let nearestNode: { id: string; distance: number } | null = null;
          for (const node of current.nodes) {
            if (node.floorId !== floorId) continue;
            const distance = Math.hypot(node.x - point.x, node.y - point.y);
            if (!nearestNode || distance < nearestNode.distance) {
              nearestNode = { id: node.id, distance };
            }
          }
          if (nearestNode && nearestNode.distance <= ERASE_NODE_RADIUS) {
            await handleIntentRef.current({
              type: 'delete-node',
              nodeId: nearestNode.id,
            });
            return;
          }

          const nodesById = new Map(current.nodes.map((n) => [n.id, n]));
          let nearestEdge: { id: string; distance: number } | null = null;
          for (const edge of current.edges) {
            const a = nodesById.get(edge.sourceNodeId);
            const b = nodesById.get(edge.targetNodeId);
            // Only edges drawn on this floor are clickable targets.
            if (!a || !b || a.floorId !== floorId || b.floorId !== floorId) continue;
            const distance = pointSegmentDistance(point.x, point.y, a.x, a.y, b.x, b.y);
            if (!nearestEdge || distance < nearestEdge.distance) {
              nearestEdge = { id: edge.id, distance };
            }
          }
          if (nearestEdge && nearestEdge.distance <= ERASE_EDGE_DISTANCE) {
            await deleteEdgeByIdRef.current(nearestEdge.id);
            return;
          }

          const floor = current.floors.find((f) => f.id === floorId);
          const shape = floor
            ? eraseHitTest(floor.drawing?.shapes ?? [], point, ERASE_SHAPE_SLOP)
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
    [addShape, buildingId, mutate, t, toast],
  );

  const handleIntentRef = useRef(handleIntent);
  handleIntentRef.current = handleIntent;

  const dispatch = useCallback((action: EditorAction) => {
    const { state, intent } = editorReducer(editorRef.current, action);
    editorRef.current = state;
    setEditor(state);
    if (intent) void handleIntentRef.current(intent);
  }, []);
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
    [dispatch],
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

  /* --- load -------------------------------------------------------------- */

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getBuildingGraph(buildingId)
      .then((next) => {
        if (cancelled) return;
        const floors = byFloorNumber(next.floors);
        setGraph({ ...next, floors });
        dispatch({ type: 'SET_FLOOR', floorId: floors[0]?.id ?? null });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId, dispatch]);

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    getBuilding({ buildingID: buildingId })
      .then((res) => {
        if (cancelled || !res?.Success) return;
        const name = res.Message?.buildingName;
        if (typeof name === 'string' && name) setBuildingName(name);
      })
      .catch(() => {
        /* the header falls back to the generic title */
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  const runValidation = useCallback(async () => {
    if (!buildingId) return;
    setValidating(true);
    try {
      setReport(await validateBuilding(buildingId));
    } catch (err) {
      toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setValidating(false);
    }
  }, [buildingId, toast]);

  useEffect(() => {
    void runValidation();
  }, [runValidation]);

  /* --- derived ----------------------------------------------------------- */

  const activeFloor = useMemo(
    () => graph.floors.find((floor) => floor.id === editor.activeFloorId) ?? null,
    [graph.floors, editor.activeFloorId],
  );

  const space = useMemo<FloorSpace>(
    () => ({
      width: activeFloor?.width && activeFloor.width > 0 ? activeFloor.width : 1000,
      height: activeFloor?.height && activeFloor.height > 0 ? activeFloor.height : 800,
    }),
    [activeFloor],
  );

  const visibleNodes = useMemo(
    () => graph.nodes.filter((node) => node.floorId === editor.activeFloorId),
    [graph.nodes, editor.activeFloorId],
  );

  const nodesById = useMemo(
    () => new Map<string, MapNode>(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes],
  );

  const visiblePois = useMemo(
    () => graph.pois.filter((poi) => nodesById.has(poi.nodeId)),
    [graph.pois, nodesById],
  );

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === editor.selectedNodeId) ?? null,
    [graph.nodes, editor.selectedNodeId],
  );

  const selectedPoi = useMemo(
    () => graph.pois.find((poi) => poi.nodeId === editor.selectedNodeId) ?? null,
    [graph.pois, editor.selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => graph.edges.find((edge) => edge.id === editor.selectedEdgeId) ?? null,
    [graph.edges, editor.selectedEdgeId],
  );

  const activeDrawing = activeFloor?.drawing ?? EMPTY_DRAWING;

  const selectedShape = useMemo(
    () =>
      activeDrawing.shapes.find((shape) => shape.id === editor.selectedShapeId) ?? null,
    [activeDrawing.shapes, editor.selectedShapeId],
  );

  // A shape's node link is weak on purpose: deleting the node leaves the shape
  // drawn but unrouted, and this is what tells the inspector to offer a re-link
  // rather than claiming a connection that no longer exists.
  const selectedShapeNodeLinked = useMemo(() => {
    const nodeId =
      selectedShape && 'nodeId' in selectedShape ? selectedShape.nodeId : undefined;
    return Boolean(nodeId && graph.nodes.some((node) => node.id === nodeId));
  }, [graph.nodes, selectedShape]);

  const drawing = isDrawTool(editor.tool);

  // historyVersion is the dependency that makes these re-derive; the entries
  // themselves live in a ref.
  const { canUndo, canRedo } = useMemo(() => {
    void historyVersion;
    const entry = editor.activeFloorId
      ? historyRef.current.get(editor.activeFloorId)
      : undefined;
    return {
      canUndo: (entry?.past.length ?? 0) > 0,
      canRedo: (entry?.future.length ?? 0) > 0,
    };
  }, [editor.activeFloorId, historyVersion]);

  /* --- camera ------------------------------------------------------------ */

  const suppressTapRef = useRef(false);

  const spaceRef = useRef(space);
  spaceRef.current = space;

  const handleMapTap = useCallback(
    (point: MapPoint) => {
      if (suppressTapRef.current) {
        suppressTapRef.current = false;
        return;
      }
      // Drawing snaps to the grid so walls meet cleanly and rooms line up;
      // graph tools stay free-hand, because a node's exact position is the
      // user's judgement about where a person actually stands. The eraser is
      // aimed at existing geometry, so snapping would move the tap away from
      // the thing being aimed at.
      const tool = editorRef.current.tool;
      const placed =
        isDrawTool(tool) && tool !== 'erase'
          ? snapPoint(clampToSpace(point, spaceRef.current), SNAP_STEP)
          : point;
      dispatch({
        type: 'MAP_CLICKED',
        x: Math.round(placed.x),
        y: Math.round(placed.y),
      });
    },
    [dispatch],
  );

  const { camera, svgRef, handlers, controls, isDragging } = useMapCamera({
    space,
    onTap: handleMapTap,
  });

  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  /** Pointer position in snapped, clamped map coordinates. */
  const snappedPointFromEvent = useCallback(
    (clientX: number, clientY: number): MapPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = screenToMap(clientX, clientY, svg, cameraRef.current);
      if (!point) return null;
      return snapPoint(clampToSpace(point, spaceRef.current), SNAP_STEP);
    },
    [svgRef],
  );

  // A press that starts on a marker is a node interaction, not a map tap.
  // Deciding it here (rather than in the node handler) sidesteps the
  // target-before-ancestor ordering of bubbling pointer events.
  const svgHandlers = useMemo(
    () => ({
      ...handlers,
      onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
        const target = e.target as Element | null;
        suppressTapRef.current = Boolean(
          target?.closest?.('[data-node-id],[data-poi-id],[data-edge-id]'),
        );

        // Rooms are drag-to-size, so the press starts a rubber band rather
        // than a pan. Withholding the event from the camera is what stops the
        // floor sliding away underneath the box being drawn.
        const tool = editorRef.current.tool;
        if (tool === 'draw-room') {
          const point = snappedPointFromEvent(e.clientX, e.clientY);
          if (point) {
            setBoxDraft({ start: point, current: point });
            return;
          }
        }

        handlers.onPointerDown(e);
      },
      onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
        handlers.onPointerMove(e);
        // Broadcast the pointer to peers in raw (unsnapped) map coordinates —
        // a colleague's cursor should glide, not tick between grid lines.
        // sendCursor throttles internally, so per-event cost is a bounds check.
        const svg = svgRef.current;
        if (!svg) return;
        const point = screenToMap(e.clientX, e.clientY, svg, cameraRef.current);
        if (!point) return;
        sendCursorRef.current(
          point.x,
          point.y,
          editorRef.current.activeFloorId,
          editorRef.current.tool,
        );
      },
      // Double-click is the conventional "that's the end of the line" gesture
      // for a polyline tool; Enter and the toolbar button do the same thing.
      onDoubleClick: () => {
        if (editorRef.current.tool !== 'draw-wall') return;
        dispatch({ type: 'FINISH_WALL' });
        setWallCursor(null);
      },
    }),
    [dispatch, handlers, snappedPointFromEvent, svgRef],
  );

  /* --- node drag --------------------------------------------------------- */

  const dragRef = useRef<{ nodeId: string; moved: boolean } | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNodePosition = useCallback(
    async (nodeId: string) => {
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const updated = await mutate(() =>
        updateNode(nodeId, { buildingId, x: node.x, y: node.y }),
      );
      if (updated) {
        setGraph((g) => ({
          ...g,
          nodes: g.nodes.map((n) => (n.id === updated.id ? updated : n)),
        }));
        sendOpRef.current({ kind: 'node:upsert', node: updated });
      }
    },
    [buildingId, mutate],
  );

  const persistRef = useRef(persistNodePosition);
  persistRef.current = persistNodePosition;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const svg = svgRef.current;
      if (!drag || !svg) return;
      const point = screenToMap(e.clientX, e.clientY, svg, cameraRef.current);
      if (!point) return;
      drag.moved = true;
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((node) =>
          node.id === drag.nodeId ? { ...node, x: point.x, y: point.y } : node,
        ),
      }));
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || !drag.moved) return;
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
      dropTimerRef.current = setTimeout(() => {
        dropTimerRef.current = null;
        void persistRef.current(drag.nodeId);
      }, DRAG_COMMIT_DELAY_MS);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [svgRef]);

  // A pending PATCH must not fire after the page is gone.
  useEffect(
    () => () => {
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    },
    [],
  );

  const handleNodePointerDown = useCallback(
    (node: MapNode, e: ReactPointerEvent<SVGGElement>) => {
      const tool = editorRef.current.tool;

      // Drag-to-connect: press a node, pull the ghost line to its target,
      // release. The click-click flow still exists (touch screens have no
      // meaningful drag-from-small-target), this is just the faster path.
      if (tool === 'draw-edge') {
        e.stopPropagation();
        setEdgeDrag({ sourceNodeId: node.id, current: { x: node.x, y: node.y } });
        return;
      }

      if (tool !== 'select') return;
      // Stop the camera seeing this press, or dragging a node would pan the
      // floor out from under it.
      e.stopPropagation();
      dragRef.current = { nodeId: node.id, moved: false };
    },
    [],
  );

  /* --- shape drag and rubber band ---------------------------------------- */

  const shapeDragRef = useRef<{
    shapeId: string;
    last: MapPoint;
    moved: boolean;
  } | null>(null);

  const handleShapePointerDown = useCallback(
    (shape: DrawingShape, e: ReactPointerEvent<SVGGElement>) => {
      if (editorRef.current.tool !== 'select') return;
      const point = snappedPointFromEvent(e.clientX, e.clientY);
      if (!point) return;
      e.stopPropagation();
      shapeDragRef.current = { shapeId: shape.id, last: point, moved: false };
    },
    [snappedPointFromEvent],
  );

  /** Corner resize of the selected box. */
  const resizeRef = useRef<{ shapeId: string; handle: ResizeHandle } | null>(null);

  const handleResizePointerDown = useCallback(
    (shape: DrawingShape, handle: ResizeHandle, e: ReactPointerEvent<SVGRectElement>) => {
      if (!isBoxShape(shape)) return;
      // Must beat both the shape drag and the camera pan to the event.
      e.stopPropagation();
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      resizeRef.current = { shapeId: shape.id, handle };
    },
    [],
  );

  // Kept in refs so the window listeners below never close over a stale copy.
  const editDrawingRef = useRef(editDrawing);
  editDrawingRef.current = editDrawing;
  const snappedRef = useRef(snappedPointFromEvent);
  snappedRef.current = snappedPointFromEvent;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const point = snappedRef.current(e.clientX, e.clientY);
      if (!point) return;

      // Rubber band for a room/shop being sized.
      setBoxDraft((draft) => (draft ? { ...draft, current: point } : draft));

      // Ghost connection line chasing the pointer.
      setEdgeDrag((drag) => (drag ? { ...drag, current: point } : drag));

      // Ghost segment from the last wall vertex to the cursor.
      if (editorRef.current.tool === 'draw-wall') {
        setWallCursor(editorRef.current.wallPoints.length > 0 ? point : null);
      }

      // Resize takes priority: its handles sit on top of the shape, so a press
      // that started on one is never also a move.
      const resize = resizeRef.current;
      if (resize) {
        editDrawingRef.current((current) => ({
          ...current,
          shapes: current.shapes.map((shape) => {
            if (shape.id !== resize.shapeId || !isBoxShape(shape)) return shape;
            // Rebuild from the corner being dragged and the one opposite it,
            // so dragging a corner past its neighbour flips the box instead of
            // collapsing it to nothing.
            const anchor = {
              x: resize.handle === 'nw' || resize.handle === 'sw'
                ? shape.x + shape.width
                : shape.x,
              y: resize.handle === 'nw' || resize.handle === 'ne'
                ? shape.y + shape.height
                : shape.y,
            };
            const rect = rectFromPoints(anchor, point);
            if (rect.width < MIN_BOX_SIZE || rect.height < MIN_BOX_SIZE) return shape;
            return { ...shape, ...rect };
          }),
        }), { history: false });
        return;
      }

      const drag = shapeDragRef.current;
      if (!drag) return;
      const dx = point.x - drag.last.x;
      const dy = point.y - drag.last.y;
      // Snapping means most moves land on the same grid cell; skipping those
      // keeps this from queuing a save for every pointer event.
      if (dx === 0 && dy === 0) return;
      drag.last = point;
      drag.moved = true;
      editDrawingRef.current(
        (current) => ({
          ...current,
          shapes: current.shapes.map((shape) =>
            shape.id === drag.shapeId ? translateShape(shape, dx, dy) : shape,
          ),
        }),
        // Per-frame: the snapshot was taken when the drag started.
        { history: false },
      );
    };

    const onUp = (e: PointerEvent) => {
      shapeDragRef.current = null;
      resizeRef.current = null;

      const drag = edgeDragRef.current;
      if (drag) {
        setEdgeDrag(null);
        // The drop target is whatever node marker is under the pointer —
        // hit-testing the DOM beats re-deriving marker geometry here.
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetId = el
          ?.closest?.('[data-node-id]')
          ?.getAttribute('data-node-id');
        if (targetId && targetId !== drag.sourceNodeId) {
          void createDefaultEdgeRef.current(drag.sourceNodeId, targetId);
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Releasing the rubber band is what creates the room or shop. Bound
  // separately from the drag listeners above because it needs the tool and the
  // draft together, and re-binding on every draft change would be wasteful in
  // the (much hotter) move handler.
  useEffect(() => {
    if (!boxDraft) return;

    const commit = () => {
      const rect = rectFromPoints(boxDraft.start, boxDraft.current);
      setBoxDraft(null);
      // A click that never moved is not a box — treat it as a mis-click rather
      // than dropping an invisible sliver onto the plan.
      if (rect.width < MIN_BOX_SIZE || rect.height < MIN_BOX_SIZE) return;

      const id = newShapeId();
      // Every box starts as a plain room; the inspector promotes it to a shop
      // once it has a tenant. One tool, because "room" and "shop" were the
      // same drag with a different fill.
      addShape({
        id,
        kind: 'room',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      // Jump straight into naming it — a blank box is never the end state.
      dispatch({ type: 'SELECT_SHAPE', shapeId: id });
      setInspectorOpen(true);
    };

    window.addEventListener('pointerup', commit);
    window.addEventListener('pointercancel', commit);
    return () => {
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', commit);
    };
  }, [addShape, boxDraft, dispatch]);

  const handleNodeClick = useCallback(
    (node: MapNode) => {
      const tool = editorRef.current.tool;
      if (tool === 'select') setPoiExpanded(false);
      dispatch({
        type: 'NODE_CLICKED',
        nodeId: node.id,
        floorId: node.floorId ?? null,
      });
      if (tool === 'select') setInspectorOpen(true);
    },
    [dispatch],
  );

  /* --- Escape cancels ---------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape peels one layer at a time: abandon the gesture in progress
        // first, and only leave fullscreen once there is nothing to cancel.
        // Otherwise a mis-drawn wall would also throw away the workspace.
        const hadGesture =
          hasPendingGesture(editorRef.current) ||
          editorRef.current.selectedNodeId !== null ||
          editorRef.current.selectedShapeId !== null;

        dispatch({ type: 'CANCEL' });
        setBoxDraft(null);
        setWallCursor(null);
        if (!hadGesture) setFullscreen(false);
        return;
      }

      // Everything below is a shortcut, so it must not fire while the user is
      // typing a shop name into the inspector.
      const target = e.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (typing) return;

      const mod = e.metaKey || e.ctrlKey;

      // Undo / redo — drawing only; graph rows are server-authoritative.
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        applyHistoryRef.current(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        applyHistoryRef.current('redo');
        return;
      }
      if (mod) return; // leave every other browser combo alone

      if (e.key === 'Enter' && editorRef.current.tool === 'draw-wall') {
        e.preventDefault();
        dispatch({ type: 'FINISH_WALL' });
        setWallCursor(null);
        return;
      }

      // Delete removes whatever is selected — shape, node or connection.
      // No confirm on the keyboard path: pressing Delete on a selection is
      // already a deliberate act, and undo exists for shapes.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedShapeId, selectedNodeId, selectedEdgeId } = editorRef.current;
        if (selectedShapeId) {
          e.preventDefault();
          removeShape(selectedShapeId);
        } else if (selectedEdgeId) {
          e.preventDefault();
          void deleteEdgeByIdRef.current(selectedEdgeId);
        } else if (selectedNodeId) {
          e.preventDefault();
          void handleIntentRef.current({ type: 'delete-node', nodeId: selectedNodeId });
          dispatch({ type: 'NODE_REMOVED', nodeId: selectedNodeId });
        }
        return;
      }

      // Single-key tool switching. Keys flip the editing mode too, so "W"
      // always means "wall" no matter which mode is showing.
      const shortcut = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (shortcut && !e.altKey) {
        e.preventDefault();
        setNodesMode(shortcut.nodesMode ?? nodesModeRef.current);
        dispatch({ type: 'SET_TOOL', tool: shortcut.tool });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, removeShape]);

  /* --- edge / transit commit --------------------------------------------- */

  const submitEdge = useCallback(
    async (values: EdgeFormValues) => {
      const draft = edgeDraft;
      if (!draft) return;

      const created =
        draft.kind === 'edge'
          ? await mutate(() =>
              createEdge({
                sourceNodeId: draft.sourceNodeId,
                targetNodeId: draft.targetNodeId,
                buildingId,
                transitType: values.transitType,
                accessible: values.accessible,
                weight: values.weight,
              }),
            )
          : await mutate(() =>
              createTransitLink({
                nodeIds: [draft.sourceNodeId, draft.targetNodeId],
                transitType: values.transitType,
                buildingId,
                accessible: values.accessible,
              }),
            );

      if (!created) return;
      setGraph((g) => ({ ...g, edges: [...g.edges, created] }));
      sendOpRef.current({ kind: 'edge:upsert', edge: created });
      setEdgeDraft(null);
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, edgeDraft, mutate, t, toast],
  );

  /* --- floors ------------------------------------------------------------ */

  const handleCreateFloor = useCallback(
    async (input: FloorInput) => {
      const floor = await mutate(() => createFloor(buildingId, input));
      if (!floor) return false;
      setGraph((g) => ({ ...g, floors: byFloorNumber([...g.floors, floor]) }));
      sendOpRef.current({ kind: 'floor:upsert', floor });
      dispatch({ type: 'SET_FLOOR', floorId: floor.id });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
      return true;
    },
    [buildingId, dispatch, mutate, t, toast],
  );

  const handleUpdateFloor = useCallback(
    async (floorId: string, input: FloorInput) => {
      const floor = await mutate(() => updateFloor(floorId, input));
      if (!floor) return false;
      setGraph((g) => ({
        ...g,
        floors: byFloorNumber(g.floors.map((f) => (f.id === floor.id ? floor : f))),
      }));
      sendOpRef.current({ kind: 'floor:upsert', floor });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
      return true;
    },
    [mutate, t, toast],
  );

  const handleDeleteFloor = useCallback(
    async (floorId: string) => {
      const done = await mutate(async () => {
        await deleteFloor(floorId);
        return true;
      });
      if (!done) return;

      setGraph((g) => {
        const removedNodeIds = new Set(
          g.nodes.filter((n) => n.floorId === floorId).map((n) => n.id),
        );
        return {
          floors: g.floors.filter((f) => f.id !== floorId),
          nodes: g.nodes.filter((n) => !removedNodeIds.has(n.id)),
          edges: g.edges.filter(
            (e) =>
              !removedNodeIds.has(e.sourceNodeId) &&
              !removedNodeIds.has(e.targetNodeId),
          ),
          pois: g.pois.filter((p) => !removedNodeIds.has(p.nodeId)),
        };
      });

      if (editorRef.current.activeFloorId === floorId) {
        const next = graphRef.current.floors.find((f) => f.id !== floorId);
        dispatch({ type: 'SET_FLOOR', floorId: next?.id ?? null });
      }
      sendOpRef.current({ kind: 'floor:delete', floorId });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [dispatch, mutate, t, toast],
  );

  /* --- node inspector actions -------------------------------------------- */

  const handleSaveNode = useCallback(
    async (patch: { label: string | null; type: NodeType }) => {
      if (!selectedNode) return;
      const updated = await mutate(() =>
        updateNode(selectedNode.id, {
          buildingId,
          label: patch.label,
          type: patch.type,
        }),
      );
      if (!updated) return;
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) => (n.id === updated.id ? updated : n)),
      }));
      sendOpRef.current({ kind: 'node:upsert', node: updated });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, mutate, selectedNode, t, toast],
  );

  const handleDeleteNode = useCallback(async () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    const done = await mutate(async () => {
      await deleteNode(nodeId);
      return true;
    });
    if (!done) return;

    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== nodeId),
      edges: g.edges.filter(
        (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
      ),
      pois: g.pois.filter((p) => p.nodeId !== nodeId),
    }));
    sendOpRef.current({ kind: 'node:delete', nodeId });
    dispatch({ type: 'NODE_REMOVED', nodeId });
    setInspectorOpen(false);
    toast({ title: t('mapEditor.saved'), tone: 'success' });
  }, [dispatch, mutate, selectedNode, t, toast]);

  const handleSavePoi = useCallback(
    async (values: PoiFormValues) => {
      if (!selectedNode) return;
      const nodeId = selectedNode.id;
      const poi = await mutate(() =>
        savePoi(nodeId, {
          buildingId,
          name: values.name,
          category: values.category || null,
          description: values.description || null,
          keywords: values.keywords,
        }),
      );
      if (!poi) return;
      setGraph((g) => ({
        ...g,
        // Saving a POI also flips the node's type server-side; mirror it so the
        // marker changes without a refetch.
        nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, type: 'POI' } : n)),
        pois: g.pois.some((p) => p.nodeId === nodeId)
          ? g.pois.map((p) => (p.nodeId === nodeId ? poi : p))
          : [...g.pois, poi],
      }));
      sendOpRef.current({ kind: 'poi:upsert', poi });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, mutate, selectedNode, t, toast],
  );

  const handleRemovePoi = useCallback(async () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    const done = await mutate(async () => {
      await deletePoi(nodeId);
      return true;
    });
    if (!done) return;
    setGraph((g) => ({ ...g, pois: g.pois.filter((p) => p.nodeId !== nodeId) }));
    sendOpRef.current({ kind: 'poi:delete', nodeId });
    toast({ title: t('mapEditor.saved'), tone: 'success' });
  }, [mutate, selectedNode, t, toast]);

  /* --- edge actions ------------------------------------------------------- */

  const deleteEdgeById = useCallback(
    async (edgeId: string) => {
      const done = await mutate(async () => {
        await deleteEdge(edgeId);
        return true;
      });
      if (!done) return;
      setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edgeId) }));
      sendOpRef.current({ kind: 'edge:delete', edgeId });
      if (editorRef.current.selectedEdgeId === edgeId) {
        dispatch({ type: 'SELECT_EDGE', edgeId: null });
      }
    },
    [dispatch, mutate],
  );

  const deleteEdgeByIdRef = useRef(deleteEdgeById);
  deleteEdgeByIdRef.current = deleteEdgeById;

  const handleEdgeClick = useCallback(
    (edge: { id: string }) => {
      const tool = editorRef.current.tool;
      if (tool === 'erase') {
        void deleteEdgeById(edge.id);
        return;
      }
      if (tool !== 'select') return;
      dispatch({ type: 'SELECT_EDGE', edgeId: edge.id });
      setInspectorOpen(true);
    },
    [deleteEdgeById, dispatch],
  );

  const handleSaveEdge = useCallback(
    async (patch: {
      transitType?: TransitType;
      accessible?: boolean;
      weight?: number | null;
    }) => {
      if (!selectedEdge) return;
      const updated = await mutate(() =>
        updateEdge(selectedEdge.id, { buildingId, ...patch }),
      );
      if (!updated) return;
      setGraph((g) => ({
        ...g,
        edges: g.edges.map((e) => (e.id === updated.id ? updated : e)),
      }));
      sendOpRef.current({ kind: 'edge:upsert', edge: updated });
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, mutate, selectedEdge, t, toast],
  );

  const handleDeleteEdge = useCallback(async () => {
    if (!selectedEdge) return;
    await deleteEdgeById(selectedEdge.id);
    setInspectorOpen(false);
    toast({ title: t('mapEditor.saved'), tone: 'success' });
  }, [deleteEdgeById, selectedEdge, t, toast]);

  /* --- shape actions ----------------------------------------------------- */

  const handleShapeClick = useCallback(
    (shape: DrawingShape) => {
      const tool = editorRef.current.tool;

      // The eraser deletes on contact. Shapes are cheap to redraw and the
      // change is visible immediately, so this skips the confirm dialog the
      // inspector's delete button uses.
      if (tool === 'erase') {
        removeShape(shape.id);
        setInspectorOpen(false);
        return;
      }

      if (tool !== 'select') return;
      dispatch({ type: 'SELECT_SHAPE', shapeId: shape.id });
      setInspectorOpen(true);
    },
    [dispatch, removeShape],
  );

  const handleUploadLogo = useCallback(
    async (file: File) => mutate(() => uploadShopLogo(buildingId, file)),
    [buildingId, mutate],
  );

  /**
   * Create the routing node a shape stands for, and record the link.
   *
   * Used both when a shop is first named and when a shape's node has since
   * been deleted — the graph, not the drawing, decides what is routable, so
   * re-linking has to be possible.
   */
  const handleCreateNodeForShape = useCallback(
    async (shape: DrawingShape) => {
      const floorId = editorRef.current.activeFloorId;
      if (!floorId) return;

      const center = shapeCenter(shape);
      const type: NodeType =
        shape.kind === 'icon' ? (ICON_NODE_TYPE[shape.icon] ?? 'NORMAL') : 'POI';
      const label =
        'name' in shape && shape.name
          ? shape.name
          : shape.kind === 'icon'
            ? t(ICON_KIND_KEYS[shape.icon])
            : null;

      const node = await mutate(() =>
        createNode(floorId, {
          buildingId,
          x: Math.round(center.x),
          y: Math.round(center.y),
          type,
          label,
        }),
      );
      if (!node) return;

      setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
      sendOpRef.current({ kind: 'node:upsert', node });
      patchShape(shape.id, { nodeId: node.id } as Partial<DrawingShape>);

      // A shop is a destination people search for, so give it the POI record
      // that makes it findable — not just a node on the graph.
      if (shape.kind === 'shop' && 'name' in shape && shape.name) {
        const poi = await mutate(() =>
          savePoi(node.id, { buildingId, name: shape.name as string, keywords: [] }),
        );
        if (poi) {
          setGraph((g) => ({ ...g, pois: [...g.pois, poi] }));
          sendOpRef.current({ kind: 'poi:upsert', poi });
        }
      }

      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, mutate, patchShape, t, toast],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.floorId !== editorRef.current.activeFloorId) {
        dispatch({ type: 'SET_FLOOR', floorId: node.floorId });
      }
      dispatch({ type: 'SELECT_NODE', nodeId });
      controls.centerOn({ x: node.x, y: node.y });
      setInspectorOpen(true);
    },
    [controls, dispatch],
  );

  /* --- render ------------------------------------------------------------ */

  const pendingGesture = hasPendingGesture(editor);
  const saveLabel = pending > 0 ? t('mapEditor.unsaved') : savedAt ? t('mapEditor.saved') : null;

  // One inspector slot, whichever kind of thing is selected. The reducer
  // guarantees a node and a shape are never selected at once.
  const inspector = selectedShape ? (
    <ShapeInspector
      key={selectedShape.id}
      shape={selectedShape}
      nodeLinked={selectedShapeNodeLinked}
      onChange={(patch) => patchShape(selectedShape.id, patch)}
      onDelete={() => {
        removeShape(selectedShape.id);
        setInspectorOpen(false);
      }}
      onUploadLogo={handleUploadLogo}
      onCreateNode={() => handleCreateNodeForShape(selectedShape)}
    />
  ) : selectedEdge ? (
    <EdgeInspector
      key={selectedEdge.id}
      edge={selectedEdge}
      source={graph.nodes.find((n) => n.id === selectedEdge.sourceNodeId) ?? null}
      target={graph.nodes.find((n) => n.id === selectedEdge.targetNodeId) ?? null}
      onSave={handleSaveEdge}
      onDelete={handleDeleteEdge}
    />
  ) : selectedNode ? (
    <NodeInspector
      key={selectedNode.id}
      node={selectedNode}
      poi={selectedPoi}
      poiExpanded={poiExpanded}
      onSaveNode={handleSaveNode}
      onDeleteNode={handleDeleteNode}
      onSavePoi={handleSavePoi}
      onRemovePoi={handleRemovePoi}
      onShowQr={() => setQrNode(selectedNode)}
    />
  ) : null;

  if (loading) {
    return (
      <PageShell width="wide">
        <div role="status" aria-live="polite" className="flex flex-col gap-6">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton className="h-10 w-64 max-w-full" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell width="wide">
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title={t('common.error')}
          description={loadError}
          action={
            <Button onClick={() => window.location.reload()}>
              <RefreshIcon size={16} />
              {t('common.retry')}
            </Button>
          }
        />
      </PageShell>
    );
  }

  /* Toolbar. Drawing the plan and wiring the routing graph are two different
     jobs, so each gets its own menu rather than one long strip the user has to
     re-read every time. Built once and placed by both layouts — in the page
     flow normally, floating over the canvas in fullscreen. */
  const toolbar = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ModeSwitch
          nodesMode={nodesMode}
          onChange={(next) => {
            setNodesMode(next);
            // Leaving a mode disarms its tool, so the first click in the new
            // mode cannot complete a gesture belonging to the old one.
            dispatch({ type: 'SET_TOOL', tool: 'select' });
          }}
          t={t}
        />

        <ToolMenu
          label={nodesMode ? t('mapEditor.tools') : t('mapEditor.drawTools')}
          items={nodesMode ? GRAPH_TOOLS : DRAW_TOOLS}
          activeTool={editor.tool}
          onSelect={(tool) => dispatch({ type: 'SET_TOOL', tool })}
          t={t}
        />

        {editor.tool === 'place-node' && (
          <>
            <Select
              aria-label={t('mapEditor.nodeType')}
              className="w-48"
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value as NodeType)}
              options={(Object.keys(NODE_TYPE_KEYS) as NodeType[]).map((value) => ({
                value,
                label: t(NODE_TYPE_KEYS[value]),
              }))}
            />
            <label className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-[var(--brand)]"
              />
              {t('mapEditor.autoConnect')}
            </label>
          </>
        )}
        {editor.tool === 'stamp-icon' && (
          <Select
            aria-label={t('mapEditor.iconKind')}
            className="w-48"
            value={editor.stampIcon}
            onChange={(e) =>
              dispatch({ type: 'SET_STAMP_ICON', icon: e.target.value as IconKind })
            }
            options={ICON_KINDS.map((icon) => ({
              value: icon,
              label: t(ICON_KIND_KEYS[icon]),
            }))}
          />
        )}
        {editor.tool === 'draw-wall' && editor.wallPoints.length >= 4 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              dispatch({ type: 'FINISH_WALL' });
              setWallCursor(null);
            }}
          >
            {t('mapEditor.finishWall')}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatars peers={collab.peers} label={t('mapEditor.peersEditing')} />
          <Button
            variant="secondary"
            size="sm"
            disabled={!canUndo}
            onClick={() => applyHistory('undo')}
            aria-label={t('mapEditor.undo')}
            title={`${t('mapEditor.undo')} (Ctrl+Z)`}
          >
            <UndoIcon size={16} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canRedo}
            onClick={() => applyHistory('redo')}
            aria-label={t('mapEditor.redo')}
            title={`${t('mapEditor.redo')} (Ctrl+Shift+Z)`}
          >
            <RedoIcon size={16} />
          </Button>
          {saveLabel && (
            <Badge tone={pending > 0 ? 'info' : 'success'} aria-live="polite">
              {saveLabel}
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={controls.zoomIn}>
            {t('mapEditor.zoomIn')}
          </Button>
          <Button variant="secondary" size="sm" onClick={controls.zoomOut}>
            {t('mapEditor.zoomOut')}
          </Button>
          <Button variant="secondary" size="sm" onClick={controls.reset}>
            {t('mapEditor.resetView')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
            {fullscreen ? t('mapEditor.exitFullscreen') : t('mapEditor.fullscreen')}
          </Button>
        </div>
      </div>

      {drawing && !pendingGesture && (
        <Alert tone="info">{t(DRAW_TOOL_HINTS[editor.tool] ?? '')}</Alert>
      )}

      {pendingGesture && (
        <Alert tone="info">
          {editor.transitLinkSourceId
            ? `${t('mapEditor.pickTransitTarget')} ${t('mapEditor.cancelHint')}`
            : editor.wallPoints.length > 0
              ? `${t('mapEditor.wallInProgress')} ${t('mapEditor.cancelHint')}`
              : t('mapEditor.cancelHint')}
        </Alert>
      )}

      {/* Cross-floor linking, without the floor-switch scavenger hunt: the
          moment one endpoint is picked, every candidate on the other floors
          is one click away. */}
      {editor.transitLinkSourceId && (
        <TransitLinkHelper
          nodes={graph.nodes}
          floors={graph.floors}
          sourceNodeId={editor.transitLinkSourceId}
          onPick={(node) =>
            dispatch({ type: 'NODE_CLICKED', nodeId: node.id, floorId: node.floorId })
          }
        />
      )}
    </>
  );

  /** The map itself. `className` sizes it, which is the only thing the two
   *  layouts disagree about. */
  const renderCanvas = (className: string) => (
    <MapCanvas
      space={space}
      camera={camera}
      handlers={svgHandlers}
      svgRef={svgRef}
      interactive
      isDragging={isDragging}
      cursor={TOOL_CURSORS[editor.tool]}
      ariaLabel={t('mapEditor.title')}
      className={className}
    >
      <FloorImageLayer
        floor={activeFloor}
        space={space}
        // The empty grid is the canvas the user asked for, not a missing
        // asset — so it carries no caption.
        placeholderLabel={null}
      />
      <DrawingLayer
        drawing={activeDrawing}
        scale={camera.scale}
        selectedShapeId={editor.selectedShapeId}
        onShapeClick={handleShapeClick}
        onShapePointerDown={handleShapePointerDown}
        onResizePointerDown={handleResizePointerDown}
        shapeCursor={TOOL_CURSORS[editor.tool] ?? 'pointer'}
      />
      <DraftLayer
        boxDraft={boxDraft}
        wallPoints={editor.wallPoints}
        wallCursor={wallCursor}
        edgeGhost={
          edgeDrag
            ? {
                from:
                  nodesById.get(edgeDrag.sourceNodeId) ?? edgeDrag.current,
                to: edgeDrag.current,
              }
            : null
        }
      />
      <EdgeLayer
        edges={graph.edges}
        nodesById={nodesById}
        inaccessibleLabel={t('mapEditor.edgeAccessible')}
        selectedEdgeId={editor.selectedEdgeId}
        onEdgeClick={
          editor.tool === 'select' || editor.tool === 'erase'
            ? handleEdgeClick
            : undefined
        }
      />
      <PoiLayer
        pois={visiblePois}
        nodesById={nodesById}
        scale={camera.scale}
        selectedPoiId={selectedPoi?.id ?? null}
        onPoiClick={(_, node) => handleNodeClick(node)}
      />
      <NodeLayer
        nodes={visibleNodes}
        selectedId={editor.selectedNodeId}
        hoveredId={
          editor.pendingEdgeSourceId ??
          editor.transitLinkSourceId ??
          editor.hoveredNodeId
        }
        scale={camera.scale}
        onNodeClick={handleNodeClick}
        onNodePointerDown={handleNodePointerDown}
      />
      <PeerCursorsLayer
        cursors={collab.cursors}
        floorId={editor.activeFloorId}
        scale={camera.scale}
      />
    </MapCanvas>
  );

  const noFloors = graph.floors.length === 0;

  if (fullscreen) {
    return (
      <FullscreenEditor
        toolbar={toolbar}
        canvas={
          noFloors ? (
            <EmptyState
              icon={<LayersIcon size={24} />}
              title={t('mapEditor.floors')}
              description={t('mapEditor.noFloors')}
            />
          ) : (
            renderCanvas('h-full')
          )
        }
        inspector={inspector}
        floors={
          <FloorSwitcherStrip
            floors={graph.floors}
            activeFloorId={editor.activeFloorId}
            onSelect={(floorId) => dispatch({ type: 'SET_FLOOR', floorId })}
            t={t}
          />
        }
        title={buildingName || t('mapEditor.title')}
      />
    );
  }

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={buildingName || t('mapEditor.title')}
          description={buildingName ? t('mapEditor.title') : undefined}
        />

        <div className="flex flex-col gap-3">{toolbar}</div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-3">
            {graph.floors.length === 0 ? (
              <EmptyState
                icon={<LayersIcon size={24} />}
                title={t('mapEditor.floors')}
                description={t('mapEditor.noFloors')}
              />
            ) : (
              renderCanvas('h-[55vh] min-h-80 lg:h-[70vh]')
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {isDesktop && inspector && (
              <section className="rounded-2xl border border-line bg-surface p-4">
                {inspector}
              </section>
            )}

            <FloorsPanel
              floors={graph.floors}
              activeFloorId={editor.activeFloorId}
              onSelect={(floorId) => dispatch({ type: 'SET_FLOOR', floorId })}
              onCreate={handleCreateFloor}
              onUpdate={handleUpdateFloor}
              onDelete={handleDeleteFloor}
            />

            <ValidationPanel
              report={report}
              loading={validating}
              onRerun={() => void runValidation()}
              onFocusNode={focusNode}
            />
          </div>
        </div>
      </div>

      {!isDesktop && (
        <Sheet
          open={inspectorOpen && inspector !== null}
          onClose={() => setInspectorOpen(false)}
          title={selectedNode?.label || t('mapEditor.nodeLabel')}
          closeLabel={t('common.cancel')}
        >
          {inspector}
        </Sheet>
      )}

      {/* Mounted only while a connection is pending, so its fields reset by
          unmounting rather than by an effect. */}
      {edgeDraft && (
        <EdgeFormModal
          open
          onClose={() => setEdgeDraft(null)}
          onSubmit={submitEdge}
          lockTransit={edgeDraft.kind === 'transit'}
          submitting={pending > 0}
        />
      )}

      {qrNode && (
        <SimpleQRCodeDisplay
          node={toLegacyNode(qrNode, activeFloor?.floorNumber ?? 1)}
          buildingName={buildingName}
          floorName={
            activeFloor?.name || String(activeFloor?.floorNumber ?? 1)
          }
          onClose={() => setQrNode(null)}
        />
      )}
    </PageShell>
  );
};

/* --- small helpers ------------------------------------------------------- */

/**
 * Cursor per tool.
 *
 * The armed tool is otherwise only visible in the toolbar, which is exactly
 * where the user is not looking while they work. Crosshair means "this click
 * places something precise", copy means "this drops a copy of the marker", and
 * grab keeps its usual meaning so panning still feels like panning.
 */
const TOOL_CURSORS: Partial<Record<EditorTool, string>> = {
  select: 'default',
  pan: 'grab',
  'place-node': 'crosshair',
  'draw-edge': 'crosshair',
  'assign-poi': 'crosshair',
  'link-transit': 'crosshair',
  'mark-exit': 'crosshair',
  'draw-wall': 'crosshair',
  'draw-room': 'crosshair',
  'stamp-icon': 'copy',
  // No 'eraser' cursor exists; crosshair at least says "aimed action" —
  // not-allowed read as "this tool is disabled".
  erase: 'crosshair',
};

/** Per-tool instruction. A drawing tool that does not say what to do reads as
 *  broken — the canvas gives no other affordance. */
const DRAW_TOOL_HINTS: Partial<Record<EditorTool, string>> = {
  'draw-wall': 'mapEditor.hintDrawWall',
  'draw-room': 'mapEditor.hintDrawRoom',
  'stamp-icon': 'mapEditor.hintStampIcon',
  erase: 'mapEditor.hintErase',
};

/**
 * Draw / Nodes mode switch.
 *
 * A segmented control rather than a checkbox: the two modes are peers, and the
 * user needs to see which one they are in without reading a label. Nodes mode
 * is tinted because it is the one with consequences for evacuation routing.
 */
const ModeSwitch = ({
  nodesMode,
  onChange,
  t,
}: {
  nodesMode: boolean;
  onChange: (nodesMode: boolean) => void;
  t: (key: string) => string;
}) => (
  <div
    role="radiogroup"
    aria-label={t('mapEditor.mode')}
    className="inline-flex rounded-full border border-line bg-surface-2 p-0.5"
  >
    {[false, true].map((mode) => {
      const active = nodesMode === mode;
      return (
        <button
          key={String(mode)}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(mode)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
            'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            active
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {mode ? <RouteIcon size={15} /> : <PenIcon size={15} />}
          {mode ? t('mapEditor.modeNodes') : t('mapEditor.modeDraw')}
        </button>
      );
    })}
  </div>
);

/** Compact floor picker for fullscreen, where the floors panel is not on screen. */
const FloorSwitcherStrip = ({
  floors,
  activeFloorId,
  onSelect,
  t,
}: {
  floors: { id: string; name: string | null; floorNumber: number }[];
  activeFloorId: string | null;
  onSelect: (floorId: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) => {
  if (floors.length === 0) return null;
  return (
    <div
      role="radiogroup"
      aria-label={t('mapEditor.floors')}
      className="flex flex-wrap items-center gap-1.5"
    >
      {floors.map((floor) => {
        const active = floor.id === activeFloorId;
        return (
          <button
            key={floor.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(floor.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium',
              'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-line-strong bg-surface-2 text-ink'
                : 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {floor.name || t('wayfinding.floorShort', { number: floor.floorNumber })}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Fullscreen workspace: the canvas fills the viewport, and the toolbar floats
 * over it as a bar rather than pushing it down. Body scroll is locked, because
 * a page that scrolls behind a fixed overlay is how you lose your place.
 */
const FullscreenEditor = ({
  toolbar,
  canvas,
  inspector,
  floors,
  title,
}: {
  toolbar: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  floors: ReactNode;
  title: string;
}) => {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas" role="region" aria-label={title}>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-4 py-3">
        {toolbar}
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        <div className="h-full [&>*]:h-full">{canvas}</div>

        {/* Floor picker floats bottom-left; the inspector floats right. Both
            sit over the canvas so it keeps the full width underneath. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-6 flex justify-start">
          <div className="pointer-events-auto rounded-xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur">
            {floors}
          </div>
        </div>

        {inspector && (
          <aside className="absolute right-6 top-6 max-h-[calc(100%-3rem)] w-80 overflow-y-auto rounded-2xl border border-line bg-surface/95 p-4 shadow-xl backdrop-blur">
            {inspector}
          </aside>
        )}
      </div>
    </div>
  );
};

interface DraftLayerProps {
  boxDraft: { start: MapPoint; current: MapPoint } | null;
  wallPoints: number[];
  wallCursor: MapPoint | null;
  /** Connection being dragged from a node towards its target. */
  edgeGhost: { from: MapPoint; to: MapPoint } | null;
}

/**
 * The in-progress gesture: the rubber band while a box is being sized, and the
 * wall run with a ghost segment to the cursor. Never persisted — this is what
 * the user is doing, not what they have done.
 */
const DraftLayer = ({ boxDraft, wallPoints, wallCursor, edgeGhost }: DraftLayerProps) => {
  const rect = boxDraft ? rectFromPoints(boxDraft.start, boxDraft.current) : null;

  const wall: string[] = [];
  for (let i = 0; i + 1 < wallPoints.length; i += 2) {
    wall.push(`${wallPoints[i]},${wallPoints[i + 1]}`);
  }
  const ghost =
    wallCursor && wallPoints.length >= 2
      ? `${wallPoints[wallPoints.length - 2]},${wallPoints[wallPoints.length - 1]} ${wallCursor.x},${wallCursor.y}`
      : null;

  return (
    <g style={{ pointerEvents: 'none' }} data-testid="draft-layer">
      {edgeGhost && (
        <line
          x1={edgeGhost.from.x}
          y1={edgeGhost.from.y}
          x2={edgeGhost.to.x}
          y2={edgeGhost.to.y}
          stroke="var(--brand)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="7 5"
          opacity={0.8}
        />
      )}
      {rect && (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={3}
          fill={DRAWING_DEFAULTS.roomFill}
          fillOpacity={0.6}
          stroke={DRAWING_DEFAULTS.roomStroke}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}

      {wall.length > 0 && (
        <polyline
          points={wall.join(' ')}
          fill="none"
          stroke={DRAWING_DEFAULTS.wallColor}
          strokeWidth={DRAWING_DEFAULTS.wallThickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.8}
        />
      )}
      {ghost && (
        <polyline
          points={ghost}
          fill="none"
          stroke={DRAWING_DEFAULTS.wallColor}
          strokeWidth={DRAWING_DEFAULTS.wallThickness}
          strokeLinecap="round"
          strokeDasharray="8 6"
          strokeOpacity={0.45}
        />
      )}
      {/* Vertex handles, so it is obvious where the run has been pinned. */}
      {wall.map((point, i) => {
        const [cx, cy] = point.split(',').map(Number);
        return (
          <circle
            key={`${point}-${i}`}
            cx={cx}
            cy={cy}
            r={4}
            fill="var(--surface)"
            stroke={DRAWING_DEFAULTS.wallColor}
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
};

/** Closest node to (x, y) on a floor, with its distance. */
const nearestNodeOnFloor = (
  nodes: EditorNode[],
  floorId: string,
  x: number,
  y: number,
): { node: EditorNode; distance: number } | null => {
  let best: { node: EditorNode; distance: number } | null = null;
  for (const node of nodes) {
    if (node.floorId !== floorId) continue;
    const distance = Math.hypot(node.x - x, node.y - y);
    if (!best || distance < best.distance) best = { node, distance };
  }
  return best;
};

const toLegacyNode = (node: EditorNode, floorNumber: number): LegacyNode => ({
  _id: node.id,
  buildingId: node.buildingId,
  floorNumber,
  x: node.x,
  y: node.y,
  type: LEGACY_TYPES[node.type],
  connections: [],
  label: node.label ?? undefined,
  scanCount: node.scanCount,
  createdAt: '',
  updatedAt: '',
});

export default MapEditorPage;
