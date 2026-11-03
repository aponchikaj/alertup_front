/* eslint-disable react-hooks/refs --
   canUndo/canRedo read the undo history from its ref while rendering;
   historyVersion is the state that makes them re-derive (see below). */
import { useMemo, type MutableRefObject } from 'react';
import {
  EMPTY_DRAWING,
  type FloorDrawing,
  type FloorSpace,
  type MapNode,
} from '../../../components/map';
import type { EditorGraph } from '../../../apis/mapEditorApi';
import { isDrawTool, type EditorState } from './editorReducer';
import type { ClosureEdgeOption } from './ClosuresPanel';
import { endpointLabel } from './edgeLabels';
import { NO_EDGE_OPTIONS } from './editorConstants';
import type { CanvasSize } from './editorTypes';

interface UseEditorDerivedOptions {
  graph: EditorGraph;
  editor: EditorState;
  canvasDraft: CanvasSize | null;
  closureDraft: string[] | null;
  historyRef: MutableRefObject<Map<string, { past: FloorDrawing[]; future: FloorDrawing[] }>>;
  historyVersion: number;
}

/** Values derived from the graph and editor state for rendering. */
export const useEditorDerived = ({
  graph,
  editor,
  canvasDraft,
  closureDraft,
  historyRef,
  historyVersion,
}: UseEditorDerivedOptions) => {
  /* --- derived ----------------------------------------------------------- */

  const activeFloor = useMemo(
    () => graph.floors.find((floor) => floor.id === editor.activeFloorId) ?? null,
    [graph.floors, editor.activeFloorId],
  );

  const space = useMemo<FloorSpace>(
    () => ({
      width:
        canvasDraft?.width ??
        (activeFloor?.width && activeFloor.width > 0 ? activeFloor.width : 1000),
      height:
        canvasDraft?.height ??
        (activeFloor?.height && activeFloor.height > 0 ? activeFloor.height : 800),
    }),
    [activeFloor, canvasDraft],
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

  const closureDraftSet = useMemo(
    () => (closureDraft === null ? undefined : new Set(closureDraft)),
    [closureDraft],
  );

  /**
   * The active floor's connections, named, for the closures panel's keyboard
   * picker. Scoped by `nodesById` exactly as EdgeLayer is, so the list and the
   * drawing hold the same set — a cross-floor transit link has no endpoint to
   * draw here and equally has no row.
   *
   * Built only while a draft is open: on a dense floor this is a few hundred
   * string concatenations that nobody is looking at the rest of the time.
   */
  const closureDrafting = closureDraft !== null;
  const closureEdgeOptions = useMemo<ClosureEdgeOption[]>(() => {
    if (!closureDrafting) return NO_EDGE_OPTIONS;
    const rows: ClosureEdgeOption[] = [];
    for (const edge of graph.edges) {
      const source = nodesById.get(edge.sourceNodeId);
      const target = nodesById.get(edge.targetNodeId);
      if (!source || !target) continue;
      rows.push({
        id: edge.id,
        fromLabel: endpointLabel(source, edge.sourceNodeId),
        toLabel: endpointLabel(target, edge.targetNodeId),
      });
    }
    return rows;
    // Keyed on whether a draft is OPEN, never on its contents: rebuilding a
    // few hundred labels on every tick of a checkbox would be pure waste.
  }, [closureDrafting, graph.edges, nodesById]);

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
  }, [editor.activeFloorId, historyRef, historyVersion]);

  return {
    activeFloor,
    space,
    visibleNodes,
    nodesById,
    visiblePois,
    selectedNode,
    selectedPoi,
    selectedEdge,
    closureDraftSet,
    closureEdgeOptions,
    activeDrawing,
    selectedShape,
    selectedShapeNodeLinked,
    drawing,
    canUndo,
    canRedo,
  };
};
