/* eslint-disable react-hooks/refs --
   Refs here mirror the latest state and callbacks during render on purpose:
   window listeners, timers and the reducer's intent handler read them
   imperatively and must never act on a stale value. This is the pattern the
   editor was built on before it was split into hooks; moving the writes into
   effects would change when those handlers observe an update. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  EMPTY_DRAWING,
  defaultOutlinePoints,
  outlineOf,
  OUTLINE_SHAPE_ID,
  translateShape,
  type DrawingShape,
  type FloorDrawing,
} from '../../../components/map';
import { updateFloor, updateNode, type EditorGraph } from '../../../apis/mapEditorApi';
import type { EditorAction, EditorState } from './editorReducer';
import type { EditorOp } from './useEditorCollab';
import { DRAWING_COMMIT_DELAY_MS, SNAP_STEP } from './editorConstants';
import type { Mutate, Setter, UpdateFloorFn } from './editorTypes';

interface UseEditorDrawingOptions {
  buildingId: string;
  mutate: Mutate;
  setGraph: Setter<EditorGraph>;
  graphRef: MutableRefObject<EditorGraph>;
  editorRef: MutableRefObject<EditorState>;
  sendOpRef: MutableRefObject<(op: EditorOp) => void>;
  dispatchRef: MutableRefObject<(action: EditorAction) => void>;
  handleUpdateFloorRef: MutableRefObject<UpdateFloorFn>;
}

/**
 * The floor drawing: local-first shape edits with a debounced save, per-floor
 * undo history, the floor-size draft, and footprint (outline) editing.
 */
