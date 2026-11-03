import { GRID_STEP, type NodeType } from '../../../components/map';
import {
  ExitDoorIcon,
  LayersIcon,
  MapIcon,
  PenIcon,
  PlusIcon,
  RouteIcon,
  ScanIcon,
  SquareIcon,
  StampIcon,
  TrashIcon,
} from '../../../components/ui/Icons';
import type { EditorGraph } from '../../../apis/mapEditorApi';
import type { EditorTool } from './editorReducer';
import type { ToolMenuItem } from './ToolMenu';
import type { ClosureEdgeOption } from './ClosuresPanel';

/** Stable empty list — a fresh [] would re-run the panel's own memo. */
export const NO_EDGE_OPTIONS: ClosureEdgeOption[] = [];

export const EMPTY_GRAPH: EditorGraph = { floors: [], nodes: [], edges: [], pois: [] };

/** Node PATCH after a drag. Long enough to coalesce a nudge-and-adjust. */
export const DRAG_COMMIT_DELAY_MS = 150;

/**
 * Drawing PATCH debounce. Much longer than the node one: a drawing saves the
 * whole shape list at once, and drawing is a rapid-fire activity (drag a box,
 * nudge it, rename it). Coalescing hard keeps that to one request.
 */
export const DRAWING_COMMIT_DELAY_MS = 700;

/** Snapping uses the drawn grid's own spacing, so every point the user places
 *  lands on a line they can see. See GRID_STEP for why these are one number. */
export const SNAP_STEP = GRID_STEP;

/** Below this a drag is a mis-click, not a box the user meant to draw. */
export const MIN_BOX_SIZE = 8;

/**
 * Auto-connect radius in map units (6 m at the default 50 px/m scale).
 *
 * Placing a chain of corridor nodes used to mean constant tool switching:
 * place, connect, place, connect. With auto-connect on, each new node links
 * itself to the nearest existing node within this radius, so a corridor is
 * one click per node. The radius is deliberately conservative — linking
 * across a wall to the room next door would silently create a route through
 * concrete.
 */
export const AUTO_CONNECT_RADIUS = 300;

/**
 * Eraser hit slop, in map units. The eraser hit-tests shape geometry around
 * the tap instead of relying on the click landing on an exact SVG stroke —
 * a 6-unit wall is not a clickable target, and an eraser that only works on
 * dead-centre clicks reads as broken.
 */
export const ERASE_SHAPE_SLOP = 8;

/** What the editor is editing: the plan, the routing graph, or the canvas. */
export type EditorMode = 'draw' | 'nodes' | 'floor';

/** Select and pan belong to both modes — they edit nothing. */
export const COMMON_TOOLS: ToolMenuItem[] = [
  { tool: 'select', labelKey: 'mapEditor.toolSelect', Icon: ScanIcon, shortcut: 'V' },
  { tool: 'pan', labelKey: 'mapEditor.toolPan', Icon: MapIcon, shortcut: 'H' },
];

export const GRAPH_TOOLS: ToolMenuItem[] = [
  ...COMMON_TOOLS,
  { tool: 'place-node', labelKey: 'mapEditor.toolPlaceNode', Icon: PlusIcon, shortcut: 'N' },
  { tool: 'draw-edge', labelKey: 'mapEditor.toolDrawEdge', Icon: RouteIcon, shortcut: 'C' },
  { tool: 'link-transit', labelKey: 'mapEditor.toolLinkTransit', Icon: LayersIcon, shortcut: 'T' },
  { tool: 'mark-exit', labelKey: 'mapEditor.toolMarkExit', Icon: ExitDoorIcon, shortcut: 'X' },
];

export const DRAW_TOOLS: ToolMenuItem[] = [
  ...COMMON_TOOLS,
  { tool: 'draw-wall', labelKey: 'mapEditor.toolDrawWall', Icon: PenIcon, shortcut: 'W' },
  { tool: 'draw-room', labelKey: 'mapEditor.toolDrawRoom', Icon: SquareIcon, shortcut: 'R' },
  { tool: 'stamp-icon', labelKey: 'mapEditor.toolStampIcon', Icon: StampIcon, shortcut: 'M' },
  { tool: 'erase', labelKey: 'mapEditor.toolErase', Icon: TrashIcon, shortcut: 'E' },
];

/**
 * key -> tool, flipping the editor into the right mode as it switches. "W"
 * means "wall" from anywhere; making the user check which mode is showing
 * first would defeat the point of a shortcut.
 */
export const TOOL_SHORTCUTS: Record<string, { tool: EditorTool; nodesMode?: boolean }> = {
  v: { tool: 'select' },
  h: { tool: 'pan' },
  n: { tool: 'place-node', nodesMode: true },
  c: { tool: 'draw-edge', nodesMode: true },
  t: { tool: 'link-transit', nodesMode: true },
  x: { tool: 'mark-exit', nodesMode: true },
  w: { tool: 'draw-wall', nodesMode: false },
  r: { tool: 'draw-room', nodesMode: false },
  m: { tool: 'stamp-icon', nodesMode: false },
  e: { tool: 'erase', nodesMode: false },
};

export const NODE_TYPE_KEYS: Record<NodeType, string> = {
  NORMAL: 'mapEditor.typeNormal',
  ENTRANCE: 'mapEditor.typeEntrance',
  TRANSIT: 'mapEditor.typeTransit',
  POI: 'mapEditor.typePoi',
  EMERGENCY_EXIT: 'mapEditor.typeEmergencyExit',
};

/**
 * Cursor per tool.
 *
 * The armed tool is otherwise only visible in the toolbar, which is exactly
 * where the user is not looking while they work. Crosshair means "this click
 * places something precise", copy means "this drops a copy of the marker", and
 * grab keeps its usual meaning so panning still feels like panning.
 */
export const TOOL_CURSORS: Partial<Record<EditorTool, string>> = {
  select: 'default',
  pan: 'grab',
  'place-node': 'crosshair',
  'draw-edge': 'crosshair',
  'link-transit': 'crosshair',
  'mark-exit': 'crosshair',
  'draw-wall': 'crosshair',
  'draw-room': 'crosshair',
  'stamp-icon': 'copy',
  // No 'eraser' cursor exists; crosshair at least says "aimed action" —
  // not-allowed read as "this tool is disabled".
  erase: 'crosshair',
};

/** Per-tool instruction. A drawing tool that does not say what to do reads as
 *  broken — the canvas gives no other affordance. */
export const DRAW_TOOL_HINTS: Partial<Record<EditorTool, string>> = {
  'draw-wall': 'mapEditor.hintDrawWall',
  'draw-room': 'mapEditor.hintDrawRoom',
  'stamp-icon': 'mapEditor.hintStampIcon',
  erase: 'mapEditor.hintErase',
};
