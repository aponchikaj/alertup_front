/* eslint-disable react-hooks/refs --
   Refs here mirror the latest state and callbacks during render on purpose:
   window listeners, timers and the reducer's intent handler read them
   imperatively and must never act on a stale value. This is the pattern the
   editor was built on before it was split into hooks; moving the writes into
   effects would change when those handlers observe an update. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampToSpace,
  isBoxShape,
  newShapeId,
  rectFromPoints,
  screenToMap,
  snapPoint,
  translateShape,
  useMapCamera,
  type DrawingShape,
  type FloorDrawing,
  type FloorSpace,
  type MapNode,
  type MapPoint,
  type ResizeHandle,
} from '../../../components/map';
import { updateNode, type EditorEdge, type EditorGraph } from '../../../apis/mapEditorApi';
import { isDrawTool, type EditorAction, type EditorState } from './editorReducer';
import type { EditorOp } from './useEditorCollab';
import { DRAG_COMMIT_DELAY_MS, MIN_BOX_SIZE, SNAP_STEP } from './editorConstants';
import type {
  BoxDraft,
  CanvasSize,
  EdgeDrag,
  Mutate,
  Setter,
  UpdateFloorFn,
} from './editorTypes';

interface UseEditorPointerOptions {
  buildingId: string;
  space: FloorSpace;
  mutate: Mutate;
  dispatch: (action: EditorAction) => void;
  boxDraft: BoxDraft | null;
  setGraph: Setter<EditorGraph>;
  setBoxDraft: Setter<BoxDraft | null>;
  setWallCursor: Setter<MapPoint | null>;
  setEdgeDrag: Setter<EdgeDrag | null>;
  setInspectorOpen: Setter<boolean>;
  setPoiExpanded: Setter<boolean>;
  graphRef: MutableRefObject<EditorGraph>;
  editorRef: MutableRefObject<EditorState>;
  edgeDragRef: MutableRefObject<EdgeDrag | null>;
  sendOpRef: MutableRefObject<(op: EditorOp) => void>;
  sendCursorRef: MutableRefObject<
    (x: number, y: number, floorId: string | null, tool: string) => void
  >;
  pushHistoryRef: MutableRefObject<(floorId: string, drawing: FloorDrawing) => void>;
  applyCanvasDraftRef: MutableRefObject<
    (next: CanvasSize | null | ((prev: CanvasSize | null) => CanvasSize | null)) => void
  >;
  outlineDragRef: MutableRefObject<number | null>;
  canvasResizeRef: MutableRefObject<'x' | 'y' | 'both' | null>;
  canvasDraftLiveRef: MutableRefObject<CanvasSize | null>;
  normalizeOutlineReleaseRef: MutableRefObject<() => Promise<void>>;
  handleUpdateFloorRef: MutableRefObject<UpdateFloorFn>;
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
 * Everything the pointer does on the canvas: the camera, map taps, node drag,
 * shape drag / resize / reshape, outline and canvas-border drags, the room
 * rubber band and drag-to-connect.
 */
