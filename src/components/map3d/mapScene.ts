/* ============================================================================
   MapScene — the imperative WebGL core behind Map3D.
   ----------------------------------------------------------------------------
   Owns the renderer, scene graph, camera rig, and the render-on-demand loop:
   frames are drawn only while the camera is settling, an animation is live,
   or something changed — an idle 3D map costs ~zero CPU. Follows the
   lightRays.tsx lifecycle rules: dpr ≤ 2, quiet context-loss handling,
   loseContext() on dispose.
   ========================================================================= */

import * as THREE from 'three';
import type { MapPoint } from '../map/mapSpace';
import { rayToMapPoint } from './geometry3d';
import { buildScene, type BuiltScene } from './meshFactory';
import { CameraRig, type RigMode, type StackBounds } from './cameraRig';
import { pickFromIntersections, type PickTag } from './picking';
import { watchTheme } from './theme3d';
import type { SceneSpec } from './sceneBuilder';

export interface MapSceneOptions {
  mode: RigMode;
  /** Called when WebGL dies at runtime (context loss) — flip back to 2D. */
  onUnavailable?: () => void;
  /** Disable all continuous animations (reduced motion). */
  animationsEnabled?: boolean;
}

export class MapScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private built: BuiltScene | null = null;
  private lastSpec: SceneSpec | null = null;
  private frameHandle: number | null = null;
  private startTime = performance.now();
  private needsRender = true;
  private hasAnimations = false;
  private readonly animationsEnabled: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly unwatchTheme: () => void;
  private readonly resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private readonly container: HTMLElement;
  private readonly options: MapSceneOptions;

  constructor(container: HTMLElement, options: MapSceneOptions) {
    this.container = container;
    this.options = options;
    this.animationsEnabled = options.animationsEnabled ?? true;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    container.appendChild(this.canvas);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'default',
      });
    } catch {
      this.renderer = null;
    }
    if (!this.renderer) {
      options.onUnavailable?.();
      this.rig = new CameraRig(this.canvas, options.mode);
      this.unwatchTheme = () => {};
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.rig = new CameraRig(this.canvas, options.mode);
    this.rig.controls.addEventListener('change', () => this.invalidate());

    // Lights: one soft key + hemisphere fill — flat, clean, no shadows.
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(0.6, 1, 0.4);
    this.scene.add(hemisphere, key);

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);

    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(container);
    this.resize();

    // Theme flip → rebuild with freshly resolved colors (rare event; a full
    // rebuild is simpler and safer than tracking every material's token).
    this.unwatchTheme = watchTheme(() => {
      if (this.lastSpec) this.setSpec(this.lastSpec);
    });

    this.loop();
  }

  get controls() {
    return this.rig.mapControls;
  }

  get orbit() {
    return this.rig.controls;
  }

  setGestureEnabled(enabled: boolean): void {
    this.rig.setGestureEnabled(enabled);
  }

  /** Replace the scene contents; camera stays put unless refit() is called. */
  setSpec(spec: SceneSpec): void {
    if (this.disposed) return;
    this.lastSpec = spec;
    if (this.built) {
      this.scene.remove(this.built.group);
      this.built.dispose();
      this.built = null;
    }
    this.built = buildScene(spec);
    this.scene.add(this.built.group);
    this.hasAnimations = this.animationsEnabled && this.built.tick(0);
    // Active floor plane for pointer projection = the non-ghost floor.
    const active = spec.floors.find((f) => !f.ghost) ?? spec.floors[0];
    if (active) this.rig.setActiveElevation(active.elevation);
    this.setClearColor();
    this.invalidate();
  }

  /** Frame the camera to the current spec's bounds (initial mount / reset). */
  refit(): void {
    if (!this.lastSpec || this.lastSpec.floors.length === 0) return;
    const bounds: StackBounds = {
      width: Math.max(...this.lastSpec.floors.map((f) => f.spaceWidth)),
      height: Math.max(...this.lastSpec.floors.map((f) => f.spaceHeight)),
      minElevation: Math.min(...this.lastSpec.floors.map((f) => f.elevation)),
      maxElevation: Math.max(
        ...this.lastSpec.floors.map((f) => f.elevation + f.wallHeight),
      ),
    };
    this.rig.fit(bounds);
    this.invalidate();
  }

  /** MapSurfaceApi.projectPointer — ray ∩ active floor plane. */
  projectPointer(clientX: number, clientY: number): MapPoint | null {
    const raycaster = this.rig.pointerRay(clientX, clientY, this.canvas);
    if (!raycaster) return null;
    return rayToMapPoint(
      {
        origin: raycaster.ray.origin,
        direction: raycaster.ray.direction,
      },
      this.rig.getActiveElevation(),
    );
  }

  /** MapSurfaceApi.pick — topmost tagged entity under the pointer. */
  pick(clientX: number, clientY: number): PickTag | null {
    if (!this.built) return null;
    const raycaster = this.rig.pointerRay(clientX, clientY, this.canvas);
    if (!raycaster) return null;
    return pickFromIntersections(raycaster.intersectObjects(this.built.group.children, true));
  }

  invalidate(): void {
    this.needsRender = true;
  }

  private tween: {
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;

  /**
   * Glide the orbit target (camera follows, keeping its offset) to a world
   * point — how the route view chases the active step. Under reduced motion
   * the move is an instant cut.
   */
  flyTo(point: { x: number; y: number; z: number }, duration = 700): void {
    const to = new THREE.Vector3(point.x, point.y, point.z);
    if (!this.animationsEnabled || duration <= 0) {
      const offset = this.rig.camera.position.clone().sub(this.rig.controls.target);
      this.rig.controls.target.copy(to);
      this.rig.camera.position.copy(to).add(offset);
      this.rig.controls.update();
      this.invalidate();
      return;
    }
    this.tween = {
      fromTarget: this.rig.controls.target.clone(),
      toTarget: to,
      start: performance.now(),
      duration,
    };
    this.invalidate();
  }

  private advanceTween(): boolean {
    if (!this.tween) return false;
    const { fromTarget, toTarget, start, duration } = this.tween;
    const raw = Math.min((performance.now() - start) / duration, 1);
    const eased = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
    const offset = this.rig.camera.position.clone().sub(this.rig.controls.target);
    this.rig.controls.target.copy(fromTarget.clone().lerp(toTarget, eased));
    this.rig.camera.position.copy(this.rig.controls.target).add(offset);
    this.rig.controls.update();
    if (raw >= 1) this.tween = null;
    return true;
  }

  private setClearColor(): void {
    // Transparent canvas — the container's themed background shows through,
    // matching the 2D map's surface styling for free.
    this.renderer?.setClearColor(0x000000, 0);
  }

  private resize(): void {
    if (!this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / height);
    this.invalidate();
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    this.options.onUnavailable?.();
  };

  private loop = () => {
    if (this.disposed || !this.renderer) return;
    const tweening = this.advanceTween();
    const damping = this.rig.update();
    if (this.hasAnimations) {
      this.built?.tick((performance.now() - this.startTime) / 1000);
    }
    if (this.needsRender || damping || this.hasAnimations || tweening) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.rig.camera);
    }
    this.frameHandle = requestAnimationFrame(this.loop);
  };

  dispose(): void {
    this.disposed = true;
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.unwatchTheme();
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    if (this.built) {
      this.scene.remove(this.built.group);
      this.built.dispose();
    }
    this.rig.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.getContext()?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.canvas.remove();
  }
}
