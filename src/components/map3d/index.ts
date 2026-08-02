/* ============================================================================
   map3d barrel — the ONLY import surface for the 3D map.
   ----------------------------------------------------------------------------
   Consumers must reach this module through dynamic import (React.lazy) so the
   three.js chunk stays out of the main bundle:

     const Map3D = lazy(() => import('../components/map3d'));

   The support probe is exported separately from useMap3dSupport (it has no
   three imports) so pages can decide whether to OFFER 3D without loading it.
   ========================================================================= */

export { Map3D, default } from './Map3D';
export type { Map3DProps, Map3DFloorInput } from './Map3D';
export { buildFloorSpec } from './sceneBuilder';
export type { SceneSpec, FloorSpec } from './sceneBuilder';
