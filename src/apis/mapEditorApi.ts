/* ============================================================================
   Map editor API — typed wrappers over /api/map-editor.
   ----------------------------------------------------------------------------
   The backend hands back raw Prisma rows; the shared renderer
   (src/components/map/types.ts) consumes a normalized domain shape. This module
   is the single place that translation happens, so no component ever has to
   know that a node's floor key is `floorId` on the wire but `floorId` on a
   MapNode by coincidence — or that `x`/`y` can arrive as strings from a Decimal
   column.

   Every route here requires CAN_EDIT_MAP. The permission middleware resolves the
   building from `req.body.buildingId` or backs it out of the `:nodeId` /
   `:floorId` / `:edgeId` param, so the JSON wrappers send `buildingId`
   explicitly whenever the caller knows it.
   ========================================================================= */

import { ApiError, del, get, post, put, request } from './http';
import type {
  FloorRecord,
  MapEdge,
  MapNode,
  NodeType,
  Poi,
  TransitType,
} from '../components/map/types';

/* --- wire shapes --------------------------------------------------------- */

/** Raw `Floor` row. */
export interface RawFloor {
  id: string;
  buildingId: string;
  floorNumber: number | string;
  name: string | null;
  mapImageUrl: string | null;
  qrCodeUrl: string | null;
  svgContent: string | null;
  width: number | string | null;
  height: number | string | null;
  scalePixelsPerMeter: number | string | null;
  scanCount: number | string | null;
}

/** Raw `Node` row. */
export interface RawNode {
  id: string;
  floorId: string;
  buildingId: string;
  x: number | string;
  y: number | string;
  type: string;
  label: string | null;
  qrSlug: string | null;
  scanCount: number | string | null;
}

/** Raw `Edge` row. */
export interface RawEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  buildingId: string;
  distance: number | string | null;
  weight: number | string | null;
  accessible: boolean | null;
  transitType: string | null;
}

/** Raw `Poi` row. */
export interface RawPoi {
  id: string;
  nodeId: string;
  name: string;
  category: string | null;
  description: string | null;
  keywords: string[] | null;
}

/** The `{ success, message, data }` envelope every route returns. */
interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

/* --- domain shapes (what the app and the renderer use) ------------------- */

export interface EditorFloor extends FloorRecord {
  buildingId: string;
  qrCodeUrl: string | null;
  scanCount: number;
}

export interface EditorNode extends MapNode {
  /** Always present on editor nodes — the floor the node was placed on. */
  floorId: string;
  buildingId: string;
  qrSlug: string | null;
  scanCount: number;
}

export interface EditorEdge extends MapEdge {
  buildingId: string;
}

export type EditorPoi = Poi;

