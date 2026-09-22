/* ============================================================================
   Mesh factory — SceneSpec in, THREE.Group out.
   ----------------------------------------------------------------------------
   The dumb half of the renderer: sceneBuilder decided WHAT exists; this
   module instantiates it. All placement math beyond simple centering lives in
   geometry3d, so nothing here needs unit tests — it is a 1:1 transcription.

   Axis mapping (see geometry3d): map (x, y) → world (x, elevation, y).
   Shapes extrude DOWN from their surface (slab top = elevation), so the top
   faces sit exactly at the spec'd elevations.

   Dispose discipline: every geometry/material/texture created here is
   tracked; build() returns { group, dispose } and the caller must call
   dispose before dropping the group — WebGL resources do not garbage-collect.
   ========================================================================= */

import * as THREE from 'three';
import { DRAWING_ICON_PATHS, NODE_GLYPH_PATHS } from '../map/mapTheme';
import { resolveColor, type CssVarReader } from './theme3d';
import { makeIconSprite, makeLabelSprite } from './billboards';
import type { FloorSpec, SceneSpec } from './sceneBuilder';

export interface BuiltScene {
  group: THREE.Group;
  dispose: () => void;
  /** Per-frame hook: advances route march / user-dot pulse. */
  tick: (elapsedSeconds: number) => boolean;
}

/** Ghosted (inactive) floor opacity. */
const GHOST_OPACITY = 0.15;

const NODE_DISC_RADIUS = 10;
const NODE_DISC_HEIGHT = 3;
const NODE_HIT_RADIUS = 16;
const EDGE_LIFT = 4;
const ROUTE_LIFT = 6;

class Resources {
  geometries: THREE.BufferGeometry[] = [];
  materials: THREE.Material[] = [];
  sprites: Array<() => void> = [];

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  mat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const d of this.sprites) d();
    this.geometries = [];
    this.materials = [];
    this.sprites = [];
  }
}

/** Invisible-but-raycastable material for fat hit targets. */
const hitMaterial = (res: Resources) =>
  res.mat(
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );

const polygonShape = (points: number[]): THREE.Shape => {
  const shape = new THREE.Shape();
  shape.moveTo(points[0], points[1]);
  for (let i = 2; i + 1 < points.length; i += 2) {
    shape.lineTo(points[i], points[i + 1]);
  }
  shape.closePath();
  return shape;
};

