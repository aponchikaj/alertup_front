/* ============================================================================
   Camera rig — perspective camera + constrained orbit controls.
   ----------------------------------------------------------------------------
   Perspective (fov 45) is what makes the extrusion read as a building; the
   polar angle is clamped so the camera can never dive under the slab. The rig
   also adapts the 2D map's MapCameraControls verbs (zoomIn/out/reset/centerOn)
   onto orbit moves, so existing toolbar buttons work against either surface.

   Gesture assignment differs by mode:
     viewer — one finger / left-drag ROTATES (look around the model)
     editor — one finger / left-drag PANS (2D muscle memory; rotate is
              right-drag / two fingers). Tools can disable the controls
              mid-gesture via setGestureEnabled(false).
   ========================================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MapCameraControls } from '../map/useMapCamera';
import type { MapPoint } from '../map/mapSpace';
import { fitToBounds, DOLLY_MIN_RATIO, DOLLY_MAX_RATIO, type FitFrame } from './geometry3d';

export type RigMode = 'viewer' | 'editor';

const FOV_DEGREES = 45;
const MIN_POLAR = 0.1;
const MAX_POLAR = 1.32; // ~76° from vertical — never under the slab

export interface StackBounds {
  width: number;
  height: number;
  minElevation: number;
  maxElevation: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly mapControls: MapCameraControls;
  private fitFrame: FitFrame | null = null;
  private bounds: StackBounds | null = null;
  private activeElevation = 0;

  constructor(canvas: HTMLCanvasElement, mode: RigMode) {
    this.camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 1, 100_000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minPolarAngle = MIN_POLAR;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.screenSpacePanning = false; // pan slides along the ground

    if (mode === 'viewer') {
      this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    }

    this.mapControls = {
      zoomIn: () => this.dolly(1 / 1.25),
      zoomOut: () => this.dolly(1.25),
      reset: () => this.reset(),
      centerOn: (point: MapPoint) => this.centerOn(point),
    };
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect > 0 ? aspect : 1;
    this.camera.updateProjectionMatrix();
  }

  /** The floor plane pointer projection targets (world Y of the active slab). */
  setActiveElevation(elevation: number): void {
    this.activeElevation = elevation;
  }

  getActiveElevation(): number {
    return this.activeElevation;
  }

  /** Frame the given stack bounds and make that the reset pose. */
  fit(bounds: StackBounds): void {
    this.bounds = bounds;
    const frame = fitToBounds(
      bounds,
      (this.camera.fov * Math.PI) / 180,
      this.camera.aspect,
    );
    this.fitFrame = frame;
    const fitDistance = new THREE.Vector3(
      frame.position.x - frame.target.x,
      frame.position.y - frame.target.y,
      frame.position.z - frame.target.z,
    ).length();
    this.controls.minDistance = fitDistance * DOLLY_MIN_RATIO;
    this.controls.maxDistance = fitDistance * DOLLY_MAX_RATIO;
    this.reset();
  }

  reset(): void {
    if (!this.fitFrame) return;
    const { position, target } = this.fitFrame;
    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
  }

  /** Keep the current offset, glide the target over a map point. */
  centerOn(point: MapPoint): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(point.x, this.activeElevation, point.y);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  private dolly(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  /** Tools call this to freeze/unfreeze the camera during a capture gesture. */
  setGestureEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  /** Advance damping; returns true while the camera is still settling. */
  update(): boolean {
    return this.controls.update();
  }

  /** World-space pointer ray for a client position over the given canvas. */
  pointerRay(clientX: number, clientY: number, canvas: HTMLCanvasElement): THREE.Raycaster | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    return raycaster;
  }

  dispose(): void {
    this.controls.dispose();
  }

  getBounds(): StackBounds | null {
    return this.bounds;
  }
}
