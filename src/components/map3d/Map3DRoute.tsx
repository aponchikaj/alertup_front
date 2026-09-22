import { useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/cn';
import type { AssembledRoute } from '../map/types';
import type { RouteTone } from '../map/mapTheme';
import { buildRouteScene, cameraTargetForStep } from './routeScene';
import { MapScene } from './mapScene';

/* ============================================================================
   Map3DRoute — the whole journey as one stacked building.
   ----------------------------------------------------------------------------
   Where the 2D route view shows one floor at a time and asks the visitor to
   imagine the rest, this shows every floor the route touches, stacked, with
   the vertical hop drawn as a connector between them. Advancing the stepper
   glides the camera to the active leg — "I've arrived on floor 3" becomes
   something you can see happen.
   ========================================================================= */

export interface Map3DRouteProps {
  route: AssembledRoute;
  /** Index into route.steps, from useRouteProgress. */
  activeStepIndex: number;
  tone?: RouteTone;
  userDot?: { x: number; y: number; floorId: string } | null;
  onUnavailable?: () => void;
  className?: string;
  ariaLabel?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Map3DRoute = ({
  route,
  activeStepIndex,
  tone,
  userDot = null,
  onUnavailable,
  className,
  ariaLabel,
}: Map3DRouteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const fittedRef = useRef(false);

  const routeScene = useMemo(
    () =>
      buildRouteScene({
        route,
        activeStepIndex,
        tone,
        animated: !prefersReducedMotion(),
        userDot,
      }),
    [route, activeStepIndex, tone, userDot],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const scene = new MapScene(container, {
      mode: 'viewer',
      onUnavailable,
      animationsEnabled: !prefersReducedMotion(),
    });
    sceneRef.current = scene;
    fittedRef.current = false;
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setSpec(routeScene.spec);
    if (!fittedRef.current && routeScene.spec.floors.length > 0) {
      fittedRef.current = true;
      scene.refit();
    }
  }, [routeScene]);

  // Step changes chase the action.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const target = cameraTargetForStep(route, activeStepIndex, routeScene.levels);
    if (target) scene.flyTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStepIndex, route]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      data-testid="map3d-route"
      className={cn(
        'relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface-2',
        className,
      )}
    />
  );
};

export default Map3DRoute;
