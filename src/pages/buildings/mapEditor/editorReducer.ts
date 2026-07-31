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

import type { IconKind } from '../../../components/map';

/** Tools that edit the routing graph. */
export type GraphTool =
  | 'select'
  | 'pan'
  | 'place-node'
  | 'draw-edge'
  | 'assign-poi'
  | 'link-transit'
  | 'mark-exit';

/** Tools that draw the floor plan itself. */
export type DrawTool = 'draw-wall' | 'draw-room' | 'stamp-icon' | 'erase';

export type EditorTool = GraphTool | DrawTool;

const DRAW_TOOLS: readonly EditorTool[] = [
  'draw-wall',
  'draw-room',
  'stamp-icon',
  'erase',
];

export const isDrawTool = (tool: EditorTool): tool is DrawTool =>
  DRAW_TOOLS.includes(tool);

export interface EditorState {
  tool: EditorTool;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /** Selected drawing shape. Mutually exclusive with a node selection: the
   *  inspector shows one thing, and two highlights would be a lie. */
  selectedShapeId: string | null;
  /** First endpoint of an edge being drawn on the active floor. */
  pendingEdgeSourceId: string | null;
  /** First endpoint of a cross-floor transit link; survives floor changes. */
  transitLinkSourceId: string | null;
  /** Vertices of a wall run in progress, flat [x, y, x, y, ...]. */
  wallPoints: number[];
  /** Which marker the stamp tool drops. */
  stampIcon: IconKind;
  activeFloorId: string | null;
  hoveredNodeId: string | null;
}

/** What the page must go and do. The reducer never does it itself. */
export type EditorIntent =
  | { type: 'create-node'; x: number; y: number }
  | { type: 'commit-edge'; sourceNodeId: string; targetNodeId: string }
  | { type: 'commit-transit-link'; sourceNodeId: string; targetNodeId: string }
  | { type: 'edit-poi'; nodeId: string }
  | { type: 'toggle-exit'; nodeId: string }
  | { type: 'commit-wall'; points: number[] }
  | { type: 'stamp-icon'; icon: IconKind; x: number; y: number }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'erase-at'; x: number; y: number };

export type EditorAction =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SET_FLOOR'; floorId: string | null }
  | { type: 'SET_STAMP_ICON'; icon: IconKind }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SELECT_EDGE'; edgeId: string | null }
  | { type: 'SELECT_SHAPE'; shapeId: string | null }
  | { type: 'HOVER_NODE'; nodeId: string | null }
  | { type: 'NODE_CLICKED'; nodeId: string; floorId: string | null }
  | { type: 'MAP_CLICKED'; x: number; y: number }
  | { type: 'NODE_REMOVED'; nodeId: string }
  | { type: 'SHAPE_REMOVED'; shapeId: string }
  | { type: 'FINISH_WALL' }
  | { type: 'CANCEL' };

export interface EditorResult {
  state: EditorState;
  intent?: EditorIntent;
}

export const initialEditorState: EditorState = {
  tool: 'select',
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedShapeId: null,
  pendingEdgeSourceId: null,
  transitLinkSourceId: null,
  wallPoints: [],
  stampIcon: 'ELEVATOR',
  activeFloorId: null,
  hoveredNodeId: null,
};

/** True while a multi-click gesture is half-finished (drives the cancel hint). */
export const hasPendingGesture = (state: EditorState): boolean =>
  state.pendingEdgeSourceId !== null ||
  state.transitLinkSourceId !== null ||
  state.wallPoints.length > 0;

const clearPending = (state: EditorState): EditorState => ({
  ...state,
  pendingEdgeSourceId: null,
  transitLinkSourceId: null,
  wallPoints: [],
});

/**
 * A wall needs two distinct vertices. Finishing one with a single point (or a
 * double-click that landed on the point just placed) must discard it rather
 * than persist a zero-length shape nothing can select or delete.
 */
