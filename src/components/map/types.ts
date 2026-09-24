/* ============================================================================
   Shared map renderer — domain types.
   ----------------------------------------------------------------------------
   These mirror the backend wayfinding API exactly (see
   alertup_backend/src/features/wayfinding/routeAssembler.js). AssembledRoute is
   the wire contract: the renderer consumes what the assembler emits, field for
   field, so a shape change on either side is a breaking change on both.
   ========================================================================= */

import type { FloorDrawing } from './drawing';

export type NodeType =
  | 'NORMAL'
  | 'ENTRANCE'
  | 'TRANSIT'
  | 'POI'
  | 'EMERGENCY_EXIT';

export type TransitType = 'WALKWAY' | 'ELEVATOR' | 'ESCALATOR' | 'STAIRS';

/** Routing strategy requested from the wayfinding engine. */
export type RouteProfile =
  | 'walk'
  | 'wheelchair'
  | 'elevator_first'
  | 'min_floor_changes'
  | 'emergency';

export const ROUTE_PROFILES: readonly RouteProfile[] = [
  'walk',
  'wheelchair',
  'elevator_first',
  'min_floor_changes',
  'emergency',
] as const;

/** Which way an edge may be traversed. */
export type EdgeDirection = 'BOTH' | 'FORWARD' | 'REVERSE';

/** Turn-by-turn instruction category, as emitted by the instruction builder. */
export type InstructionKind =
  | 'depart'
  | 'straight'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'uturn'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'transit'
  | 'arrive';

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
  direction?: EdgeDirection;
  tags?: string[];
}

/** Full floor record, including inline SVG markup when the map is vector. */
export interface FloorRecord {
  id: string;
  floorNumber: number;
  name: string | null;
  mapImageUrl: string | null;
  svgContent?: string | null;
  /** Hand-drawn plan authored in the editor; parse with parseDrawing. */
  drawing?: FloorDrawing | null;
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
  /** Drawn plans travel with the segment so the visitor map needs no refetch. */
  drawing?: FloorDrawing | null;
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
  externalId?: string;
  aliases?: string[];
}

/** One step node within a route segment, as emitted by the assembler. */
export interface RouteNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label: string | null;
}

/** A precise point along a segment's walking path (finer than its nodes). */
export interface RoutePoint {
  x: number;
  y: number;
  nodeId?: string;
}

/** A contiguous same-floor walking stretch of an assembled route. */
export interface RouteSegment {
  index: number;
  floor: FloorSummary | null;
  nodes: RouteNode[];
  distancePx: number;
  distanceMeters: number | null;
  points?: RoutePoint[];
  distanceM?: number;
  durationSec?: number;
  accessible?: boolean;
  scaleAssumed?: boolean;
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

/** Per-step timing/distance, added to every RouteStep variant without
 *  disturbing the `kind` discriminant narrowing. */
interface RouteStepExtras {
  distanceM?: number;
  durationSec?: number;
  distanceUntilM?: number;
  timeUntilSec?: number;
  accessible?: boolean;
}

/** Flat feed for the stepper UI: walk → transit → walk → ... → arrive. */
export type RouteStep = RouteStepExtras &
  (
    | { kind: 'walk'; segmentIndex: number }
    | { kind: 'transit'; transitionIndex: number }
    | { kind: 'arrive' }
  );

export interface RouteEndpoint {
  nodeId: string;
  label: string | null;
  floorNumber: number;
}

export interface RouteDestination extends RouteEndpoint {
  poi: Pick<Poi, 'id' | 'name' | 'category'> | null;
}

/** A nearby POI called out in an instruction ("past the Coffee Bar"). */
export interface RouteLandmark {
  poiId: string;
  name: string;
  relation: 'before' | 'after' | 'at';
  /** Required: the stepper always says which side, so the builder always sends
   *  a landmark with one rather than a half-useful "past the Coffee Bar". */
  side: 'left' | 'right';
}

/** One turn-by-turn instruction, bilingual by construction. */
export interface RouteInstruction {
  index: number;
  kind: InstructionKind;
  distanceM: number;
  durationSec: number;
  segmentIndex: number;
  atNodeId?: string;
  at?: { x: number; y: number };
  landmark?: RouteLandmark;
  floorChange?: {
    fromFloorNumber: number;
    toFloorNumber: number;
    transitType: TransitType;
    direction: 'up' | 'down' | 'same';
  };
  stopIndex?: number;
  text: { en: string; ka: string };
}

/** A non-fatal issue with the route the visitor should know about. */
export interface RouteWarning {
  code: string;
  message: string;
  segmentIndex?: number;
  stepIndex?: number;
  transitionIndex?: number;
  distanceFromStartM?: number;
  floorIds?: string[];
}

/** An alternative evacuation exit, offered alongside the primary route. */
export interface RouteAlternative {
  exitNodeId: string;
  label: string;
  floorNumber: number;
  distanceM: number;
  durationSec: number;
  /** Lean: no floor.drawing, to keep the payload light. */
  route: AssembledRoute;
}

/**
 * A routing restriction in effect on part of the graph.
 *
 * `floorId` and `reason` mirror the backend's `publicClosure` verbatim
 * (`floorId: row.floorId ?? null`, `reason: row.reason ?? null`) — both
 * columns are nullable there, so neither can be typed as a plain `string`
 * here without lying to every consumer.
 */
export interface RouteClosure {
  id: string;
  floorId: string | null;
  reason: string | null;
  costMultiplier: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  blocked: boolean;
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
  profile?: RouteProfile;
  totalDistanceM?: number;
  totalDurationSec?: number;
  scaleAssumed?: boolean;
  tagConstraintsRelaxed?: boolean;
  warnings?: RouteWarning[];
  alternatives?: RouteAlternative[];
  instructions?: RouteInstruction[];
  closures?: RouteClosure[];
}
