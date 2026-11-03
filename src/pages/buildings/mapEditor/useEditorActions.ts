/* eslint-disable react-hooks/refs --
   Refs here mirror the latest state and callbacks during render on purpose:
   window listeners, timers and the reducer's intent handler read them
   imperatively and must never act on a stale value. This is the pattern the
   editor was built on before it was split into hooks; moving the writes into
   effects would change when those handlers observe an update. */
import { useCallback, type MutableRefObject } from 'react';
import {
  ICON_NODE_TYPE,
  shapeCenter,
  type DrawingShape,
  type MapCameraControls,
  type NodeType,
} from '../../../components/map';
import {
  createClosure,
  createEdge,
  createFloor,
  createNode,
  createTransitLink,
  deleteClosure,
  deleteEdge,
  deleteFloor,
  deleteNode,
  deletePoi,
  savePoi,
  updateEdge,
  updateFloor,
  updateNode,
  uploadShopLogo,
  type Closure,
  type EditorEdge,
  type EditorGraph,
  type EditorNode,
  type FloorInput,
  type UpdateEdgeInput,
} from '../../../apis/mapEditorApi';
import type { EditorAction, EditorState } from './editorReducer';
import type { EdgeFormValues } from './EdgeFormModal';
import type { PoiFormValues } from './NodeInspector';
import type { ClosureDraftInput } from './ClosuresPanel';
import { ICON_KIND_KEYS } from './labels';
import type { EditorOp } from './useEditorCollab';
import { byFloorNumber } from './editorHelpers';
import type {
  EdgeDraft,
  Mutate,
  Setter,
  ToastFn,
  Translate,
  UpdateFloorFn,
} from './editorTypes';

interface UseEditorActionsOptions {
  buildingId: string;
  t: Translate;
  toast: ToastFn;
  mutate: Mutate;
  dispatch: (action: EditorAction) => void;
  controls: MapCameraControls;
  edgeDraft: EdgeDraft | null;
  selectedNode: EditorNode | null;
  selectedEdge: EditorEdge | null;
  removeShape: (shapeId: string) => void;
  patchShape: (shapeId: string, patch: Partial<DrawingShape>) => void;
  setNodesMode: (on: boolean) => void;
  setGraph: Setter<EditorGraph>;
  setEdgeDraft: Setter<EdgeDraft | null>;
  setInspectorOpen: Setter<boolean>;
  setClosures: Setter<Closure[]>;
  setClosureDraft: Setter<string[] | null>;
  graphRef: MutableRefObject<EditorGraph>;
  editorRef: MutableRefObject<EditorState>;
  closureDraftRef: MutableRefObject<string[] | null>;
  sendOpRef: MutableRefObject<(op: EditorOp) => void>;
  handleUpdateFloorRef: MutableRefObject<UpdateFloorFn>;
  deleteEdgeByIdRef: MutableRefObject<(edgeId: string) => Promise<void>>;
}

/**
 * Handlers behind the panels and inspectors: edge/transit commit, floors,
 * node / POI / edge / shape actions, closures and focus-from-validation.
 */