const wallIsUsable = (points: number[]): boolean => points.length >= 4;

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorResult {
  switch (action.type) {
    case 'SET_TOOL': {
      if (action.tool === state.tool) return { state };

      // Switching tools abandons any half-built edge or transit link: leaving
      // a dangling source id behind means the next click in the new tool
      // completes a gesture the user already walked away from. A wall run is
      // the exception worth honouring — the points are real work, so switching
      // away commits what has been drawn instead of discarding it.
      const intent: EditorIntent | undefined = wallIsUsable(state.wallPoints)
        ? { type: 'commit-wall', points: state.wallPoints }
        : undefined;

      return {
        state: {
          ...clearPending(state),
          tool: action.tool,
          selectedEdgeId: null,
        },
        intent,
      };
    }

    case 'SET_STAMP_ICON': {
      if (action.icon === state.stampIcon) return { state };
      return { state: { ...state, stampIcon: action.icon } };
    }

    case 'SELECT_SHAPE':
      return {
        state: {
          ...state,
          selectedShapeId: action.shapeId,
          // One inspector, one subject.
          selectedNodeId: null,
          selectedEdgeId: null,
        },
      };

    case 'SHAPE_REMOVED': {
      if (state.selectedShapeId !== action.shapeId) return { state };
      return { state: { ...state, selectedShapeId: null } };
    }

    case 'FINISH_WALL': {
      if (state.wallPoints.length === 0) return { state };
      const points = state.wallPoints;
      return {
        state: { ...state, wallPoints: [] },
        intent: wallIsUsable(points) ? { type: 'commit-wall', points } : undefined,
      };
    }

    case 'SET_FLOOR': {
      if (action.floorId === state.activeFloorId) return { state };
      return {
        state: {
          ...state,
          activeFloorId: action.floorId,
          // Selection, a half-drawn edge and a half-drawn wall all belong to
          // the floor we just left. A transit link deliberately does NOT reset
          // — picking the second endpoint on another floor is the whole point
          // of the tool.
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedShapeId: null,
          hoveredNodeId: null,
          pendingEdgeSourceId: null,
          wallPoints: [],
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
          selectedShapeId: null,
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
            state: {
            ...state,
            selectedNodeId: nodeId,
            selectedEdgeId: null,
            selectedShapeId: null,
          },
            intent: { type: 'edit-poi', nodeId },
          };

        case 'mark-exit':
          return {
            state: {
            ...state,
            selectedNodeId: nodeId,
            selectedEdgeId: null,
            selectedShapeId: null,
          },
            intent: { type: 'toggle-exit', nodeId },
          };

        case 'erase':
          // The eraser removes whatever it touches, so it must not also leave
          // the thing selected: the inspector would be pointed at a row that
          // is on its way out.
          return {
            state: { ...state, selectedNodeId: null, selectedShapeId: null },
            intent: { type: 'delete-node', nodeId },
          };

        case 'select':
        case 'place-node':
        default:
          return {
            state: {
            ...state,
            selectedNodeId: nodeId,
            selectedEdgeId: null,
            selectedShapeId: null,
          },
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

      if (state.tool === 'draw-wall') {
        // Each click drops a vertex; the run is committed by FINISH_WALL
        // (double-click, Enter, or switching tools).
        return {
          state: { ...state, wallPoints: [...state.wallPoints, action.x, action.y] },
        };
      }

      if (state.tool === 'stamp-icon') {
        return {
          state,
          intent: {
            type: 'stamp-icon',
            icon: state.stampIcon,
            x: action.x,
            y: action.y,
          },
        };
      }

      if (state.tool === 'erase') {
        // The eraser works off the tap itself, not off hitting an exact SVG
        // stroke: the page hit-tests everything near this point (nodes, then
        // connections, then shapes) and deletes the closest thing. Demanding
        // a dead-centre click on a 6-unit wall made the tool feel broken.
        return {
          state: { ...state, selectedNodeId: null, selectedShapeId: null, selectedEdgeId: null },
          intent: { type: 'erase-at', x: action.x, y: action.y },
        };
      }

      if (state.tool === 'select') {
        // Clicking empty map in the select tool is how you deselect.
        if (
          state.selectedNodeId === null &&
          state.selectedEdgeId === null &&
          state.selectedShapeId === null
        ) {
          return { state };
        }
        return {
          state: {
            ...state,
            selectedNodeId: null,
            selectedEdgeId: null,
            selectedShapeId: null,
          },
        };
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
        state.selectedEdgeId === null &&
        state.selectedShapeId === null
      ) {
        return { state };
      }
      // Escape discards the wall in progress rather than committing it — that
      // is the difference between Escape and switching tools.
      return {
        state: {
          ...clearPending(state),
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedShapeId: null,
        },
      };
    }

    default:
      return { state };
  }
}

export default editorReducer;