export interface EditorGraph {
  floors: EditorFloor[];
  nodes: EditorNode[];
  edges: EditorEdge[];
  pois: EditorPoi[];
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  nodeIds?: string[];
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

/* --- coercion helpers ---------------------------------------------------- */

const NODE_TYPES: readonly NodeType[] = [
  'NORMAL',
  'ENTRANCE',
  'TRANSIT',
  'POI',
  'EMERGENCY_EXIT',
];

const TRANSIT_TYPES: readonly TransitType[] = [
  'WALKWAY',
  'ELEVATOR',
  'ESCALATOR',
  'STAIRS',
];

const num = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nullableNum = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const nullableStr = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/** Unknown enum values from the wire degrade to the safe default rather than
 *  crashing a renderer that indexes a theme map by node type. */
const asNodeType = (value: unknown): NodeType =>
  NODE_TYPES.includes(value as NodeType) ? (value as NodeType) : 'NORMAL';

const asTransitType = (value: unknown): TransitType =>
  TRANSIT_TYPES.includes(value as TransitType) ? (value as TransitType) : 'WALKWAY';

/* --- mappers ------------------------------------------------------------- */

export const toEditorFloor = (row: RawFloor): EditorFloor => ({
  id: row.id,
  buildingId: row.buildingId,
  floorNumber: num(row.floorNumber),
  name: nullableStr(row.name),
  mapImageUrl: nullableStr(row.mapImageUrl),
  qrCodeUrl: nullableStr(row.qrCodeUrl),
  svgContent: nullableStr(row.svgContent),
  width: nullableNum(row.width),
  height: nullableNum(row.height),
  scalePixelsPerMeter: nullableNum(row.scalePixelsPerMeter),
  scanCount: num(row.scanCount),
});

export const toEditorNode = (row: RawNode): EditorNode => ({
  id: row.id,
  floorId: row.floorId,
  buildingId: row.buildingId,
  x: num(row.x),
  y: num(row.y),
  type: asNodeType(row.type),
  label: nullableStr(row.label),
  qrSlug: nullableStr(row.qrSlug),
  scanCount: num(row.scanCount),
});

export const toEditorEdge = (row: RawEdge): EditorEdge => ({
  id: row.id,
  sourceNodeId: row.sourceNodeId,
  targetNodeId: row.targetNodeId,
  buildingId: row.buildingId,
  transitType: asTransitType(row.transitType),
  accessible: row.accessible !== false,
  distance: nullableNum(row.distance) ?? undefined,
  weight: nullableNum(row.weight) ?? undefined,
});

export const toEditorPoi = (row: RawPoi): EditorPoi => ({
  id: row.id,
  nodeId: row.nodeId,
  name: row.name,
  category: nullableStr(row.category),
  description: nullableStr(row.description),
  keywords: Array.isArray(row.keywords) ? row.keywords : [],
});

/** `{ success: false }` with a 200 status is still a failure. */
const unwrap = <T>(response: Envelope<T> | null | undefined): T => {
  if (!response || response.success === false || response.data === undefined) {
    throw new ApiError(response?.message || 'Request failed.', 0, response);
  }
  return response.data;
};

const asArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

/** Appends only the fields the caller actually set — PATCH must stay partial. */
const appendIfSet = (
  form: FormData,
  key: string,
  value: string | number | null | undefined,
): void => {
  if (value === undefined || value === null || value === '') return;
  form.append(key, String(value));
};

/* --- graph --------------------------------------------------------------- */

export const getBuildingGraph = async (buildingId: string): Promise<EditorGraph> => {
  const data = unwrap(
    await get<Envelope<{
      floors?: RawFloor[];
      nodes?: RawNode[];
      edges?: RawEdge[];
      pois?: RawPoi[];
    }>>(`/api/map-editor/buildings/${encodeURIComponent(buildingId)}/graph`),
  );

  return {
    floors: asArray(data.floors).map(toEditorFloor),
    nodes: asArray(data.nodes).map(toEditorNode),
    edges: asArray(data.edges).map(toEditorEdge),
    pois: asArray(data.pois).map(toEditorPoi),
  };
};

/* --- floors -------------------------------------------------------------- */

export const listFloors = async (buildingId: string): Promise<EditorFloor[]> => {
  const data = unwrap(
    await get<Envelope<{ floors?: RawFloor[] }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/floors`,
    ),
  );
  return asArray(data.floors).map(toEditorFloor);
};

export interface FloorInput {
  floorNumber?: number | string;
  name?: string;
  scalePixelsPerMeter?: number | string | null;
  /** Floor plan image (raster or svg). Sent as the `map` file field. */
  map?: File | null;
  /** Inline SVG markup — PATCH only. */
  svgContent?: string | null;
}

const floorFormData = (input: FloorInput): FormData => {
  // Never set Content-Type by hand: http.ts leaves FormData alone so the
  // browser can write the multipart boundary itself.
  const form = new FormData();
  appendIfSet(form, 'floorNumber', input.floorNumber);
  appendIfSet(form, 'name', input.name);
  appendIfSet(form, 'scalePixelsPerMeter', input.scalePixelsPerMeter);
  appendIfSet(form, 'svgContent', input.svgContent);
  if (input.map) form.append('map', input.map);
  return form;
};

export const createFloor = async (
  buildingId: string,
  input: FloorInput,
): Promise<EditorFloor> => {
  const data = unwrap(
    await post<Envelope<{ floor: RawFloor }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/floors`,
      floorFormData(input),
    ),
  );
  return toEditorFloor(data.floor);
};

export const updateFloor = async (
  floorId: string,
  input: FloorInput,
): Promise<EditorFloor> => {
  const data = unwrap(
    await request<Envelope<{ floor: RawFloor }>>(
      `/api/map-editor/floors/${encodeURIComponent(floorId)}`,
      { method: 'PATCH', body: floorFormData(input) },
    ),
  );
  return toEditorFloor(data.floor);
};

export const deleteFloor = async (floorId: string): Promise<void> => {
  await del<Envelope<unknown>>(`/api/map-editor/floors/${encodeURIComponent(floorId)}`);
};

/* --- nodes --------------------------------------------------------------- */

export interface CreateNodeInput {
  buildingId: string;
  x: number;
  y: number;
  type: NodeType;
  label?: string | null;
}

export const createNode = async (
  floorId: string,
  input: CreateNodeInput,
): Promise<EditorNode> => {
  const data = unwrap(
    await post<Envelope<{ node: RawNode }>>(
      `/api/map-editor/floors/${encodeURIComponent(floorId)}/nodes`,
      {
        buildingId: input.buildingId,
        x: input.x,
        y: input.y,
        type: input.type,
        label: input.label ?? null,
      },
    ),
  );
  return toEditorNode(data.node);
};

export interface UpdateNodeInput {
  buildingId: string;
  x?: number;
  y?: number;
  type?: NodeType;
  label?: string | null;
}

/** Moving a node makes the server recompute the distance of every incident
 *  edge, so the returned row is authoritative — always take it. */