export const useEditorPointer = ({
  buildingId,
  space,
  mutate,
  dispatch,
  boxDraft,
  setGraph,
  setBoxDraft,
  setWallCursor,
  setEdgeDrag,
  setInspectorOpen,
  setPoiExpanded,
  graphRef,
  editorRef,
  edgeDragRef,
  sendOpRef,
  sendCursorRef,
  pushHistoryRef,
  applyCanvasDraftRef,
  outlineDragRef,
  canvasResizeRef,
  canvasDraftLiveRef,
  normalizeOutlineReleaseRef,
  handleUpdateFloorRef,
  createDefaultEdgeRef,
  addShape,
  editDrawing,
}: UseEditorPointerOptions) => {
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
    [dispatch, editorRef],
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
          const svg = svgRef.current;
          const raw = svg
            ? screenToMap(e.clientX, e.clientY, svg, cameraRef.current)
            : null;
          if (raw) {
            const point = clampToSpace(raw, spaceRef.current);
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
    [dispatch, editorRef, handlers, sendCursorRef, setBoxDraft, setWallCursor, svgRef],
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
    [buildingId, graphRef, mutate, sendOpRef, setGraph],
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
  }, [setGraph, svgRef]);

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
    [editorRef, setEdgeDrag],
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
    [editorRef, snappedPointFromEvent],
  );

  /** Corner resize of the selected box. */
  const resizeRef = useRef<{ shapeId: string; handle: ResizeHandle } | null>(null);

  /** Vertex reshape of the selected wall. */
  const wallVertexRef = useRef<{ shapeId: string; vertexIndex: number } | null>(null);

  const handleWallVertexPointerDown = useCallback(
    (shape: DrawingShape, vertexIndex: number, e: ReactPointerEvent<SVGCircleElement>) => {
      if (shape.kind !== 'wall') return;
      e.stopPropagation();
      // One undo step per reshape gesture.
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      wallVertexRef.current = { shapeId: shape.id, vertexIndex };
    },
    [editorRef, graphRef, pushHistoryRef],
  );

  const handleResizePointerDown = useCallback(
    (shape: DrawingShape, handle: ResizeHandle, e: ReactPointerEvent<SVGRectElement>) => {
      if (!isBoxShape(shape) && shape.kind !== 'icon') return;
      // Must beat both the shape drag and the camera pan to the event.
      e.stopPropagation();
      const floorId = editorRef.current.activeFloorId;
      const drawing = floorId
        ? graphRef.current.floors.find((f) => f.id === floorId)?.drawing
        : null;
      if (floorId && drawing) pushHistoryRef.current(floorId, drawing);
      resizeRef.current = { shapeId: shape.id, handle };
    },
    [editorRef, graphRef, pushHistoryRef],
  );

  // Kept in refs so the window listeners below never close over a stale copy.
  const editDrawingRef = useRef(editDrawing);
  editDrawingRef.current = editDrawing;
  const snappedRef = useRef(snappedPointFromEvent);
  snappedRef.current = snappedPointFromEvent;

  useEffect(() => {
    /*
     * SMOOTHNESS RULES, learned the hard way:
     *
     * 1. Pointer events outrun frames — mice report at 125–1000 Hz, and
     *    rendering per event drops frames. Every move is coalesced through
     *    requestAnimationFrame: many events, at most one state update per
     *    painted frame. onUp flushes the pending move first, so tests (and
     *    ultra-fast flicks) never lose the final position.
     *
     * 2. Dragging is FREE, snapping happens on RELEASE. Live grid-snapping
     *    moved things in 25-unit jumps — visually chunky, "bad quality".
     *    Now shapes glide with the pointer at full resolution and settle
     *    onto the grid exactly once, when the finger lifts.
     */
    const SNAP = SNAP_STEP;
    const snapValue = (v: number) => Math.round(v / SNAP) * SNAP;

    const rawPoint = (e: PointerEvent) => {
      const svg = svgRef.current;
      return svg ? screenToMap(e.clientX, e.clientY, svg, cameraRef.current) : null;
    };

    const applyMove = (e: PointerEvent) => {
      const raw = rawPoint(e);
      if (!raw) return;
      // In-canvas gestures stay in the canvas; growth gestures (outline,
      // canvas border) read the unclamped value themselves.
      const point = clampToSpace(raw, spaceRef.current);

      // Rubber band for a room being sized — free; the box snaps on commit.
      setBoxDraft((draft) => (draft ? { ...draft, current: point } : draft));

      // Ghost connection line chasing the pointer.
      setEdgeDrag((drag) => (drag ? { ...drag, current: point } : drag));

      // Ghost segment from the last wall vertex to the cursor.
      if (editorRef.current.tool === 'draw-wall') {
        setWallCursor(editorRef.current.wallPoints.length > 0 ? point : null);
      }

      // A grabbed footprint corner follows the pointer — UNCLAMPED. Pulling
      // a border past the canvas is how the floor grows; the canvas catches
      // up live (right/bottom) and on release (top/left, via a shift).
      const outlineVertex = outlineDragRef.current;
      if (outlineVertex !== null) {
        editDrawingRef.current((current) => ({
          ...current,
          shapes: current.shapes.map((shape) => {
            if (shape.kind !== 'outline') return shape;
            const points = [...shape.points];
            points[outlineVertex * 2] = raw.x;
            points[outlineVertex * 2 + 1] = raw.y;
            return { ...shape, points };
          }),
        }), { history: false });
        // Keep the dragged corner visible while it travels beyond the border.
        const floor = graphRef.current.floors.find(
          (f) => f.id === editorRef.current.activeFloorId,
        );
        const baseW = floor?.width || 1000;
        const baseH = floor?.height || 800;
        if (raw.x > baseW || raw.y > baseH) {
          applyCanvasDraftRef.current((draft) => ({
            width: Math.max(draft?.width ?? baseW, baseW, raw.x),
            height: Math.max(draft?.height ?? baseH, baseH, raw.y),
          }));
        }
        return;
      }

      // Floor-size mode: the grabbed border follows the pointer freely and
      // settles onto the grid at release.
      const canvasAxis = canvasResizeRef.current;
      if (canvasAxis) {
        const clampSide = (v: number) => Math.min(Math.max(v, 100), 20000);
        applyCanvasDraftRef.current((draft) => {
          if (!draft) return draft;
          return {
            width: canvasAxis === 'y' ? draft.width : clampSide(raw.x),
            height: canvasAxis === 'x' ? draft.height : clampSide(raw.y),
          };
        });
        return;
      }

      // A grabbed wall vertex follows the pointer — reshaping one corner of
      // the run, not moving the whole line.
      const vertexDrag = wallVertexRef.current;
      if (vertexDrag) {
        editDrawingRef.current((current) => ({
          ...current,
          shapes: current.shapes.map((shape) => {
            if (shape.id !== vertexDrag.shapeId || shape.kind !== 'wall') return shape;
            const points = [...shape.points];
            points[vertexDrag.vertexIndex * 2] = point.x;
            points[vertexDrag.vertexIndex * 2 + 1] = point.y;
            return { ...shape, points };
          }),
        }), { history: false });
        return;
      }

      // Resize takes priority: its handles sit on top of the shape, so a press
      // that started on one is never also a move.
      const resize = resizeRef.current;
      if (resize) {
        editDrawingRef.current((current) => ({
          ...current,
          shapes: current.shapes.map((shape) => {
            if (shape.id !== resize.shapeId) return shape;
            // Icons carry one size, scaled from their centre — the handle
            // distance sets it, clamped to something tappable-but-sane.
            if (shape.kind === 'icon') {
              const size = Math.min(
                Math.max(
                  2 * Math.max(Math.abs(point.x - shape.x), Math.abs(point.y - shape.y)),
                  12,
                ),
                200,
              );
              return { ...shape, size: Math.round(size) };
            }
            if (!isBoxShape(shape)) return shape;
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

    // rAF coalescing: remember only the LATEST event, process once per frame.
    let pending: PointerEvent | null = null;
    let frame = 0;
    const schedule =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16);
    const cancel =
      typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    const processPending = () => {
      frame = 0;
      const event = pending;
      pending = null;
      if (event) applyMove(event);
    };

    const onMove = (e: PointerEvent) => {
      pending = e;
      if (!frame) frame = schedule(processPending) as unknown as number;
    };

    /** Settle a finished gesture's geometry onto the grid — the one and only
     *  moment snapping happens. */
    const snapOnRelease = () => {
      const drag = shapeDragRef.current;
      const resize = resizeRef.current;
      const vertex = wallVertexRef.current;
      const outlineVertex = outlineDragRef.current;
      if (!drag?.moved && !resize && !vertex && outlineVertex === null) return;

      editDrawingRef.current((current) => ({
        ...current,
        shapes: current.shapes.map((shape) => {
          if (drag?.moved && shape.id === drag.shapeId) {
            // Align by the shape's anchor; walls translate as a unit so the
            // run keeps its exact drawn form.
            if (shape.kind === 'wall' || shape.kind === 'outline') {
              const ddx = snapValue(shape.points[0]) - shape.points[0];
              const ddy = snapValue(shape.points[1]) - shape.points[1];
              return translateShape(shape, ddx, ddy);
            }
            if ('x' in shape && 'y' in shape) {
              return { ...shape, x: snapValue(shape.x), y: snapValue(shape.y) };
            }
          }
          if (resize && shape.id === resize.shapeId && isBoxShape(shape)) {
            const x1 = snapValue(shape.x);
            const y1 = snapValue(shape.y);
            const x2 = snapValue(shape.x + shape.width);
            const y2 = snapValue(shape.y + shape.height);
            return {
              ...shape,
              x: x1,
              y: y1,
              width: Math.max(x2 - x1, SNAP),
              height: Math.max(y2 - y1, SNAP),
            };
          }
          if (vertex && shape.id === vertex.shapeId && shape.kind === 'wall') {
            const points = [...shape.points];
            points[vertex.vertexIndex * 2] = snapValue(points[vertex.vertexIndex * 2]);
            points[vertex.vertexIndex * 2 + 1] = snapValue(points[vertex.vertexIndex * 2 + 1]);
            return { ...shape, points };
          }
          if (outlineVertex !== null && shape.kind === 'outline') {
            const points = [...shape.points];
            points[outlineVertex * 2] = snapValue(points[outlineVertex * 2]);
            points[outlineVertex * 2 + 1] = snapValue(points[outlineVertex * 2 + 1]);
            return { ...shape, points };
          }
          return shape;
        }),
      }), { history: false });
    };

    const onUp = (e: PointerEvent) => {
      // The final move must land before the gesture closes — regardless of
      // whether the browser gave us another frame.
      if (pending) {
        if (frame) cancel(frame);
        processPending();
      }

      snapOnRelease();

      shapeDragRef.current = null;
      resizeRef.current = null;
      wallVertexRef.current = null;
      if (outlineDragRef.current !== null) {
        outlineDragRef.current = null;
        void normalizeOutlineReleaseRef.current();
      }

      if (canvasResizeRef.current) {
        canvasResizeRef.current = null;
        const draft = canvasDraftLiveRef.current;
        const floorId = editorRef.current.activeFloorId;
        if (draft && floorId) {
          // The size settles onto the grid here, not during the drag.
          void handleUpdateFloorRef
            .current(floorId, {
              width: Math.min(Math.max(snapValue(draft.width), 100), 20000),
              height: Math.min(Math.max(snapValue(draft.height), 100), 20000),
            })
            .finally(() => applyCanvasDraftRef.current(null));
        } else {
          applyCanvasDraftRef.current(null);
        }
      }

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
      if (frame) cancel(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [applyCanvasDraftRef, canvasDraftLiveRef, canvasResizeRef, createDefaultEdgeRef, edgeDragRef, editorRef, graphRef, handleUpdateFloorRef, normalizeOutlineReleaseRef, outlineDragRef, setBoxDraft, setEdgeDrag, setWallCursor, svgRef]);

  // Releasing the rubber band is what creates the room or shop. Bound
  // separately from the drag listeners above because it needs the tool and the
  // draft together, and re-binding on every draft change would be wasteful in
  // the (much hotter) move handler.
  useEffect(() => {
    if (!boxDraft) return;

    const commit = () => {
      const free = rectFromPoints(boxDraft.start, boxDraft.current);
      setBoxDraft(null);
      // A click that never moved is not a box — treat it as a mis-click rather
      // than dropping an invisible sliver onto the plan.
      if (free.width < MIN_BOX_SIZE || free.height < MIN_BOX_SIZE) return;
      // The rubber band moves freely; the box settles onto the grid once.
      const snapValue = (v: number) => Math.round(v / SNAP_STEP) * SNAP_STEP;
      const x1 = snapValue(free.x);
      const y1 = snapValue(free.y);
      const rect = {
        x: x1,
        y: y1,
        width: Math.max(snapValue(free.x + free.width) - x1, SNAP_STEP),
        height: Math.max(snapValue(free.y + free.height) - y1, SNAP_STEP),
      };

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
  }, [addShape, boxDraft, dispatch, setBoxDraft, setInspectorOpen]);

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
    [dispatch, editorRef, setInspectorOpen, setPoiExpanded],
  );

  return {
    camera,
    svgRef,
    controls,
    isDragging,
    svgHandlers,
    handleNodePointerDown,
    handleShapePointerDown,
    handleWallVertexPointerDown,
    handleResizePointerDown,
    handleNodeClick,
  };
};
