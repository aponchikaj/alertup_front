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
import { parseDrawing, type FloorDrawing } from '../components/map/drawing';
import type {
  EdgeDirection,
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
  /** Hand-drawn plan; arrives as an untyped JSON column. */
  drawing: unknown;
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
  /** Relative to `sourceNodeId` → `targetNodeId` as returned here, never the
   *  order the two nodes happened to be posted in. Missing on rows created
   *  before this column existed. */
  direction?: string | null;
  tags?: string[] | null;
}

/** Raw `Poi` row. */
export interface RawPoi {
  id: string;
  nodeId: string;
  name: string;
  category: string | null;
  description: string | null;
  keywords: string[] | null;
  /** Integrator-supplied stable code, unique per building. */
  externalId?: string | null;
  /** Localized display names/aliases; the JSON column is `null` until saved. */
  names?: { en?: string; ka?: string; aliases?: string[] } | null;
}

/** Raw `Closure` row, as the map-editor's closure routes return it (the
 *  public projection plus the operational detail an owner needs to manage
 *  the row). Dates already arrive as ISO strings — the route hand-serializes
 *  them rather than leaving `Date` objects for `res.json` to touch. */
export interface RawClosure {
  id: string;
  floorId: string | null;
  edgeIds: string[] | null;
  nodeIds: string[] | null;
  /** `null` is the BLOCKED sentinel; a number is a cost penalty (>= 1). */
  costMultiplier: number | string | null;
  reason: string | null;
  startsAt: string;
  endsAt: string | null;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Precomputed by the server (`costMultiplier === null`) — kept rather than
   *  re-derived so a future server-side rule change does not silently drift
   *  from what the client displays. */
  blocked?: boolean;
  /** Editor list only: whether the closure is in force right now. */
  active?: boolean;
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
  /** Always a usable drawing (possibly empty) — never the raw column. */
  drawing: FloorDrawing;
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
  /** Always present on an editor edge — never undefined the way a plain
   *  `MapEdge` (which may come from a leaner route payload) allows. */
  direction: EdgeDirection;
  tags: string[];
}

/**
 * A POI as the editor loads it.
 *
 * Carries the localized display names as well as the aliases, because the
 * PUT-POI route replaces the whole `names` JSON column whenever the key is
 * present at all: a client that only knew about `aliases` could not edit them
 * without dropping any `en`/`ka` someone else had set. These two are not
 * editable in the editor UI — they exist so a save can echo back what it
 * loaded. See `savePoi`.
 */
export interface EditorPoi extends Poi {
  nameEn?: string;
  nameKa?: string;
}

export interface EditorGraph {
  floors: EditorFloor[];
  nodes: EditorNode[];
  edges: EditorEdge[];
  pois: EditorPoi[];
}

/**
 * A routing restriction as the map-editor's closure routes return it.
 *
 * `floorId` and `reason` are nullable — a closure scoped to bare `edgeIds`
 * legitimately has neither. `costMultiplier === null` is the BLOCKED
 * sentinel; `blocked` mirrors that server-side so no consumer has to
 * re-derive it. Deliberately does NOT match the F11 brief's literal field
 * list (`buildingId`, no `blocked`/`active`/`createdById`/`updatedAt`) —
 * see the task report for why this follows the backend's actual
 * `editorClosure` projection instead.
 */
