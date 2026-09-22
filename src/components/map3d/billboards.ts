/* ============================================================================
   Billboard sprites — text and glyphs as canvas textures.
   ----------------------------------------------------------------------------
   Labels, icon markers and node glyphs render as camera-facing sprites whose
   textures are drawn on 2D canvases. Icons stroke the EXACT same 24-grid SVG
   path strings the 2D map uses (via Path2D), so a lift marker in 3D is a
   pixel-cousin of the one in 2D — the drawing stays a legend for the route.

   Every factory returns { sprite, dispose } — textures are GPU resources and
   the caller (meshFactory) tracks disposal.
   ========================================================================= */

import * as THREE from 'three';

const DPR = () => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);

export interface SpriteHandle {
  sprite: THREE.Sprite;
  dispose: () => void;
}

const makeSprite = (canvas: HTMLCanvasElement, worldHeight: number): SpriteHandle => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  return {
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
};

/**
 * Text label sprite. `worldHeight` is the label's height in map units —
 * labels scale with the plan (matching the 2D map, whose labels live in map
 * units and hide when zoomed far out).
 */
export function makeLabelSprite(
  text: string,
  color: string,
  worldHeight: number,
  options: { haloColor?: string; fontWeight?: number } = {},
): SpriteHandle {
  const dpr = DPR();
  const fontPx = 32 * dpr;
  const font = `${options.fontWeight ?? 600} ${fontPx}px system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  let textWidth = fontPx * text.length * 0.6;
  if (measure) {
    measure.font = font;
    textWidth = measure.measureText(text).width;
  }
  const pad = fontPx * 0.35;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(textWidth + pad * 2);
  canvas.height = Math.ceil(fontPx * 1.4);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Halo first — the 3D analog of the SVG paintOrder:stroke halo labels.
    if (options.haloColor) {
      ctx.lineWidth = fontPx * 0.22;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = options.haloColor;
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  return makeSprite(canvas, worldHeight);
}

/**
 * Icon marker sprite: circular plate + stroked 24-grid glyph path, matching
 * DrawingLayer's plate-circle + Glyph rendering.
 */
export function makeIconSprite(
  glyphPath: string,
  glyphColor: string,
  plateColor: string,
  worldSize: number,
  rotationDeg = 0,
): SpriteHandle {
  const dpr = DPR();
  const px = 96 * dpr; // 24-grid × 4 for crispness
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(px / 2, px / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    // Plate.
    ctx.beginPath();
    ctx.arc(0, 0, px * 0.47, 0, Math.PI * 2);
    ctx.fillStyle = plateColor;
    ctx.fill();
    // Glyph: stroke the shared 24-grid path scaled to ~70% of the plate.
    const scale = (px * 0.7) / 24;
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = glyphColor;
    ctx.stroke(new Path2D(glyphPath));
  }
  return makeSprite(canvas, worldSize);
}
