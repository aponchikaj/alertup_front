/* Barrel for the shared map renderer. Import from here, not from the
   individual modules, so the surface stays swappable. */

export { MapCanvas } from './MapCanvas';
export type { MapCanvasProps } from './MapCanvas';

export { useMapCamera } from './useMapCamera';
export type {
  MapCameraHandlers,
  MapCameraControls,
  UseMapCameraOptions,
  UseMapCameraResult,
} from './useMapCamera';

export {
  DEFAULT_FLOOR_SPACE,
  DEFAULT_SCALE_BOUNDS,
  IDENTITY_CAMERA,
  clampScale,
  screenToMap,
  mapToView,
  viewToMap,
  zoomAt,
  panBy,
  fitCamera,
  centerOn,
} from './mapSpace';
export type { Camera, FloorSpace, MapPoint, ScaleBounds } from './mapSpace';

export {
  NODE_THEME,
  NODE_GLYPH_PATHS,
  TRANSIT_GLYPH_PATHS,
  ROUTE_TONES,
  CURRENT_LOCATION_COLOR,
} from './mapTheme';
export type { NodeGlyph, NodeTheme, RouteTone } from './mapTheme';

export { FloorImageLayer } from './layers/FloorImageLayer';
export { EdgeLayer } from './layers/EdgeLayer';
export { NodeLayer } from './layers/NodeLayer';
export { RouteLayer } from './layers/RouteLayer';
export { UserDotLayer } from './layers/UserDotLayer';
export { PoiLayer } from './layers/PoiLayer';

export type {
  NodeType,
  TransitType,
  MapNode,
  MapEdge,
  FloorRecord,
  FloorSummary,
  Poi,
  RouteNode,
  RouteSegment,
  RouteTransition,
  RouteStep,
  RouteEndpoint,
  RouteDestination,
  AssembledRoute,
} from './types';
