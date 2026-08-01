import { get } from "./http";
import type { AssembledRoute } from "../components/map/types";

/* ============================================================================
   Wayfinding API — POI search and route calculation.
   ----------------------------------------------------------------------------
   The route shape is the backend's routeAssembler output, consumed field for
   field (see src/components/map/types.ts). `adaptLegacyRoute` bridges the
   older scan payload so the viewer keeps working against a backend that has
   not been redeployed yet.
   ========================================================================= */

export interface PoiSearchResult {
  poiId: string;
  name: string;
  category: string | null;
  description: string | null;
  nodeId: string;
  floorId: string | null;
  floorNumber: number | null;
  floorName: string | null;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function searchPois(
  buildingId: string,
  query: string,
  options: { floorNumber?: number; signal?: AbortSignal } = {},
): Promise<PoiSearchResult[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options.floorNumber !== undefined) {
    params.set("floor", String(options.floorNumber));
  }
  const res = await get<Envelope<{ pois: PoiSearchResult[] }>>(
    `/api/wayfinding/buildings/${buildingId}/pois?${params.toString()}`,
    { signal: options.signal },
  );
  return res.data?.pois ?? [];
}

/** One row of the building directory: a POI, a named drawn room, or a
 *  labeled node. */
export interface DirectoryEntry {
  kind: 'poi' | 'node' | 'shape';
  poiId: string | null;
  nodeId: string;
  name: string;
  category: string | null;
  nodeType: string;
  floorId: string | null;
  floorNumber: number | null;
  floorName: string | null;
}

/**
 * The building's full directory — every destination a visitor can name.
 * Fetched once per scan and filtered client-side, so search feels instant.
 */
export async function fetchDirectory(buildingId: string): Promise<DirectoryEntry[]> {
  const res = await get<Envelope<{ entries?: DirectoryEntry[] }>>(
    `/api/wayfinding/buildings/${encodeURIComponent(buildingId)}/directory`,
  );
  return Array.isArray(res.data?.entries) ? res.data.entries : [];
}

export interface RouteRequest {
  fromNodeId: string;
  /** A node id, or a POI id which the server resolves to its node. */
  toNodeId?: string;
  toPoiId?: string;
  accessible?: boolean;
  signal?: AbortSignal;
}

export async function fetchRoute({
  fromNodeId,
  toNodeId,
  toPoiId,
  accessible = false,
  signal,
}: RouteRequest): Promise<AssembledRoute> {
  const to = toPoiId ? `poi:${toPoiId}` : toNodeId;
  const params = new URLSearchParams({ from: fromNodeId, to: to ?? "" });
  if (accessible) params.set("accessible", "true");

  const res = await get<Envelope<{ route: AssembledRoute }>>(
    `/api/wayfinding/route?${params.toString()}`,
    { signal },
  );
  return res.data.route;
}

export async function fetchEvacuationRoute(
  fromNodeId: string,
  options: { accessible?: boolean; signal?: AbortSignal } = {},
): Promise<AssembledRoute> {
  const params = new URLSearchParams({ from: fromNodeId });
  if (options.accessible) params.set("accessible", "true");

  const res = await get<Envelope<{ route: AssembledRoute }>>(
    `/api/wayfinding/evacuate?${params.toString()}`,
    { signal: options.signal },
  );
  return res.data.route;
}

/* --------------------------------------------------------------------------
   Legacy bridge.
   The scan endpoint has always returned a flat `routeNodes` array plus
   `floorTransitions`. New deployments also return `route` in the assembled
   shape. Until every environment is on the new backend, the viewer asks for
   `route` and falls back to rebuilding it from the legacy fields.
   ----------------------------------------------------------------------- */

export interface LegacyRouteNode {
  id: string;
  x: number;
  y: number;
  type: string;
  label: string | null;
  floor: number;
}

export interface LegacyFloorTransition {
  from: number;
  to: number;
  atStep: number;
  nodeType: string;
}

type RouteNodeType = AssembledRoute["segments"][number]["nodes"][number]["type"];

const LEGACY_TYPE_MAP: Record<string, RouteNodeType> = {
  path: "NORMAL",
  exit: "EMERGENCY_EXIT",
  stairs: "TRANSIT",
};

const toNodeType = (legacy: string): RouteNodeType =>
  LEGACY_TYPE_MAP[legacy] ?? "NORMAL";

/**
 * Rebuild the assembled shape from the legacy scan fields. Floor metadata is
 * unavailable in the legacy payload, so segments carry `floor: null` and
 * distances stay in pixels — the viewer already treats metres as optional.
 */
export function adaptLegacyRoute(
  routeNodes: LegacyRouteNode[],
  transitions: LegacyFloorTransition[],
): AssembledRoute | null {
  if (!Array.isArray(routeNodes) || routeNodes.length === 0) return null;

  const segments: AssembledRoute["segments"] = [];
  let current: LegacyRouteNode[] = [routeNodes[0]];

  for (let i = 1; i < routeNodes.length; i++) {
    if (routeNodes[i].floor === routeNodes[i - 1].floor) {
      current.push(routeNodes[i]);
    } else {
      segments.push(buildSegment(segments.length, current));
      current = [routeNodes[i]];
    }
  }
  segments.push(buildSegment(segments.length, current));

  const builtTransitions: AssembledRoute["transitions"] = transitions.map((t, i) => {
    const fromNode = segments[i]?.nodes.at(-1);
    const toNode = segments[i + 1]?.nodes[0];
    return {
      afterSegmentIndex: i,
      transitType: "STAIRS",
      fromFloorNumber: t.from,
      toFloorNumber: t.to,
      fromNodeId: fromNode?.id ?? "",
      toNodeId: toNode?.id ?? "",
      direction: t.to > t.from ? "up" : t.to < t.from ? "down" : "same",
      label: toNode?.label ?? null,
    };
  });

  const steps: AssembledRoute["steps"] = [];
  segments.forEach((segment, i) => {
    steps.push({ kind: "walk", segmentIndex: segment.index });
    if (i < builtTransitions.length) {
      steps.push({ kind: "transit", transitionIndex: i });
    }
  });
  steps.push({ kind: "arrive" });

  const origin = routeNodes[0];
  const destination = routeNodes[routeNodes.length - 1];

  return {
    mode: "EVACUATION",
    origin: {
      nodeId: origin.id,
      label: origin.label ?? null,
      floorNumber: origin.floor,
    },
    destination: {
      nodeId: destination.id,
      label: destination.label ?? null,
      floorNumber: destination.floor,
      poi: null,
    },
    accessible: false,
    accessibleRouteUnavailable: false,
    totalDistancePx: segments.reduce((sum, s) => sum + s.distancePx, 0),
    totalDistanceMeters: null,
    segments,
    transitions: builtTransitions,
    steps,
  };
}

function buildSegment(
  index: number,
  nodes: LegacyRouteNode[],
): AssembledRoute["segments"][number] {
  let distancePx = 0;
  for (let i = 1; i < nodes.length; i++) {
    distancePx += Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y);
  }
  return {
    index,
    floor: null,
    nodes: nodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      type: toNodeType(n.type),
      label: n.label ?? null,
    })),
    distancePx: Math.round(distancePx),
    distanceMeters: null,
  };
}
