/* ============================================================================
   Map editor state machine — pure, no I/O.
   ----------------------------------------------------------------------------
   The reducer owns *what the user is doing* (active tool, selection, half-built
   edges) and nothing else. When an interaction implies a network call it does
   not perform it: it returns an `intent`, and the page performs the call. That
   split is what makes the two-click edge flow, the cross-floor transit flow and
   the Escape-cancels rule testable without mocking a single request.

     const { state, intent } = editorReducer(state, action);

   `intent` is `undefined` for the (many) actions that only move the cursor
   around. It is never a side effect in disguise — the same action against the
   same state always produces the same intent.
   ========================================================================= */

export type EditorTool =
  | 'select'
  | 'pan'
  | 'place-node'
  | 'draw-edge'
  | 'assign-poi'
  | 'link-transit'
  | 'mark-exit';

export interface EditorState {
  tool: EditorTool;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /** First endpoint of an edge being drawn on the active floor. */
  pendingEdgeSourceId: string | null;
  /** First endpoint of a cross-floor transit link; survives floor changes. */
  transitLinkSourceId: string | null;
  activeFloorId: string | null;
  hoveredNodeId: string | null;
}

/** What the page must go and do. The reducer never does it itself. */
export type EditorIntent =
  | { type: 'create-node'; x: number; y: number }
  | { type: 'commit-edge'; sourceNodeId: string; targetNodeId: string }
  | { type: 'commit-transit-link'; sourceNodeId: string; targetNodeId: string }
  | { type: 'edit-poi'; nodeId: string }
  | { type: 'toggle-exit'; nodeId: string };

export type EditorAction =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SET_FLOOR'; floorId: string | null }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SELECT_EDGE'; edgeId: string | null }
  | { type: 'HOVER_NODE'; nodeId: string | null }
  | { type: 'NODE_CLICKED'; nodeId: string; floorId: string | null }
  | { type: 'MAP_CLICKED'; x: number; y: number }
  | { type: 'NODE_REMOVED'; nodeId: string }
  | { type: 'CANCEL' };

export interface EditorResult {
  state: EditorState;
  intent?: EditorIntent;
}

export const initialEditorState: EditorState = {
  tool: 'select',
  selectedNodeId: null,
  selectedEdgeId: null,
  pendingEdgeSourceId: null,
  transitLinkSourceId: null,
  activeFloorId: null,
  hoveredNodeId: null,
};

/** True while a multi-click gesture is half-finished (drives the cancel hint). */
export const hasPendingGesture = (state: EditorState): boolean =>
  state.pendingEdgeSourceId !== null || state.transitLinkSourceId !== null;

