/* eslint-disable react-hooks/refs --
   Refs here mirror the latest state and callbacks during render on purpose:
   window listeners, timers and the reducer's intent handler read them
   imperatively and must never act on a stale value. This is the pattern the
   editor was built on before it was split into hooks; moving the writes into
   effects would change when those handlers observe an update. */
import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { MapPoint, NodeType } from '../../../components/map';
import { EmptyState, Skeleton } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/Button';
import { PageHeader, PageShell } from '../../../components/ui/Layout';
import { Sheet } from '../../../components/ui/Sheet';
import { useToast } from '../../../components/ui/toastContext';
import { AlertTriangleIcon, LayersIcon, RefreshIcon } from '../../../components/ui/Icons';
import SimpleQRCodeDisplay from '../../../components/qr/SimpleQRCodeDisplay';
import { useI18n } from '../../../i18n/LanguageProvider';
import type {
  Closure,
  EditorGraph,
  EditorNode,
  ValidationReport,
} from '../../../apis/mapEditorApi';
import {
  hasPendingGesture,
  initialEditorState,
  type EditorAction,
} from './editorReducer';
import { EdgeFormModal } from './EdgeFormModal';
import { FloorsPanel } from './FloorsPanel';
import { NodeInspector } from './NodeInspector';
import { ShapeInspector } from './ShapeInspector';
import { EdgeInspector } from './EdgeInspector';
import type { EditorOp } from './useEditorCollab';
import { EditorAiPanel } from './EditorAiPanel';
import { AgentChatPanel } from '../../../components/ai/AgentChatPanel';
import { LinkFloorsDialog } from './LinkFloorsDialog';
import { ValidationPanel } from './ValidationPanel';
import { ClosuresPanel } from './ClosuresPanel';
import { EMPTY_GRAPH, type EditorMode } from './editorConstants';
import { toLegacyNode } from './editorHelpers';
import { useIsDesktop } from './useIsDesktop';
import { FloorSwitcherStrip, FullscreenEditor } from './EditorChrome';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { useGraphMutations } from './useGraphMutations';
import { useEditorDrawing } from './useEditorDrawing';
import { useEditorDispatch } from './useEditorDispatch';
import { useEditorData } from './useEditorData';
import { useEditorDerived } from './useEditorDerived';
import { useEditorPointer } from './useEditorPointer';
import { useEditorKeyboard } from './useEditorKeyboard';
import { useEditorActions } from './useEditorActions';
import type { UpdateFloorFn } from './editorTypes';