export const useEditorActions = ({
  buildingId,
  t,
  toast,
  mutate,
  dispatch,
  controls,
  edgeDraft,
  selectedNode,
  selectedEdge,
  removeShape,
  patchShape,
  setNodesMode,
  setGraph,
  setEdgeDraft,
  setInspectorOpen,
  setClosures,
  setClosureDraft,
  graphRef,
  editorRef,
  closureDraftRef,
  sendOpRef,
  handleUpdateFloorRef,
  deleteEdgeByIdRef,
}: UseEditorActionsOptions) => {
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
    [buildingId, edgeDraft, mutate, sendOpRef, setEdgeDraft, setGraph, t, toast],
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
    [buildingId, dispatch, mutate, sendOpRef, setGraph, t, toast],
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
    [mutate, sendOpRef, setGraph, t, toast],
  );
  handleUpdateFloorRef.current = handleUpdateFloor;

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
    [dispatch, editorRef, graphRef, mutate, sendOpRef, setGraph, t, toast],
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
    [buildingId, mutate, selectedNode, sendOpRef, setGraph, t, toast],
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
  }, [dispatch, mutate, selectedNode, sendOpRef, setGraph, setInspectorOpen, t, toast]);

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
          externalId: values.externalId || null,
          // `aliases` is forwarded ONLY when the inspector says the chips were
          // edited — the server replaces the whole `names` column whenever the
          // key is present, so an untouched field must send nothing at all.
          // When it IS sent, the loaded en/ka ride along so the rewrite cannot
          // drop translations another client set.
          ...(values.aliases !== undefined
            ? {
                aliases: values.aliases,
                nameEn: values.nameEn,
                nameKa: values.nameKa,
              }
            : {}),
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
    [buildingId, mutate, selectedNode, sendOpRef, setGraph, t, toast],
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
  }, [mutate, selectedNode, sendOpRef, setGraph, t, toast]);

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
    [dispatch, editorRef, mutate, sendOpRef, setGraph],
  );

  deleteEdgeByIdRef.current = deleteEdgeById;

  /** Add or remove one edge from the open closure draft. */
  const toggleClosureEdge = useCallback((edgeId: string) => {
    setClosureDraft((current) => {
      if (current === null) return current;
      return current.includes(edgeId)
        ? current.filter((id) => id !== edgeId)
        : [...current, edgeId];
    });
  }, [setClosureDraft]);

  const handleEdgeClick = useCallback(
    (edge: { id: string }) => {
      // A closure draft owns the map while it is open: a tap picks or unpicks
      // the connection instead of selecting or erasing it. Otherwise the
      // eraser would silently delete the edge someone meant to close.
      if (closureDraftRef.current !== null) {
        toggleClosureEdge(edge.id);
        dispatch({ type: 'SELECT_EDGE', edgeId: edge.id });
        return;
      }

      const tool = editorRef.current.tool;
      if (tool === 'erase') {
        void deleteEdgeById(edge.id);
        return;
      }
      if (tool !== 'select') return;
      dispatch({ type: 'SELECT_EDGE', edgeId: edge.id });
      setInspectorOpen(true);
    },
    [closureDraftRef, deleteEdgeById, dispatch, editorRef, setInspectorOpen, toggleClosureEdge],
  );

  const handleSaveEdge = useCallback(
    async (patch: Omit<UpdateEdgeInput, 'buildingId'>) => {
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
    [buildingId, mutate, selectedEdge, sendOpRef, setGraph, t, toast],
  );

  const handleDeleteEdge = useCallback(async () => {
    if (!selectedEdge) return;
    await deleteEdgeById(selectedEdge.id);
    setInspectorOpen(false);
    toast({ title: t('mapEditor.saved'), tone: 'success' });
  }, [deleteEdgeById, selectedEdge, setInspectorOpen, t, toast]);

  /* --- closures ----------------------------------------------------------- */

  const handleCreateClosure = useCallback(
    async (input: ClosureDraftInput): Promise<boolean> => {
      const edgeIds = closureDraftRef.current;
      if (!edgeIds || edgeIds.length === 0) return false;
      const created = await mutate(() =>
        createClosure(buildingId, {
          edgeIds,
          reason: input.reason,
          endsAt: input.endsAt,
          // Passed through verbatim: `null` here is the BLOCKED sentinel the
          // panel made the operator choose, never a default this layer invents.
          costMultiplier: input.costMultiplier,
        }),
      );
      // `mutate` swallows the error into a toast and hands back null. Saying
      // so out loud is what stops the panel from clearing a form whose save
      // never landed.
      if (!created) return false;
      setClosures((current) => [created, ...current]);
      setClosureDraft(null);
      toast({ title: t('mapEditor.closureSaved'), tone: 'success' });
      return true;
    },
    [buildingId, closureDraftRef, mutate, setClosureDraft, setClosures, t, toast],
  );

  const handleDeleteClosure = useCallback(
    async (closureId: string) => {
      const done = await mutate(async () => {
        await deleteClosure(buildingId, closureId);
        return true;
      });
      if (!done) return;
      setClosures((current) => current.filter((c) => c.id !== closureId));
      toast({ title: t('mapEditor.saved'), tone: 'success' });
    },
    [buildingId, mutate, setClosures, t, toast],
  );

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
    [dispatch, editorRef, removeShape, setInspectorOpen],
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
    [buildingId, editorRef, mutate, patchShape, sendOpRef, setGraph, t, toast],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Validation issues are about the graph; focusing one from Draw mode
      // must flip to Nodes mode or the highlighted node would be invisible.
      setNodesMode(true);
      if (node.floorId !== editorRef.current.activeFloorId) {
        dispatch({ type: 'SET_FLOOR', floorId: node.floorId });
      }
      dispatch({ type: 'SELECT_NODE', nodeId });
      controls.centerOn({ x: node.x, y: node.y });
      setInspectorOpen(true);
    },
    [controls, dispatch, editorRef, graphRef, setInspectorOpen, setNodesMode],
  );

  return {
    submitEdge,
    handleCreateFloor,
    handleUpdateFloor,
    handleDeleteFloor,
    handleSaveNode,
    handleDeleteNode,
    handleSavePoi,
    handleRemovePoi,
    toggleClosureEdge,
    handleEdgeClick,
    handleSaveEdge,
    handleDeleteEdge,
    handleCreateClosure,
    handleDeleteClosure,
    handleShapeClick,
    handleUploadLogo,
    handleCreateNodeForShape,
    focusNode,
  };
};