export const updateNode = async (
  nodeId: string,
  input: UpdateNodeInput,
): Promise<EditorNode> => {
  const data = unwrap(
    await request<Envelope<{ node: RawNode }>>(
      `/api/map-editor/nodes/${encodeURIComponent(nodeId)}`,
      { method: 'PATCH', body: input },
    ),
  );
  return toEditorNode(data.node);
};

export const deleteNode = async (nodeId: string): Promise<void> => {
  await del<Envelope<unknown>>(`/api/map-editor/nodes/${encodeURIComponent(nodeId)}`);
};

/* --- edges --------------------------------------------------------------- */

export interface CreateEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  buildingId: string;
  transitType?: TransitType;
  /** Omit to let the server derive the cost from the distance. */
  weight?: number | null;
  accessible?: boolean;
}

export const createEdge = async (input: CreateEdgeInput): Promise<EditorEdge> => {
  const data = unwrap(
    await post<Envelope<{ edge: RawEdge }>>('/api/map-editor/edges', input),
  );
  return toEditorEdge(data.edge);
};

export interface UpdateEdgeInput {
  buildingId: string;
  transitType?: TransitType;
  /** `null` clears the override and restores the derived cost. */
  weight?: number | null;
  accessible?: boolean;
}

export const updateEdge = async (
  edgeId: string,
  input: UpdateEdgeInput,
): Promise<EditorEdge> => {
  const data = unwrap(
    await request<Envelope<{ edge: RawEdge }>>(
      `/api/map-editor/edges/${encodeURIComponent(edgeId)}`,
      { method: 'PATCH', body: input },
    ),
  );
  return toEditorEdge(data.edge);
};

export const deleteEdge = async (edgeId: string): Promise<void> => {
  await del<Envelope<unknown>>(`/api/map-editor/edges/${encodeURIComponent(edgeId)}`);
};

/* --- transit links (cross-floor) ----------------------------------------- */

export interface TransitLinkInput {
  /** Exactly two node ids, on two different floors. */
  nodeIds: [string, string];
  transitType: TransitType;
  buildingId: string;
  accessible?: boolean;
}

export const createTransitLink = async (
  input: TransitLinkInput,
): Promise<EditorEdge> => {
  const data = unwrap(
    await post<Envelope<{ edge: RawEdge }>>('/api/map-editor/transit-links', input),
  );
  return toEditorEdge(data.edge);
};

/* --- points of interest -------------------------------------------------- */

export interface PoiInput {
  buildingId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  keywords?: string[];
}

/** Upsert — also flips the node's type to POI server-side. */
export const savePoi = async (nodeId: string, input: PoiInput): Promise<EditorPoi> => {
  const data = unwrap(
    await put<Envelope<{ poi: RawPoi }>>(
      `/api/map-editor/nodes/${encodeURIComponent(nodeId)}/poi`,
      {
        buildingId: input.buildingId,
        name: input.name,
        category: input.category ?? null,
        description: input.description ?? null,
        keywords: input.keywords ?? [],
      },
    ),
  );
  return toEditorPoi(data.poi);
};

export const deletePoi = async (nodeId: string): Promise<void> => {
  await del<Envelope<unknown>>(
    `/api/map-editor/nodes/${encodeURIComponent(nodeId)}/poi`,
  );
};

/* --- validation ---------------------------------------------------------- */

const SEVERITIES: readonly ValidationSeverity[] = ['error', 'warning', 'info'];

export const validateBuilding = async (
  buildingId: string,
): Promise<ValidationReport> => {
  const data = unwrap(
    await get<Envelope<{ ok?: boolean; issues?: ValidationIssue[] }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/validate`,
    ),
  );

  const issues = asArray(data.issues).map((issue) => ({
    code: String(issue?.code ?? 'UNKNOWN'),
    // An unrecognised severity must not silently disappear from the panel —
    // it is downgraded to a warning, never dropped.
    severity: SEVERITIES.includes(issue?.severity)
      ? issue.severity
      : ('warning' as ValidationSeverity),
    message: String(issue?.message ?? ''),
    nodeIds: Array.isArray(issue?.nodeIds) ? issue.nodeIds : undefined,
  }));

  return { ok: data.ok !== false, issues };
};

/* --- QR ------------------------------------------------------------------ */

export interface NodeQrInput {
  nodeId: string;
  buildingId: string;
  floorNumber: number;
  format?: 'png' | 'svg';
}

export interface NodeQrResult {
  qrData: string;
  url?: string;
  svgContent?: string;
  filename?: string;
  [key: string]: unknown;
}

export const generateNodeQr = async (input: NodeQrInput): Promise<NodeQrResult> =>
  unwrap(
    await post<Envelope<NodeQrResult>>('/api/qr/generate', {
      nodeId: input.nodeId,
      buildingId: input.buildingId,
      floorNumber: input.floorNumber,
      format: input.format ?? 'svg',
    }),
  );