function buildFloor(spec: FloorSpec, read: CssVarReader | undefined, res: Resources): THREE.Group {
  const floor = new THREE.Group();
  floor.name = `floor-${spec.floorId}`;
  floor.position.y = spec.elevation;
  const color = (token: string) => resolveColor(token, read);
  const animations: Array<(elapsed: number) => void> = [];

  /* Slab — extruded footprint polygon; ExtrudeGeometry grows along +z of the
     shape plane, so rotateX(+90°) maps shape (x, y, z) → world (x, -z, y):
     the slab body ends up BELOW its top surface, which sits at elevation. */
  {
    const geometry = res.geo(
      new THREE.ExtrudeGeometry(polygonShape(spec.slab.points), {
        depth: spec.slabThickness,
        bevelEnabled: false,
      }),
    );
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(
      geometry,
      res.mat(new THREE.MeshLambertMaterial({ color: color(spec.slab.fillToken) })),
    );
    mesh.userData.pick = { kind: 'canvas', floorId: spec.floorId };
    floor.add(mesh);

    // Rim line on the top edge.
    const rimPoints: THREE.Vector3[] = [];
    for (let i = 0; i + 1 < spec.slab.points.length; i += 2) {
      rimPoints.push(new THREE.Vector3(spec.slab.points[i], 0.5, spec.slab.points[i + 1]));
    }
    const rim = new THREE.LineLoop(
      res.geo(new THREE.BufferGeometry().setFromPoints(rimPoints)),
      res.mat(new THREE.LineBasicMaterial({ color: color(spec.slab.rimToken), transparent: true, opacity: 0.7 })),
    );
    floor.add(rim);
  }

  /* Grid (editor) — minor/major line segments on the slab top. */
  if (spec.grid) {
    const minor: number[] = [];
    const major: number[] = [];
    const g = spec.grid;
    for (let x = 0, i = 0; x <= g.width; x += g.step, i += 1) {
      (i % g.majorEvery === 0 ? major : minor).push(x, 1, 0, x, 1, g.height);
    }
    for (let y = 0, i = 0; y <= g.height; y += g.step, i += 1) {
      (i % g.majorEvery === 0 ? major : minor).push(0, 1, y, g.width, 1, y);
    }
    for (const [coords, token, opacity] of [
      [minor, g.minorToken, 0.4],
      [major, g.majorToken, 0.5],
    ] as const) {
      const geometry = res.geo(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
      floor.add(
        new THREE.LineSegments(
          geometry,
          res.mat(new THREE.LineBasicMaterial({ color: color(token), transparent: true, opacity })),
        ),
      );
    }
  }

  /* Walls — one box per segment + one cylinder per joint, sharing a material. */
  for (const wall of spec.walls) {
    const material = res.mat(new THREE.MeshLambertMaterial({ color: color(wall.colorToken) }));
    for (const seg of wall.solid.segments) {
      const mesh = new THREE.Mesh(
        res.geo(new THREE.BoxGeometry(seg.length, spec.wallHeight, seg.thickness)),
        material,
      );
      mesh.position.set(seg.centerX, spec.wallHeight / 2, seg.centerY);
      mesh.rotation.y = seg.rotation;
      mesh.userData.pick = { kind: 'shape', shapeId: wall.shapeId };
      floor.add(mesh);
    }
    for (const joint of wall.solid.joints) {
      const mesh = new THREE.Mesh(
        res.geo(new THREE.CylinderGeometry(joint.radius, joint.radius, spec.wallHeight, 12)),
        material,
      );
      mesh.position.set(joint.x, spec.wallHeight / 2, joint.y);
      mesh.userData.pick = { kind: 'shape', shapeId: wall.shapeId };
      floor.add(mesh);
    }
  }

  /* Rooms & shops — low platforms with a top-edge outline. */
  for (const platform of spec.platforms) {
    const mesh = new THREE.Mesh(
      res.geo(new THREE.BoxGeometry(platform.width, spec.platformHeight, platform.height)),
      res.mat(new THREE.MeshLambertMaterial({ color: color(platform.fillToken) })),
    );
    mesh.position.set(
      platform.x + platform.width / 2,
      spec.platformHeight / 2,
      platform.y + platform.height / 2,
    );
    mesh.userData.pick = { kind: 'shape', shapeId: platform.shapeId };
    floor.add(mesh);

    const y = spec.platformHeight + 0.5;
    const outline = new THREE.LineLoop(
      res.geo(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(platform.x, y, platform.y),
          new THREE.Vector3(platform.x + platform.width, y, platform.y),
          new THREE.Vector3(platform.x + platform.width, y, platform.y + platform.height),
          new THREE.Vector3(platform.x, y, platform.y + platform.height),
        ]),
      ),
      res.mat(new THREE.LineBasicMaterial({ color: color(platform.strokeToken) })),
    );
    floor.add(outline);
  }

  /* Labels — billboard sprites floating above their shapes. */
  for (const label of spec.labels) {
    const handle = makeLabelSprite(label.text, color(label.colorToken), 26, {
      haloColor: color('var(--canvas)'),
    });
    res.sprites.push(handle.dispose);
    handle.sprite.position.set(label.x, label.lift + 12, label.y);
    floor.add(handle.sprite);
  }

  /* Icon markers. */
  for (const icon of spec.icons) {
    const handle = makeIconSprite(
      DRAWING_ICON_PATHS[icon.icon],
      color(icon.glyphToken),
      color('var(--surface)'),
      icon.size * 1.4,
      icon.rotation,
    );
    res.sprites.push(handle.dispose);
    handle.sprite.position.set(icon.x, spec.platformHeight + icon.size * 0.7, icon.y);
    floor.add(handle.sprite);

    const hit = new THREE.Mesh(
      res.geo(new THREE.SphereGeometry(icon.size * 0.7, 8, 8)),
      hitMaterial(res),
    );
    hit.position.copy(handle.sprite.position);
    hit.userData.pick = { kind: 'shape', shapeId: icon.shapeId };
    floor.add(hit);
  }

  /* Free-standing text. */
  for (const text of spec.texts) {
    const handle = makeLabelSprite(text.text, color(text.colorToken), text.fontSize * 1.6, {
      fontWeight: 400,
    });
    res.sprites.push(handle.dispose);
    handle.sprite.position.set(text.x, spec.platformHeight + text.fontSize, text.y);
    floor.add(handle.sprite);
  }

  /* Graph edges — dashed for vertical transit, matching the 2D language. */
  for (const edge of spec.edges) {
    const geometry = res.geo(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(edge.x1, EDGE_LIFT, edge.y1),
        new THREE.Vector3(edge.x2, EDGE_LIFT, edge.y2),
      ]),
    );
    const material = edge.dashed
      ? res.mat(
          new THREE.LineDashedMaterial({
            color: color(edge.colorToken),
            dashSize: 7,
            gapSize: 5,
          }),
        )
      : res.mat(new THREE.LineBasicMaterial({ color: color(edge.colorToken) }));
    const line = new THREE.Line(geometry, material);
    if (edge.dashed) line.computeLineDistances();
    floor.add(line);

    // Fat invisible hit cylinder along the segment (the 14-unit hit line).
    const length = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
    if (length > 0) {
      const hit = new THREE.Mesh(
        res.geo(new THREE.CylinderGeometry(14, 14, length, 6)),
        hitMaterial(res),
      );
      hit.position.set((edge.x1 + edge.x2) / 2, EDGE_LIFT, (edge.y1 + edge.y2) / 2);
      hit.rotation.z = Math.PI / 2;
      hit.rotation.y = -Math.atan2(edge.y2 - edge.y1, edge.x2 - edge.x1);
      hit.userData.pick = { kind: 'edge', edgeId: edge.edgeId };
      floor.add(hit);
    }
  }

  /* Nodes — disc + glyph sprite + optional label + fat hit sphere. */
  for (const node of spec.nodes) {
    const radius = node.selected ? 11 : node.hovered ? 10 : NODE_DISC_RADIUS;
    const disc = new THREE.Mesh(
      res.geo(new THREE.CylinderGeometry(radius, radius, NODE_DISC_HEIGHT, 20)),
      res.mat(new THREE.MeshLambertMaterial({ color: color(node.fillToken) })),
    );
    disc.position.set(node.x, NODE_DISC_HEIGHT / 2 + 1, node.y);
    disc.userData.pick = { kind: 'node', nodeId: node.nodeId };
    floor.add(disc);

    if (node.selected) {
      const ring = new THREE.Mesh(
        res.geo(new THREE.TorusGeometry(radius + 5, 1.2, 8, 32)),
        res.mat(new THREE.MeshBasicMaterial({ color: color('var(--ring)') })),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(node.x, 2, node.y);
      floor.add(ring);
    }

    if (node.glyph) {
      const handle = makeIconSprite(
        NODE_GLYPH_PATHS[node.glyph as keyof typeof NODE_GLYPH_PATHS],
        color('var(--canvas)'),
        color(node.fillToken),
        radius * 2.2,
      );
      res.sprites.push(handle.dispose);
      handle.sprite.position.set(node.x, NODE_DISC_HEIGHT + radius, node.y);
      floor.add(handle.sprite);
    }

    if (node.label) {
      const handle = makeLabelSprite(node.label, color('var(--ink)'), 22, {
        haloColor: color('var(--canvas)'),
      });
      res.sprites.push(handle.dispose);
      handle.sprite.position.set(node.x, NODE_DISC_HEIGHT + radius * 2 + 16, node.y);
      floor.add(handle.sprite);
    }

    const hit = new THREE.Mesh(
      res.geo(new THREE.SphereGeometry(NODE_HIT_RADIUS, 8, 8)),
      hitMaterial(res),
    );
    hit.position.set(node.x, NODE_HIT_RADIUS / 2, node.y);
    hit.userData.pick = { kind: 'node', nodeId: node.nodeId };
    floor.add(hit);
  }

  /* Routes — elevated lines; dashed layers march when animated. */
  for (const route of spec.routes) {
    const points = route.points.map((p) => new THREE.Vector3(p.x, ROUTE_LIFT, p.y));
    const casing = new THREE.Line(
      res.geo(new THREE.BufferGeometry().setFromPoints(points)),
      res.mat(
        new THREE.LineBasicMaterial({
          color: color('var(--canvas)'),
          transparent: true,
          opacity: 0.85,
          linewidth: 1,
        }),
      ),
    );
    floor.add(casing);
    const material = res.mat(
      new THREE.LineDashedMaterial({ color: color(route.colorToken), dashSize: 10, gapSize: 6 }),
    );
    const line = new THREE.Line(
      res.geo(new THREE.BufferGeometry().setFromPoints(points)),
      material,
    );
    line.computeLineDistances();
    floor.add(line);
    // End caps.
    const start = points[0];
    const end = points[points.length - 1];
    const capMaterial = res.mat(new THREE.MeshBasicMaterial({ color: color(route.colorToken) }));
    const startCap = new THREE.Mesh(res.geo(new THREE.SphereGeometry(5, 12, 12)), capMaterial);
    startCap.position.copy(start);
    floor.add(startCap);
    const endCap = new THREE.Mesh(res.geo(new THREE.SphereGeometry(7, 12, 12)), capMaterial);
    endCap.position.copy(end);
    floor.add(endCap);
    // March animation: LineDashedMaterial has no dashOffset — shifting the
    // computed line-distance attribute each tick gives the same crawl.
    if (route.animated) {
      const attribute = line.geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
      const base = Array.from(attribute.array as Float32Array);
      const cycle = 16; // dashSize + gapSize
      animations.push((elapsed) => {
        const offset = (elapsed * 24) % cycle;
        for (let i = 0; i < base.length; i += 1) attribute.setX(i, base[i] + offset);
        attribute.needsUpdate = true;
      });
    }
  }

  /* User dot — disc + pulsing ring. */
  if (spec.userDot) {
    const dotColor = color(spec.userDot.colorToken);
    const dot = new THREE.Mesh(
      res.geo(new THREE.CylinderGeometry(10, 10, 4, 20)),
      res.mat(new THREE.MeshBasicMaterial({ color: dotColor })),
    );
    dot.position.set(spec.userDot.x, 4, spec.userDot.y);
    floor.add(dot);
    const ringMaterial = res.mat(
      new THREE.MeshBasicMaterial({ color: dotColor, transparent: true, opacity: 0.5 }),
    );
    const ring = new THREE.Mesh(res.geo(new THREE.TorusGeometry(12, 1.4, 8, 32)), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(spec.userDot.x, 3, spec.userDot.y);
    floor.add(ring);
    animations.push((elapsed) => {
      const phase = (elapsed % 1.6) / 1.6;
      const scale = 1 + phase * 1.2;
      ring.scale.set(scale, scale, 1);
      ringMaterial.opacity = 0.5 * (1 - phase);
    });
  }

  /* Ghosting — the whole floor fades and only its slab stays pickable, so a
     tap on a ghost floor can mean "switch here" without misfiring on shapes. */
  if (spec.ghost) {
    floor.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.transparent = true;
          material.opacity = Math.min(material.opacity, GHOST_OPACITY);
        }
        const pick = (object.userData as { pick?: { kind?: string } }).pick;
        if (pick && pick.kind !== 'canvas') delete object.userData.pick;
      }
    });
  }

  floor.userData.animations = animations;
  return floor;
}