/* ============================================================================
   Map editor page (F3).
   ----------------------------------------------------------------------------
   Loads the building graph once and keeps it in local state; every mutation
   goes out, and only the row the server hands back is merged in. There is no
   optimistic "assume it worked" path for anything structural — this graph is
   what evacuation routing runs on, so the client never invents a node id.

   Interaction lives in editorReducer.ts (pure). This file owns exactly the
   things a reducer must not: fetches, timers, toasts and the camera.

   Split by concern: constants and pure helpers (editorConstants,
   editorHelpers), one hook per slice of behaviour (useGraphMutations,
   useEditorDrawing, useEditorDispatch, useEditorData, useEditorDerived,
   useEditorPointer, useEditorKeyboard, useEditorActions) and the
   presentational pieces (editorToolbar, editorCanvas, editorChrome,
   editorOverlays). This file owns the shared state and wires them together;
   hooks are called in the original declaration order so effects still
   register in the same sequence.
   ========================================================================= */

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

  // Closures. `closureDraft` is null when nobody is picking edges and an array
  // (possibly empty) while the draft is open — the distinction is what arms
  // edge-tap-to-toggle and what Escape cancels.
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(true);
  const [closureDraft, setClosureDraft] = useState<string[] | null>(null);

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

  // AI design assistant drawer.
  const [aiOpen, setAiOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  // Link-floors dialog: the primary flow for cross-floor links. The map-tap
  // gesture still works underneath for people who prefer pointing.
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);


  /*
   * Three modes, one at a time: draw (the plan), nodes (the routing graph),
   * floor (the canvas itself — drag its borders to resize the room).
   *
   * Draw and nodes used to be armed at once, which meant a stray click while
   * sketching a shop could drop a routing node onto the plan — invisible work
   * that then shows up as an orphan in validation days later.
   */
  const [editorMode, setEditorMode] = useState<EditorMode>('draw');
  const nodesMode = editorMode === 'nodes';
  const floorMode = editorMode === 'floor';
  const editorModeRef = useRef(editorMode);
  editorModeRef.current = editorMode;
  const setNodesMode = useCallback((on: boolean) => {
    setEditorMode(on ? 'nodes' : 'draw');
  }, []);

  // Refs mirror state for the imperative paths (window listeners, timers, the
  // intent handler) so none of them can act on a stale graph.
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const placeTypeRef = useRef(placeType);
  placeTypeRef.current = placeType;
  const closureDraftRef = useRef(closureDraft);
  closureDraftRef.current = closureDraft;

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

  // Forward refs: filled in by useEditorActions further down, read by earlier
  // handlers (outline release, pointer release, keyboard) at event time.
  const handleUpdateFloorRef = useRef<UpdateFloorFn>(async () => false);
  const deleteEdgeByIdRef = useRef<(edgeId: string) => Promise<void>>(async () => {});

  const {
    mutate,
    createDefaultEdgeRef,
    createTransitLinkFromDialog,
    autoConnect,
    setAutoConnect,
    autoConnectRef,
    autoConnecting,
    runAutoConnect,
    runAutoConnectRef,
  } = useGraphMutations({
    buildingId,
    t,
    toast,
    setPending,
    setSavedAt,
    setGraph,
    setLinkDialogOpen,
    setLinkSubmitting,
    editorRef,
    sendOpRef,
  });

  const {
    canvasDraft,
    canvasResizeRef,
    canvasDraftLiveRef,
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
  } = useEditorDrawing({
    buildingId,
    mutate,
    setGraph,
    graphRef,
    editorRef,
    sendOpRef,
    dispatchRef,
    handleUpdateFloorRef,
  });

  const { handleIntentRef, dispatch, collab, removeShape } = useEditorDispatch({
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
  });

  const { runValidation } = useEditorData({
    buildingId,
    toast,
    dispatch,
    setGraph,
    setLoading,
    setLoadError,
    setBuildingName,
    setClosures,
    setClosuresLoading,
    setReport,
    setValidating,
  });

  const {
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
  } = useEditorDerived({
    graph,
    editor,
    canvasDraft,
    closureDraft,
    historyRef,
    historyVersion,
  });

  const {
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
  } = useEditorPointer({
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
  });

  useEditorKeyboard({
    dispatch,
    removeShape,
    setNodesMode,
    setClosureDraft,
    setBoxDraft,
    setWallCursor,
    setFullscreen,
    editorRef,
    editorModeRef,
    closureDraftRef,
    applyHistoryRef,
    deleteEdgeByIdRef,
    handleIntentRef,
  });

  const {
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
  } = useEditorActions({
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
  });

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
      onShowQr={() => {
        const nodeId = 'nodeId' in selectedShape ? selectedShape.nodeId : undefined;
        const node = nodeId ? graph.nodes.find((n) => n.id === nodeId) : undefined;
        if (node) setQrNode(node);
      }}
    />
  ) : selectedEdge ? (
    <EdgeInspector
      key={selectedEdge.id}
      edge={selectedEdge}
      source={graph.nodes.find((n) => n.id === selectedEdge.sourceNodeId) ?? null}
      target={graph.nodes.find((n) => n.id === selectedEdge.targetNodeId) ?? null}
      onSave={handleSaveEdge}
      onDelete={handleDeleteEdge}
      closureDraftActive={closureDraft !== null}
      inClosureDraft={closureDraft?.includes(selectedEdge.id) ?? false}
      onAddToClosure={() => toggleClosureEdge(selectedEdge.id)}
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

  const toolbar = (
    <EditorToolbar
      t={t}
      editor={editor}
      graph={graph}
      collab={collab}
      controls={controls}
      dispatch={dispatch}
      editorMode={editorMode}
      setEditorMode={setEditorMode}
      nodesMode={nodesMode}
      floorMode={floorMode}
      drawing={drawing}
      pendingGesture={pendingGesture}
      placeType={placeType}
      setPlaceType={setPlaceType}
      autoConnect={autoConnect}
      setAutoConnect={setAutoConnect}
      autoConnecting={autoConnecting}
      runAutoConnect={runAutoConnect}
      setLinkDialogOpen={setLinkDialogOpen}
      setWallCursor={setWallCursor}
      setAiOpen={setAiOpen}
      setAuditOpen={setAuditOpen}
      canUndo={canUndo}
      canRedo={canRedo}
      applyHistory={applyHistory}
      saveLabel={saveLabel}
      pending={pending}
      fullscreen={fullscreen}
      setFullscreen={setFullscreen}
    />
  );

  /** The map itself. `className` sizes it, which is the only thing the two
   *  layouts disagree about. */
  const renderCanvas = (className: string) => (
    <EditorCanvas
      className={className}
      t={t}
      editor={editor}
      graph={graph}
      collab={collab}
      space={space}
      camera={camera}
      svgRef={svgRef}
      svgHandlers={svgHandlers}
      isDragging={isDragging}
      activeFloor={activeFloor}
      activeDrawing={activeDrawing}
      nodesMode={nodesMode}
      floorMode={floorMode}
      boxDraft={boxDraft}
      wallCursor={wallCursor}
      edgeDrag={edgeDrag}
      nodesById={nodesById}
      visibleNodes={visibleNodes}
      visiblePois={visiblePois}
      selectedPoi={selectedPoi}
      closureDraft={closureDraft}
      closureDraftSet={closureDraftSet}
      handleShapeClick={handleShapeClick}
      handleEdgeClick={handleEdgeClick}
      handleShapePointerDown={handleShapePointerDown}
      handleResizePointerDown={handleResizePointerDown}
      handleWallVertexPointerDown={handleWallVertexPointerDown}
      handleNodeClick={handleNodeClick}
      handleNodePointerDown={handleNodePointerDown}
      beginOutlineVertexDrag={beginOutlineVertexDrag}
      beginOutlineMidpointDrag={beginOutlineMidpointDrag}
      removeOutlineVertex={removeOutlineVertex}
      beginCanvasResize={beginCanvasResize}
    />
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

            <ClosuresPanel
              closures={closures}
              loading={closuresLoading}
              draftEdgeIds={closureDraft}
              edgeOptions={closureEdgeOptions}
              // The same call a map tap makes, so the two pickers are one
              // picker with two front doors.
              onToggleEdge={toggleClosureEdge}
              onStartDraft={() => {
                // Picking happens on the routing graph, which only renders in
                // Nodes mode — arming the draft in Draw mode would show a hint
                // pointing at connections nobody can see.
                setNodesMode(true);
                setClosureDraft([]);
              }}
              onCancelDraft={() => setClosureDraft(null)}
              onCreate={handleCreateClosure}
              onDelete={handleDeleteClosure}
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

      <LinkFloorsDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        nodes={graph.nodes}
        floors={graph.floors}
        activeFloorId={editor.activeFloorId}
        submitting={linkSubmitting}
        onCreate={createTransitLinkFromDialog}
      />

      <AgentChatPanel
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        agentId="auditor"
        namespace="auditAi"
        buildingId={buildingId}
        knownActions={['auto_connect_floor']}
        onFallbackAction={() => void runValidation()}
        onRunAction={(action) => {
          if (action.name !== 'auto_connect_floor') return;
          const floorId = typeof action.args.floorId === 'string' ? action.args.floorId : null;
          if (!floorId) return;
          // The auditor names a floor; auto-connect always runs on the active
          // one, so switch first. Both go through the editor's normal paths,
          // which means one Ctrl+Z still undoes it.
          dispatch({ type: 'SET_FLOOR', floorId });
          setNodesMode(true);
          void runAutoConnectRef.current();
          toast({ title: t('auditAi.actionDone'), tone: 'success' });
        }}
      />

      <EditorAiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        buildingId={buildingId}
        floorId={editor.activeFloorId}
        space={space}
        drawing={activeDrawing}
        onRunAction={(action) => {
          if (action === 'auto-connect') {
            setNodesMode(true);
            void runAutoConnectRef.current();
          }
        }}
        onAttachImage={async (file) => {
          const floorId = editorRef.current.activeFloorId;
          if (!floorId) return false;
          // Through the same floor PATCH as the panel upload: the image lands
          // as the plan underlay, ready to trace over or design around.
          return handleUpdateFloorRef.current(floorId, { map: file });
        }}
        onApplyDrawing={(generated) => {
          // Through the normal edit path: history snapshot (undo works),
          // debounced save, live relay to collaborators.
          editDrawing(() => generated);
          toast({ title: t('editorAi.applied'), tone: 'success' });
        }}
      />

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

export default MapEditorPage;
