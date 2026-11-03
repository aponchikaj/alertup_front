import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type { TransitType } from '../../../components/map';
import { errorMessage } from '../../../apis/http';
import {
  autoConnectFloor,
  createEdge,
  createTransitLink,
  type EditorEdge,
  type EditorGraph,
} from '../../../apis/mapEditorApi';
import type { EditorState } from './editorReducer';
import type { EditorOp } from './useEditorCollab';
import type { Setter, ToastFn, Translate } from './editorTypes';

interface UseGraphMutationsOptions {
  buildingId: string;
  t: Translate;
  toast: ToastFn;
  setPending: Setter<number>;
  setSavedAt: Setter<number | null>;
  setGraph: Setter<EditorGraph>;
  setLinkDialogOpen: Setter<boolean>;
  setLinkSubmitting: Setter<boolean>;
  editorRef: MutableRefObject<EditorState>;
  sendOpRef: MutableRefObject<(op: EditorOp) => void>;
}

/**
 * The server-authoritative graph writes: the shared `mutate` wrapper (pending
 * counter, saved stamp, error toast), default connections, the link-floors
 * dialog submit, and floor-wide auto-connect.
 */
export const useGraphMutations = ({
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
}: UseGraphMutationsOptions) => {
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
    [setPending, setSavedAt, toast],
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
    [buildingId, mutate, sendOpRef, setGraph],
  );

  const createDefaultEdgeRef = useRef(createDefaultEdge);
  createDefaultEdgeRef.current = createDefaultEdge;
  const createTransitLinkFromDialog = useCallback(
    async (input: { sourceNodeId: string; targetNodeId: string; transitType: TransitType }) => {
      setLinkSubmitting(true);
      try {
        const created = await mutate(() =>
          createTransitLink({
            nodeIds: [input.sourceNodeId, input.targetNodeId],
            transitType: input.transitType,
            buildingId,
          }),
        );
        if (!created) return;
        setGraph((g) => ({ ...g, edges: [...g.edges, created] }));
        sendOpRef.current({ kind: 'edge:upsert', edge: created });
        setLinkDialogOpen(false);
        toast({ title: t('mapEditor.saved'), tone: 'success' });
      } finally {
        setLinkSubmitting(false);
      }
    },
    [buildingId, mutate, sendOpRef, setGraph, setLinkDialogOpen, setLinkSubmitting, t, toast],
  );

  /** Auto-connect toggle (place-node tool). On by default: a node nobody
   *  connects is an orphan the validator flags later anyway. */
  const [autoConnect, setAutoConnect] = useState(true);
  const autoConnectRef = useRef(autoConnect);
  autoConnectRef.current = autoConnect;

  /** One-click floor-wide wiring. Also exposed to the AI as an action. */
  const [autoConnecting, setAutoConnecting] = useState(false);
  const runAutoConnect = useCallback(async () => {
    const floorId = editorRef.current.activeFloorId;
    if (!floorId || autoConnecting) return;
    setAutoConnecting(true);
    try {
      const created = await mutate(() => autoConnectFloor(floorId));
      if (!created) return;
      if (created.length === 0) {
        toast({ title: t('mapEditor.autoConnectNone'), tone: 'info' });
        return;
      }
      setGraph((g) => ({ ...g, edges: [...g.edges, ...created] }));
      for (const edge of created) {
        sendOpRef.current({ kind: 'edge:upsert', edge });
      }
      toast({
        title: t('mapEditor.autoConnectDone', { count: created.length }),
        tone: 'success',
      });
    } finally {
      setAutoConnecting(false);
    }
  }, [autoConnecting, editorRef, mutate, sendOpRef, setGraph, t, toast]);
  const runAutoConnectRef = useRef(runAutoConnect);
  runAutoConnectRef.current = runAutoConnect;

  return {
    mutate,
    createDefaultEdgeRef,
    createTransitLinkFromDialog,
    autoConnect,
    setAutoConnect,
    autoConnectRef,
    autoConnecting,
    runAutoConnect,
    runAutoConnectRef,
  };
};