/** Build the whole scene. `read` resolves CSS var tokens (omit for the DOM default). */
export function buildScene(spec: SceneSpec, read?: CssVarReader): BuiltScene {
  const res = new Resources();
  const group = new THREE.Group();
  const animations: Array<(elapsed: number) => void> = [];
  for (const floorSpec of spec.floors) {
    const floor = buildFloor(floorSpec, read, res);
    animations.push(...(floor.userData.animations as Array<(elapsed: number) => void>));
    group.add(floor);
  }

  /* Vertical transit connectors between stacked floors: a tube from the
     departure node up/down to the arrival node, capped with a direction cone.
     This is what turns "take the stairs to floor 3" from a sentence into
     something the eye can follow. */
  for (const connector of spec.connectors ?? []) {
    const colorValue = resolveColor(connector.colorToken, read);
    const from = new THREE.Vector3(connector.fromX, connector.fromElevation, connector.fromY);
    const to = new THREE.Vector3(connector.toX, connector.toElevation, connector.toY);
    const axis = to.clone().sub(from);
    const length = axis.length();
    if (length <= 0) continue;
    const material = res.mat(
      new THREE.MeshLambertMaterial({
        color: colorValue,
        transparent: true,
        opacity: connector.active ? 0.85 : 0.35,
      }),
    );
    const tube = new THREE.Mesh(res.geo(new THREE.CylinderGeometry(9, 9, length, 14)), material);
    tube.position.copy(from).add(to).multiplyScalar(0.5);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    group.add(tube);

    if (connector.direction !== 'same') {
      const cone = new THREE.Mesh(res.geo(new THREE.ConeGeometry(15, 26, 16)), material);
      const tip = connector.direction === 'up' ? to : from;
      cone.position.copy(tip);
      if (connector.direction === 'down') cone.rotation.x = Math.PI;
      group.add(cone);
    }

    if (connector.active) {
      animations.push((elapsed) => {
        material.opacity = 0.6 + 0.25 * Math.sin(elapsed * 4);
      });
    }
  }

  return {
    group,
    dispose: () => res.dispose(),
    tick: (elapsed) => {
      for (const animate of animations) animate(elapsed);
      return animations.length > 0;
    },
  };
}
