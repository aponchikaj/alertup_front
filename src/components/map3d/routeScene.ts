/* ============================================================================
   Route scene — an AssembledRoute becomes a stacked 3D building with the
   path threaded through it.
   ----------------------------------------------------------------------------
   Pure and three-free. The route payload already ships every touched floor's
   drawing inline (routeAssembler contract), so no extra fetches: floors
   stack at their elevations, the active segment's floor renders solid while
   the others ghost, and each cross-floor transition becomes a vertical
   connector — "take the stairs to floor 3" as geometry instead of prose.

   cameraTargetForStep gives the camera a world point per stepper position,
   so advancing the route glides the view to where the action is.
   ========================================================================= */

import type { AssembledRoute, RouteStep } from '../map/types';
import type { RouteTone } from '../map/mapTheme';
import { stackFloors, wallHeightFor, type FloorLevel } from './geometry3d';
import { buildFloorSpec, type SceneSpec, type ConnectorSpec, type FloorSpec } from './sceneBuilder';

export interface RouteSceneInput {
  route: AssembledRoute;
  /** Index into route.steps — from useRouteProgress. */
  activeStepIndex: number;
  tone?: RouteTone;
  animated?: boolean;
  /** The visitor's current position (drawn on its floor when known). */
  userDot?: { x: number; y: number; floorId: string } | null;
}

export interface RouteScene {
  spec: SceneSpec;
  levels: FloorLevel[];
  /** The floor the active step happens on (transit steps: the departure floor). */
  activeFloorId: string | null;
}

const levelFor = (levels: FloorLevel[], floorId: string | null | undefined): FloorLevel | null =>
  levels.find((l) => l.floorId === floorId) ?? null;

/** Which segment a step refers to (transit steps map to their departure). */
function segmentIndexForStep(route: AssembledRoute, stepIndex: number): number {
  const step: RouteStep | undefined = route.steps[stepIndex];
  if (!step) return route.segments.length - 1;
  if (step.kind === 'walk') return step.segmentIndex;
  if (step.kind === 'transit') return route.transitions[step.transitionIndex]?.afterSegmentIndex ?? 0;
  return route.segments.length - 1; // arrive
}

