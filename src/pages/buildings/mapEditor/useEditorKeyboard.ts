import { useEffect, type MutableRefObject } from 'react';
import type { MapPoint } from '../../../components/map';
import {
  hasPendingGesture,
  type EditorAction,
  type EditorIntent,
  type EditorState,
} from './editorReducer';
import { TOOL_SHORTCUTS, type EditorMode } from './editorConstants';
import type { BoxDraft, Setter } from './editorTypes';

interface UseEditorKeyboardOptions {
  dispatch: (action: EditorAction) => void;
  removeShape: (shapeId: string) => void;
  setNodesMode: (on: boolean) => void;
  setClosureDraft: Setter<string[] | null>;
  setBoxDraft: Setter<BoxDraft | null>;
  setWallCursor: Setter<MapPoint | null>;
  setFullscreen: Setter<boolean>;
  editorRef: MutableRefObject<EditorState>;
  editorModeRef: MutableRefObject<EditorMode>;
  closureDraftRef: MutableRefObject<string[] | null>;
  applyHistoryRef: MutableRefObject<(direction: 'undo' | 'redo') => void>;
  deleteEdgeByIdRef: MutableRefObject<(edgeId: string) => Promise<void>>;
  handleIntentRef: MutableRefObject<(intent: EditorIntent) => Promise<void>>;
}

/** Escape-to-cancel, undo/redo, Delete and single-key tool shortcuts. */
export const useEditorKeyboard = ({
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
}: UseEditorKeyboardOptions) => {
  /* --- Escape cancels ---------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // The closure draft is the outermost gesture: while it is open Escape
        // abandons it and stops, so a half-picked closure is never thrown away
        // together with the selection underneath it.
        if (closureDraftRef.current !== null) {
          setClosureDraft(null);
          return;
        }

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
        setNodesMode(shortcut.nodesMode ?? editorModeRef.current === 'nodes');
        dispatch({ type: 'SET_TOOL', tool: shortcut.tool });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyHistoryRef, closureDraftRef, deleteEdgeByIdRef, dispatch, editorModeRef, editorRef, handleIntentRef, removeShape, setBoxDraft, setClosureDraft, setFullscreen, setNodesMode, setWallCursor]);
};