export const useEditorDrawing = ({
  buildingId,
  mutate,
  setGraph,
  graphRef,
  editorRef,
  sendOpRef,
  dispatchRef,
  handleUpdateFloorRef,
}: UseEditorDrawingOptions) => {
  /*
   * Floor-size mode: dragging the canvas borders live-resizes the room.
   * The draft is local while the pointer is down; release persists via the
   * normal floor PATCH (which relays to collaborators like any floor edit).
   */
  const [canvasDraft, setCanvasDraft] = useState<{ width: number; height: number } | null>(null);
  const canvasResizeRef = useRef<'x' | 'y' | 'both' | null>(null);
  // Written synchronously on every drag frame: the release handler runs
  // before React renders the final frame, and must not read a stale size.
  const canvasDraftLiveRef = useRef<{ width: number; height: number } | null>(null);
  const applyCanvasDraft = useCallback(
    (
      next:
        | { width: number; height: number }
        | null
        | ((prev: { width: number; height: number } | null) => { width: number; height: number } | null),
    ) => {
      const value = typeof next === 'function' ? next(canvasDraftLiveRef.current) : next;
      canvasDraftLiveRef.current = value;
      setCanvasDraft(value);
    },
    [],
  );

  const beginCanvasResize = useCallback(
    (axis: 'x' | 'y' | 'both', e: ReactPointerEvent<SVGElement>) => {
      e.stopPropagation();
      const floor = graphRef.current.floors.find(
        (f) => f.id === editorRef.current.activeFloorId,
      );
      if (!floor) return;
      canvasResizeRef.current = axis;
      applyCanvasDraft({ width: floor.width || 1000, height: floor.height || 800 });
    },
    [applyCanvasDraft, editorRef, graphRef],
  );

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
  }, [graphRef, mutate, sendOpRef]);

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
      const apply = (g: EditorGraph): EditorGraph => ({
        ...g,
        floors: g.floors.map((floor) =>
          floor.id === floorId
            ? { ...floor, drawing: mutator(floor.drawing ?? EMPTY_DRAWING) }
            : floor,
        ),
      });
      // Eager ref update: release handlers (snap, outline normalize) run in
      // the same tick as the final rAF flush, BEFORE React re-renders — they
      // must see this edit, not the previous frame's graph.
      graphRef.current = apply(graphRef.current);
      setGraph(apply);
      scheduleDrawingSave(floorId);
    },
    [editorRef, graphRef, pushHistory, scheduleDrawingSave, setGraph],
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
        dispatchRef.current({ type: 'SHAPE_REMOVED', shapeId: selected });
      }
      scheduleDrawingSave(floorId);
    },
    [dispatchRef, editorRef, graphRef, scheduleDrawingSave, setGraph],
  );

  const applyHistoryRef = useRef(applyHistory);
  applyHistoryRef.current = applyHistory;

  /*
   * Footprint editing: the floor outline is a polygon, and any PART of a
   * border can move — drag a corner, or drag an edge midpoint to split that
   * edge and pull just the new corner out. That is what turns a rectangle
   * into an L-shape, a notch, a wing.
   */
  const outlineDragRef = useRef<number | null>(null);

  /** Current outline points, or the full-canvas rectangle it starts from. */
  const currentOutlinePoints = useCallback((): number[] => {
    const floor = graphRef.current.floors.find(
      (f) => f.id === editorRef.current.activeFloorId,
    );
    const existing = outlineOf(floor?.drawing);
    if (existing) return existing.points;
    return defaultOutlinePoints({
      width: floor?.width || 1000,
      height: floor?.height || 800,
    });
  }, [editorRef, graphRef]);

  /** Upsert the outline shape (fixed id) with new points. */
  const writeOutline = useCallback(
    (points: number[], options: { history?: boolean } = {}) => {
      editDrawing((drawing) => {
        const others = drawing.shapes.filter((shape) => shape.kind !== 'outline');
        return {
          ...drawing,
          shapes: [{ id: OUTLINE_SHAPE_ID, kind: 'outline', points }, ...others],
        };
      }, options);
    },
    [editDrawing],
  );

  const beginOutlineVertexDrag = useCallback(
    (vertexIndex: number, e: ReactPointerEvent<SVGElement>) => {
      e.stopPropagation();
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      // First touch materializes the default rectangle as a real outline.
      if (!outlineOf(drawing)) writeOutline(currentOutlinePoints(), { history: false });
      outlineDragRef.current = vertexIndex;
    },
    [currentOutlinePoints, editorRef, graphRef, writeOutline],
  );

  const beginOutlineMidpointDrag = useCallback(
    (segmentIndex: number, e: ReactPointerEvent<SVGElement>) => {
      e.stopPropagation();
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      // Split the edge at its midpoint; the new corner follows the pointer.
      const points = [...currentOutlinePoints()];
      const count = points.length / 2;
      const ax = points[segmentIndex * 2];
      const ay = points[segmentIndex * 2 + 1];
      const bIndex = (segmentIndex + 1) % count;
      const bx = points[bIndex * 2];
      const by = points[bIndex * 2 + 1];
      points.splice(segmentIndex * 2 + 2, 0, (ax + bx) / 2, (ay + by) / 2);
      writeOutline(points, { history: false });
      outlineDragRef.current = segmentIndex + 1;
    },
    [currentOutlinePoints, editorRef, graphRef, writeOutline],
  );

  /**
   * After an outline gesture: make the canvas fit the footprint.
   *
   * Right/bottom growth is a plain size bump. Top/left growth is a SHIFT —
   * the coordinate space has no negative side, so the whole plan (outline,
   * shapes, and every routing node) slides by the overflow and the canvas
   * grows by the same amount. Distances are unchanged by translation, so
   * routing costs stay valid.
   */
  const normalizeOutlineRelease = useCallback(async () => {
    const floorId = editorRef.current.activeFloorId;
    const floor = graphRef.current.floors.find((f) => f.id === floorId);
    if (!floorId || !floor) return;
    const outline = outlineOf(floor.drawing);
    if (!outline) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < outline.points.length; i += 2) {
      minX = Math.min(minX, outline.points[i]);
      maxX = Math.max(maxX, outline.points[i]);
      minY = Math.min(minY, outline.points[i + 1]);
      maxY = Math.max(maxY, outline.points[i + 1]);
    }

    const snapUp = (v: number) => Math.ceil(v / SNAP_STEP) * SNAP_STEP;
    const offsetX = minX < 0 ? snapUp(-minX) : 0;
    const offsetY = minY < 0 ? snapUp(-minY) : 0;

    if (offsetX > 0 || offsetY > 0) {
      // Slide the whole drawing (footprint included) into positive space.
      editDrawing(
        (drawing) => ({
          ...drawing,
          shapes: drawing.shapes.map((shape) => translateShape(shape, offsetX, offsetY)),
        }),
        { history: false },
      );
      // And the routing graph with it — the plan and its nodes must not
      // slide apart. Optimistic locally, persisted per node, relayed live.
      const floorNodes = graphRef.current.nodes.filter((n) => n.floorId === floorId);
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.floorId === floorId ? { ...n, x: n.x + offsetX, y: n.y + offsetY } : n,
        ),
      }));
      await Promise.all(
        floorNodes.map(async (node) => {
          const updated = await mutate(() =>
            updateNode(node.id, {
              buildingId,
              x: node.x + offsetX,
              y: node.y + offsetY,
            }),
          );
          if (updated) sendOpRef.current({ kind: 'node:upsert', node: updated });
        }),
      );
    }

    const clampSide = (v: number) => Math.min(Math.max(snapUp(v), 100), 20000);
    const nextWidth = clampSide(Math.max(floor.width || 1000, maxX) + offsetX);
    const nextHeight = clampSide(Math.max(floor.height || 800, maxY) + offsetY);
    if (nextWidth !== (floor.width || 1000) || nextHeight !== (floor.height || 800)) {
      await handleUpdateFloorRef.current(floorId, {
        width: nextWidth,
        height: nextHeight,
      });
    }
    applyCanvasDraft(null);
  }, [applyCanvasDraft, buildingId, editDrawing, editorRef, graphRef, handleUpdateFloorRef, mutate, sendOpRef, setGraph]);
  const normalizeOutlineReleaseRef = useRef(normalizeOutlineRelease);
  normalizeOutlineReleaseRef.current = normalizeOutlineRelease;
  const applyCanvasDraftRef = useRef(applyCanvasDraft);
  applyCanvasDraftRef.current = applyCanvasDraft;

  const removeOutlineVertex = useCallback(
    (vertexIndex: number) => {
      const points = [...currentOutlinePoints()];
      // A footprint needs at least three corners to stay a polygon.
      if (points.length <= 6) return;
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      points.splice(vertexIndex * 2, 2);
      writeOutline(points, { history: false });
    },
    [currentOutlinePoints, editorRef, graphRef, writeOutline],
  );

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

  return {
    canvasDraft,
    canvasResizeRef,
    canvasDraftLiveRef,
    applyCanvasDraft,
    applyCanvasDraftRef,
    beginCanvasResize,
    dirtyFloorRef,
    historyRef,
    historyVersion,
    pushHistoryRef,
    editDrawing,
    applyHistory,
    applyHistoryRef,
    outlineDragRef,
    beginOutlineVertexDrag,
    beginOutlineMidpointDrag,
    normalizeOutlineReleaseRef,
    removeOutlineVertex,
    addShape,
    patchShape,
  };
};