const clearPending = (state: EditorState): EditorState => ({
  ...state,
  pendingEdgeSourceId: null,
  transitLinkSourceId: null,
});

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorResult {
  switch (action.type) {
    case 'SET_TOOL': {
      if (action.tool === state.tool) return { state };
      // Switching tools abandons any half-built edge or transit link: leaving
      // a dangling source id behind means the next click in the new tool
      // completes a gesture the user already walked away from.
      return {
        state: {
          ...clearPending(state),
          tool: action.tool,
          selectedEdgeId: null,
        },
      };
    }

    case 'SET_FLOOR': {
      if (action.floorId === state.activeFloorId) return { state };
      return {
        state: {
          ...state,
          activeFloorId: action.floorId,
          // Selection and a half-drawn edge both belong to the floor we just
          // left. A transit link deliberately does NOT reset — picking the
          // second endpoint on another floor is the whole point of the tool.
          selectedNodeId: null,
          selectedEdgeId: null,
          hoveredNodeId: null,
          pendingEdgeSourceId: null,
        },
      };
    }

    case 'SELECT_NODE':
      return {
        state: {
          ...state,
          selectedNodeId: action.nodeId,
          selectedEdgeId: null,
        },
      };

    case 'SELECT_EDGE':
      return {
        state: {
          ...state,
          selectedEdgeId: action.edgeId,
          selectedNodeId: null,
        },
      };

    case 'HOVER_NODE': {
      if (action.nodeId === state.hoveredNodeId) return { state };
      return { state: { ...state, hoveredNodeId: action.nodeId } };
    }

    case 'NODE_CLICKED': {
      const { nodeId } = action;

      switch (state.tool) {
        case 'pan':
          // The pan tool is deliberately inert: it exists so a touch user can
          // move the map without any chance of editing it.
          return { state };

        case 'draw-edge': {
          if (!state.pendingEdgeSourceId) {
            return {
              state: { ...state, pendingEdgeSourceId: nodeId, selectedNodeId: nodeId },
            };
          }
          if (state.pendingEdgeSourceId === nodeId) {
            // Clicking the source again un-picks it — a self-edge is never
            // what the user meant.
            return {
              state: { ...state, pendingEdgeSourceId: null, selectedNodeId: nodeId },
            };
          }
          return {
            state: {
              ...state,
              pendingEdgeSourceId: null,
              selectedNodeId: nodeId,
            },
            intent: {
              type: 'commit-edge',
              sourceNodeId: state.pendingEdgeSourceId,
              targetNodeId: nodeId,
            },
          };
        }

        case 'link-transit': {
          if (!state.transitLinkSourceId) {
            return {
              state: { ...state, transitLinkSourceId: nodeId, selectedNodeId: nodeId },
            };
          }
          if (state.transitLinkSourceId === nodeId) {
            return {
              state: { ...state, transitLinkSourceId: null, selectedNodeId: nodeId },
            };
          }
          return {
            state: {
              ...state,
              transitLinkSourceId: null,
              selectedNodeId: nodeId,
            },
            intent: {
              type: 'commit-transit-link',
              sourceNodeId: state.transitLinkSourceId,
              targetNodeId: nodeId,
            },
          };
        }

        case 'assign-poi':
          return {
            state: { ...state, selectedNodeId: nodeId, selectedEdgeId: null },
            intent: { type: 'edit-poi', nodeId },
          };

        case 'mark-exit':
          return {
            state: { ...state, selectedNodeId: nodeId, selectedEdgeId: null },
            intent: { type: 'toggle-exit', nodeId },
          };

        case 'select':
        case 'place-node':
        default:
          return {
            state: { ...state, selectedNodeId: nodeId, selectedEdgeId: null },
          };
      }
    }

    case 'MAP_CLICKED': {
      if (state.tool === 'place-node') {
        return {
          state,
          intent: { type: 'create-node', x: action.x, y: action.y },
        };
      }
      if (state.tool === 'select') {
        // Clicking empty map in the select tool is how you deselect.
        if (state.selectedNodeId === null && state.selectedEdgeId === null) {
          return { state };
        }
        return { state: { ...state, selectedNodeId: null, selectedEdgeId: null } };
      }
      return { state };
    }

    case 'NODE_REMOVED': {
      const { nodeId } = action;
      const touches =
        state.selectedNodeId === nodeId ||
        state.pendingEdgeSourceId === nodeId ||
        state.transitLinkSourceId === nodeId ||
        state.hoveredNodeId === nodeId;
      if (!touches) return { state };
      return {
        state: {
          ...state,
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          pendingEdgeSourceId:
            state.pendingEdgeSourceId === nodeId ? null : state.pendingEdgeSourceId,
          transitLinkSourceId:
            state.transitLinkSourceId === nodeId ? null : state.transitLinkSourceId,
          hoveredNodeId: state.hoveredNodeId === nodeId ? null : state.hoveredNodeId,
        },
      };
    }

    case 'CANCEL': {
      if (
        !hasPendingGesture(state) &&
        state.selectedNodeId === null &&
        state.selectedEdgeId === null
      ) {
        return { state };
      }
      return {
        state: {
          ...clearPending(state),
          selectedNodeId: null,
          selectedEdgeId: null,
        },
      };
    }

    default:
      return { state };
  }
}

export default editorReducer;