export function buildRouteScene(input: RouteSceneInput): RouteScene {
  const { route, activeStepIndex, tone = route.mode === 'EVACUATION' ? 'danger' : 'brand' } = input;
  const animated = input.animated ?? true;

  // Unique floors, in the order their floorNumber stacks them.
  const floorsById = new Map<string, NonNullable<AssembledRoute['segments'][number]['floor']>>();
  for (const segment of route.segments) {
    if (segment.floor && !floorsById.has(segment.floor.id)) {
      floorsById.set(segment.floor.id, segment.floor);
    }
  }
  const floorList = [...floorsById.values()];
  if (floorList.length === 0) {
    return { spec: { floors: [] }, levels: [], activeFloorId: null };
  }

  const wallHeight = wallHeightFor(floorList[0].scalePixelsPerMeter);
  const levels = stackFloors(
    floorList.map((f) => ({ id: f.id, floorNumber: f.floorNumber })),
    wallHeight,
  );

  const activeSegmentIndex = segmentIndexForStep(route, activeStepIndex);
  const activeFloorId = route.segments[activeSegmentIndex]?.floor?.id ?? null;

  // One FloorSpec per floor; a floor revisited by several segments carries
  // all its route legs.
  const floors: FloorSpec[] = floorList.map((floor) => {
    const level = levelFor(levels, floor.id);
    const segments = route.segments.filter((s) => s.floor?.id === floor.id);
    const first = segments[0] ?? null;
    const spec = buildFloorSpec({
      floorId: floor.id,
      floorNumber: floor.floorNumber,
      elevation: level?.elevation ?? 0,
      ghost: floor.id !== activeFloorId,
      spaceWidth: floor.width && floor.width > 0 ? floor.width : 1000,
      spaceHeight: floor.height && floor.height > 0 ? floor.height : 800,
      scalePixelsPerMeter: floor.scalePixelsPerMeter,
      drawing: floor.drawing ?? null,
      routeSegment: first,
      routeTone: tone,
      routeAnimated: animated && floor.id === activeFloorId,
      userDot:
        input.userDot && input.userDot.floorId === floor.id
          ? { x: input.userDot.x, y: input.userDot.y }
          : null,
    });
    for (const segment of segments.slice(1)) {
      if (segment.nodes.length >= 2) {
        spec.routes.push({
          points: segment.nodes.map((n) => ({ x: n.x, y: n.y })),
          colorToken: spec.routes[0]?.colorToken ?? 'var(--brand)',
          animated: false,
        });
      }
    }
    return spec;
  });

  // Transitions → vertical connectors between the two nodes' positions.
  const activeStep = route.steps[activeStepIndex];
  const connectors: ConnectorSpec[] = [];
  route.transitions.forEach((transition, index) => {
    const fromSegment = route.segments[transition.afterSegmentIndex];
    const toSegment = route.segments[transition.afterSegmentIndex + 1];
    const fromNode = fromSegment?.nodes.find((n) => n.id === transition.fromNodeId)
      ?? fromSegment?.nodes[fromSegment.nodes.length - 1];
    const toNode = toSegment?.nodes.find((n) => n.id === transition.toNodeId) ?? toSegment?.nodes[0];
    const fromLevel = levelFor(levels, fromSegment?.floor?.id);
    const toLevel = levelFor(levels, toSegment?.floor?.id);
    if (!fromNode || !toNode || !fromLevel || !toLevel) return;
    connectors.push({
      key: `transition-${index}`,
      fromX: fromNode.x,
      fromY: fromNode.y,
      fromElevation: fromLevel.elevation,
      toX: toNode.x,
      toY: toNode.y,
      toElevation: toLevel.elevation,
      direction: transition.direction,
      colorToken: 'var(--info)',
      active: activeStep?.kind === 'transit' && activeStep.transitionIndex === index,
    });
  });

  return { spec: { floors, connectors }, levels, activeFloorId };
}

/** World-space point the camera should glide to for a given step. */
export function cameraTargetForStep(
  route: AssembledRoute,
  stepIndex: number,
  levels: FloorLevel[],
): { x: number; y: number; z: number } | null {
  const step = route.steps[stepIndex];
  if (!step) return null;

  if (step.kind === 'transit') {
    const transition = route.transitions[step.transitionIndex];
    if (!transition) return null;
    const fromSegment = route.segments[transition.afterSegmentIndex];
    const toSegment = route.segments[transition.afterSegmentIndex + 1];
    const fromNode = fromSegment?.nodes[fromSegment.nodes.length - 1];
    const toNode = toSegment?.nodes[0];
    const fromLevel = levelFor(levels, fromSegment?.floor?.id);
    const toLevel = levelFor(levels, toSegment?.floor?.id);
    if (!fromNode || !toNode || !fromLevel || !toLevel) return null;
    // Midpoint of the connector — frames both floors and the vertical hop.
    return {
      x: (fromNode.x + toNode.x) / 2,
      y: (fromLevel.elevation + toLevel.elevation) / 2,
      z: (fromNode.y + toNode.y) / 2,
    };
  }

  const segmentIndex =
    step.kind === 'walk' ? step.segmentIndex : route.segments.length - 1;
  const segment = route.segments[segmentIndex];
  const level = levelFor(levels, segment?.floor?.id);
  if (!segment || segment.nodes.length === 0 || !level) return null;

  if (step.kind === 'arrive') {
    const last = segment.nodes[segment.nodes.length - 1];
    return { x: last.x, y: level.elevation, z: last.y };
  }

  // Walk: center of the segment's bounding box.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of segment.nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }
  return { x: (minX + maxX) / 2, y: level.elevation, z: (minY + maxY) / 2 };
}