export interface Closure {
  id: string;
  floorId: string | null;
  edgeIds: string[];
  nodeIds: string[];
  costMultiplier: number | null;
  reason: string | null;
  startsAt: string;
  endsAt: string | null;
  createdById: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  blocked: boolean;
  active: boolean;
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

const EDGE_DIRECTIONS: readonly EdgeDirection[] = ['BOTH', 'FORWARD', 'REVERSE'];

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

/** A row with no direction column (or an unrecognised value) is untethered —
 *  `BOTH` is the safe default, matching the Prisma column's own default. */
const asEdgeDirection = (value: unknown): EdgeDirection =>
  EDGE_DIRECTIONS.includes(value as EdgeDirection) ? (value as EdgeDirection) : 'BOTH';

/* --- mappers ------------------------------------------------------------- */

export const toEditorFloor = (row: RawFloor): EditorFloor => ({
  id: row.id,
  buildingId: row.buildingId,
  floorNumber: num(row.floorNumber),
  name: nullableStr(row.name),
  mapImageUrl: nullableStr(row.mapImageUrl),
  qrCodeUrl: nullableStr(row.qrCodeUrl),
  svgContent: nullableStr(row.svgContent),
  // Parsed at the boundary so no component ever handles the raw column.
  drawing: parseDrawing(row.drawing),
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
  direction: asEdgeDirection(row.direction),
  tags: Array.isArray(row.tags) ? row.tags : [],
});

export const toEditorPoi = (row: RawPoi): EditorPoi => ({
  id: row.id,
  nodeId: row.nodeId,
  name: row.name,
  category: nullableStr(row.category),
  description: nullableStr(row.description),
  keywords: Array.isArray(row.keywords) ? row.keywords : [],
  externalId: nullableStr(row.externalId) ?? undefined,
  aliases: Array.isArray(row.names?.aliases) ? row.names.aliases : [],
  nameEn: nullableStr(row.names?.en) ?? undefined,
  nameKa: nullableStr(row.names?.ka) ?? undefined,
});

/** `costMultiplier === null` on the wire is the BLOCKED sentinel, not "no
 *  value set" — `blocked` is read straight off the server's own derivation
 *  rather than re-computed, so the two can never disagree. */
export const toEditorClosure = (row: RawClosure): Closure => ({
  id: row.id,
  floorId: nullableStr(row.floorId),
  edgeIds: Array.isArray(row.edgeIds) ? row.edgeIds : [],
  nodeIds: Array.isArray(row.nodeIds) ? row.nodeIds : [],
  costMultiplier: nullableNum(row.costMultiplier),
  reason: nullableStr(row.reason),
  startsAt: row.startsAt,
  endsAt: nullableStr(row.endsAt),
  createdById: nullableStr(row.createdById),
  createdAt: nullableStr(row.createdAt),
  updatedAt: nullableStr(row.updatedAt),
  blocked: row.blocked === true || row.costMultiplier === null,
  active: row.active === true,
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
  /** Canvas size in map units — set when a floor is drawn rather than uploaded. */
  width?: number | string | null;
  height?: number | string | null;
  /** Floor plan image (raster or svg). Sent as the `map` file field. */
  map?: File | null;
  /** Inline SVG markup — PATCH only. */
  svgContent?: string | null;
  /** Hand-drawn plan. `null` clears it; omit to leave it untouched. */
  drawing?: FloorDrawing | null;
}

const floorFormData = (input: FloorInput): FormData => {
  // Never set Content-Type by hand: http.ts leaves FormData alone so the
  // browser can write the multipart boundary itself.
  const form = new FormData();
  appendIfSet(form, 'floorNumber', input.floorNumber);
  appendIfSet(form, 'name', input.name);
  appendIfSet(form, 'scalePixelsPerMeter', input.scalePixelsPerMeter);
  appendIfSet(form, 'width', input.width);
  appendIfSet(form, 'height', input.height);
  appendIfSet(form, 'svgContent', input.svgContent);
  // Sent as JSON text: multipart has no nested-object encoding, and the server
  // parses this field back with JSON.parse. `null` is meaningful (clear it), so
  // it goes through the raw append rather than appendIfSet.
  if (input.drawing !== undefined) {
    form.append('drawing', input.drawing === null ? '' : JSON.stringify(input.drawing));
  }
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

/**
 * Wire every node on a floor into one walkable graph (MST + shortcuts,
 * drawn walls block). Idempotent; returns only the newly created edges.
 */
export const autoConnectFloor = async (floorId: string): Promise<EditorEdge[]> => {
  const data = unwrap(
    await post<Envelope<{ edges?: RawEdge[] }>>(
      `/api/map-editor/floors/${encodeURIComponent(floorId)}/auto-connect`,
      {},
    ),
  );
  return asArray(data.edges).map(toEditorEdge);
};

/** Store a shop logo and get back the URL to write into the shape. */
export const uploadShopLogo = async (
  buildingId: string,
  file: File,
): Promise<string> => {
  const form = new FormData();
  form.append('logo', file);
  const data = unwrap(
    await post<Envelope<{ url: string }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/logos`,
      form,
    ),
  );
  return data.url;
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
  /** Relative to the edge's stored `sourceNodeId` → `targetNodeId` — which,
   *  after the server normalizes the pair, is not necessarily the order
   *  `sourceNodeId`/`targetNodeId` were posted in above. Omit for `BOTH`. */
  direction?: EdgeDirection;
  tags?: string[];
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
  /** Same relative-to-`sourceNodeId→targetNodeId` semantics as on create —
   *  PATCHing back the `direction` a create/read returned is a no-op. */
  direction?: EdgeDirection;
  tags?: string[];
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
  /** Integrator-supplied stable code, unique per building. Omit to leave it
   *  unchanged; `null` clears it. Unlike every other field on this input,
   *  the server does NOT reset this on an ordinary save — it is the one
   *  exception to the route's whole-row PUT semantics. */
  externalId?: string | null;
  /** Search aliases, folded into the wire `names.aliases`. Omit to leave the
   *  POI's localized names untouched (the server replaces the whole `names`
   *  column wholesale whenever the key is present at all, so an accidental
   *  `names: {}` on a plain rename would silently erase them); `null` clears
   *  them outright. */
  aliases?: string[] | null;
  /**
   * The localized names the caller LOADED (`EditorPoi.nameEn`/`nameKa`), not
   * an edit. They are re-sent verbatim alongside `aliases` because the server
   * overwrites the whole `names` column — without them an alias-only edit
   * would drop the translations, and `{aliases: []}` on its own parses to null
   * there and nulls the column outright.
   */
  nameEn?: string | null;
  nameKa?: string | null;
}

/** Upsert — also flips the node's type to POI server-side. */
export const savePoi = async (nodeId: string, input: PoiInput): Promise<EditorPoi> => {
  const body: Record<string, unknown> = {
    buildingId: input.buildingId,
    name: input.name,
    category: input.category ?? null,
    description: input.description ?? null,
    keywords: input.keywords ?? [],
  };
  // `externalId`/`names` are only ever added to the body when the caller
  // actually set them — sending either key at all (even `{}`) tells the
  // server to overwrite it, so "the caller didn't touch this" must mean the
  // key is absent, not present-with-a-default.
  if (input.externalId !== undefined) body.externalId = input.externalId;
  if (input.aliases !== undefined) {
    if (input.aliases === null) {
      body.names = null;
    } else {
      // Rebuilt, not patched: the server swaps the column for exactly this
      // object, so every key that must survive has to be in it.
      const names: { aliases: string[]; en?: string; ka?: string } = {
        aliases: input.aliases,
      };
      if (input.nameEn) names.en = input.nameEn;
      if (input.nameKa) names.ka = input.nameKa;
      body.names = names;
    }
  }

  const data = unwrap(
    await put<Envelope<{ poi: RawPoi }>>(
      `/api/map-editor/nodes/${encodeURIComponent(nodeId)}/poi`,
      body,
    ),
  );
  return toEditorPoi(data.poi);
};

export const deletePoi = async (nodeId: string): Promise<void> => {
  await del<Envelope<unknown>>(
    `/api/map-editor/nodes/${encodeURIComponent(nodeId)}/poi`,
  );
};

/* --- closures -------------------------------------------------------------
   Routing restrictions ("this corridor is shut for the incident"). Nested
   under /buildings/:buildingId/... to match requireBuildingPermission's
   shape on the backend (see closure.routes.js) — there is no bare
   /closures/:closureId route to call.
   ========================================================================= */

export const listClosures = async (buildingId: string): Promise<Closure[]> => {
  const data = unwrap(
    await get<Envelope<{ closures?: RawClosure[] }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/closures`,
    ),
  );
  return asArray(data.closures).map(toEditorClosure);
};

export interface CreateClosureInput {
  edgeIds?: string[];
  nodeIds?: string[];
  /** A floorId alone closes every edge whose both endpoints are on that
   *  floor. Ignored by the server entirely once `edgeIds`/`nodeIds` name
   *  anything — naming ids overrides scoping by floor, it does not add to it. */
  floorId?: string | null;
  /**
   * `null` = BLOCKED outright; a number >= 1 = a cost penalty (routes still
   * cross it, just less willingly).
   *
   * Required here — not optional — on purpose. The wire's own sentinel for
   * "blocked" is an ABSENT field resolving server-side to `null`, which
   * means a caller who simply forgets to set this would silently publish a
   * hard block. Making it mandatory at the TypeScript boundary forces every
   * call site to say `null` on purpose rather than by omission.
   */
  costMultiplier: number | null;
  /** Trimmed and capped at 200 chars server-side; empty/whitespace becomes
   *  null there. */
  reason?: string | null;
  startsAt?: string;
  endsAt?: string | null;
}

export const createClosure = async (
  buildingId: string,
  input: CreateClosureInput,
): Promise<Closure> => {
  const data = unwrap(
    await post<Envelope<{ closure: RawClosure }>>(
      `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/closures`,
      input,
    ),
  );
  return toEditorClosure(data.closure);
};

export const deleteClosure = async (
  buildingId: string,
  closureId: string,
): Promise<void> => {
  await del<Envelope<unknown>>(
    `/api/map-editor/buildings/${encodeURIComponent(buildingId)}/closures/${encodeURIComponent(closureId)}`,
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
