/* ============================================================================
   Shared map renderer — domain types.
   ----------------------------------------------------------------------------
   These mirror the backend wayfinding API exactly (see
   alertup_backend/src/features/wayfinding/routeAssembler.js). AssembledRoute is
   the wire contract: the renderer consumes what the assembler emits, field for
   field, so a shape change on either side is a breaking change on both.
   ========================================================================= */

export type NodeType =
  | 'NORMAL'
  | 'ENTRANCE'
  | 'TRANSIT'
  | 'POI'
  | 'EMERGENCY_EXIT';

export type TransitType = 'WALKWAY' | 'ELEVATOR' | 'ESCALATOR' | 'STAIRS';

/** A graph node positioned in floor map coordinates (viewBox units). */
export interface MapNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label: string | null;
  floorId?: string;
  floorNumber?: number;
}

/** A traversable connection between two nodes. */
export interface MapEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  transitType: TransitType;
  accessible: boolean;
  distance?: number;
  weight?: number;
}

/** Full floor record, including inline SVG markup when the map is vector. */
export interface FloorRecord {
  id: string;
  floorNumber: number;
  name: string | null;
  mapImageUrl: string | null;
  svgContent?: string | null;
  width: number | null;
  height: number | null;
  scalePixelsPerMeter: number | null;
}

/** The floor metadata embedded per route segment (no svgContent). */
export interface FloorSummary {
  id: string;
  floorNumber: number;
  name: string | null;
  mapImageUrl: string | null;
  width: number | null;
  height: number | null;
  scalePixelsPerMeter: number | null;
}

/** A point of interest anchored to a graph node. */
export interface Poi {
  id: string;
  nodeId: string;
  name: string;
  category: string | null;
  description?: string | null;
  keywords: string[];
}

/** One step node within a route segment, as emitted by the assembler. */
export interface RouteNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label: string | null;
}

/** A contiguous same-floor walking stretch of an assembled route. */
export interface RouteSegment {
  index: number;
  floor: FloorSummary | null;
  nodes: RouteNode[];
  distancePx: number;
  distanceMeters: number | null;
}

/** A cross-floor hop between two consecutive segments. */
export interface RouteTransition {
  afterSegmentIndex: number;
  transitType: TransitType;
  fromFloorNumber: number;
  toFloorNumber: number;
  fromNodeId: string;
  toNodeId: string;
  direction: 'up' | 'down' | 'same';
  label: string | null;
}

/** Flat feed for the stepper UI: walk → transit → walk → ... → arrive. */
export type RouteStep =
  | { kind: 'walk'; segmentIndex: number }
  | { kind: 'transit'; transitionIndex: number }
  | { kind: 'arrive' };

export interface RouteEndpoint {
  nodeId: string;
  label: string | null;
  floorNumber: number;
}

export interface RouteDestination extends RouteEndpoint {
  poi: Pick<Poi, 'id' | 'name' | 'category'> | null;
}

/** The complete route response — the backend routeAssembler output. */
export interface AssembledRoute {
  mode: 'WAYFINDING' | 'EVACUATION';
  origin: RouteEndpoint;
  destination: RouteDestination;
  accessible: boolean;
  accessibleRouteUnavailable: boolean;
  totalDistancePx: number;
  totalDistanceMeters: number | null;
  segments: RouteSegment[];
  transitions: RouteTransition[];
  steps: RouteStep[];
}
