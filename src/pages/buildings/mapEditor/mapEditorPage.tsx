import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  EdgeLayer,
  FloorImageLayer,
  MapCanvas,
  NodeLayer,
  PoiLayer,
  screenToMap,
  useMapCamera,
  type FloorSpace,
  type MapNode,
  type MapPoint,
  type NodeType,
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
  PlusIcon,
  RefreshIcon,
  RouteIcon,
  ScanIcon,
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
  createNode,
  createTransitLink,
  deleteFloor,
  deleteNode,
  deletePoi,
  getBuildingGraph,
  savePoi,
  updateFloor,
  updateNode,
  validateBuilding,
  type EditorGraph,
  type EditorNode,
  type FloorInput,
  type ValidationReport,
} from '../../../apis/mapEditorApi';
import {
  editorReducer,
  hasPendingGesture,
  initialEditorState,
  type EditorAction,
  type EditorIntent,
  type EditorTool,
} from './editorReducer';
import { EdgeFormModal, type EdgeFormValues } from './edgeFormModal';
import { FloorsPanel } from './floorsPanel';
import { NodeInspector, type PoiFormValues } from './nodeInspector';
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

const DESKTOP_QUERY = '(min-width: 64rem)';

const TOOLS: { tool: EditorTool; labelKey: string; Icon: typeof MapIcon }[] = [
  { tool: 'select', labelKey: 'mapEditor.toolSelect', Icon: ScanIcon },
  { tool: 'pan', labelKey: 'mapEditor.toolPan', Icon: MapIcon },
  { tool: 'place-node', labelKey: 'mapEditor.toolPlaceNode', Icon: PlusIcon },
  { tool: 'draw-edge', labelKey: 'mapEditor.toolDrawEdge', Icon: RouteIcon },
  { tool: 'assign-poi', labelKey: 'mapEditor.toolAssignPoi', Icon: MapPinIcon },
  { tool: 'link-transit', labelKey: 'mapEditor.toolLinkTransit', Icon: LayersIcon },
  { tool: 'mark-exit', labelKey: 'mapEditor.toolMarkExit', Icon: ExitDoorIcon },
];

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

  // Refs mirror state for the imperative paths (window listeners, timers, the
  // intent handler) so none of them can act on a stale graph.
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const placeTypeRef = useRef(placeType);
  placeTypeRef.current = placeType;

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
          if (node) setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
          return;
        }

        case 'commit-edge':
          setEdgeDraft({ kind: 'edge', ...intent });
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
          }
          return;
        }
      }
    },
    [buildingId, mutate, t, toast],
  );

  const handleIntentRef = useRef(handleIntent);
  handleIntentRef.current = handleIntent;

  const dispatch = useCallback((action: EditorAction) => {
    const { state, intent } = editorReducer(editorRef.current, action);
    editorRef.current = state;
    setEditor(state);
    if (intent) void handleIntentRef.current(intent);
  }, []);

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

  /* --- camera ------------------------------------------------------------ */

  const suppressTapRef = useRef(false);

  const handleMapTap = useCallback(
    (point: MapPoint) => {
      if (suppressTapRef.current) {
        suppressTapRef.current = false;
        return;
      }
      dispatch({
        type: 'MAP_CLICKED',
        x: Math.round(point.x),
        y: Math.round(point.y),
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

  // A press that starts on a marker is a node interaction, not a map tap.
  // Deciding it here (rather than in the node handler) sidesteps the
  // target-before-ancestor ordering of bubbling pointer events.
  const svgHandlers = useMemo(
    () => ({
      ...handlers,
      onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
        const target = e.target as Element | null;
        suppressTapRef.current = Boolean(
          target?.closest?.('[data-node-id],[data-poi-id]'),
        );
        handlers.onPointerDown(e);
      },
    }),
    [handlers],
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
      if (editorRef.current.tool !== 'select') return;
      // Stop the camera seeing this press, or dragging a node would pan the
      // floor out from under it.
      e.stopPropagation();
      dragRef.current = { nodeId: node.id, moved: false };
    },
    [],
  );

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
      if (e.key === 'Escape') dispatch({ type: 'CANCEL' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

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
    toast({ title: t('mapEditor.saved'), tone: 'success' });
  }, [mutate, selectedNode, t, toast]);

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

  const inspector = selectedNode ? (
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

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={buildingName || t('mapEditor.title')}
          description={buildingName ? t('mapEditor.title') : undefined}
          actions={
            saveLabel ? (
              <Badge tone={pending > 0 ? 'info' : 'success'} aria-live="polite">
                {saveLabel}
              </Badge>
            ) : undefined
          }
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          <div
            role="toolbar"
            aria-label={t('mapEditor.tools')}
            className="flex flex-wrap gap-2"
          >
            {TOOLS.map(({ tool, labelKey, Icon }) => {
              const active = editor.tool === tool;
              return (
                <button
                  key={tool}
                  type="button"
                  aria-pressed={active}
                  onClick={() => dispatch({ type: 'SET_TOOL', tool })}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium',
                    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active
                      ? 'border-line-strong bg-surface-2 text-ink'
                      : 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <Icon size={16} />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editor.tool === 'place-node' && (
              <Select
                aria-label={t('mapEditor.nodeType')}
                className="w-56"
                value={placeType}
                onChange={(e) => setPlaceType(e.target.value as NodeType)}
                options={(Object.keys(NODE_TYPE_KEYS) as NodeType[]).map((value) => ({
                  value,
                  label: t(NODE_TYPE_KEYS[value]),
                }))}
              />
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
          </div>

          {pendingGesture && (
            <Alert tone="info">
              {editor.transitLinkSourceId
                ? `${t('mapEditor.pickTransitTarget')} ${t('mapEditor.cancelHint')}`
                : t('mapEditor.cancelHint')}
            </Alert>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-3">
            {graph.floors.length === 0 ? (
              <EmptyState
                icon={<LayersIcon size={24} />}
                title={t('mapEditor.floors')}
                description={t('mapEditor.noFloors')}
              />
            ) : (
              <MapCanvas
                space={space}
                camera={camera}
                handlers={svgHandlers}
                svgRef={svgRef}
                interactive
                isDragging={isDragging}
                ariaLabel={t('mapEditor.title')}
                className="h-[55vh] min-h-80 lg:h-[70vh]"
              >
                <FloorImageLayer
                  floor={activeFloor}
                  space={space}
                  placeholderLabel={t('mapEditor.uploadMap')}
                />
                <EdgeLayer
                  edges={graph.edges}
                  nodesById={nodesById}
                  inaccessibleLabel={t('mapEditor.edgeAccessible')}
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
              </MapCanvas>
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
