// Size references drawn beside a model: a standing figure for anything a hand's length or more,
// an open hand for smaller things, and a bar marked in the model's units. They live outside the
// model (the viewer adds them to the scene), so they are never build parts.
import * as THREE from 'three';
import type { ModelScale } from '@/lib/types';

/** The common cubit the models use (R. B. Y. Scott 1959), and the handbreadth, ⅙ of it. */
export const CUBIT_M = 0.445;
export const HANDBREADTH_M = CUBIT_M / 6;
/** Average height of a Judaean man in the first century, from skeletal remains (J. E. Taylor 2018). */
export const FIGURE_M = 1.66;
/** The hand's length, drawn in proportion to a palm one handbreadth across. */
const HAND_LENGTH = 2.4; // handbreadths
/** Below this size (largest dimension, metres) a model gets a hand rather than a figure. */
const HAND_BELOW_M = 0.5;

const skin = () => new THREE.MeshStandardMaterial({ color: 0x8d8a85, roughness: 0.9 });
const capsule = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len, 0.001), 6, 16), mat); m.position.set(x, y, z); return m;
};

/** A plain standing figure `h` units tall, feet on y = 0, facing +z. Deliberately generic: no one in particular. */
export function figure(h: number): THREE.Group {
  const g = new THREE.Group(), mat = skin();
  const leg = 0.05 * h, hip = 0.47 * h;
  for (const sx of [-1, 1]) g.add(capsule(leg, hip - 2 * leg, mat, sx * 0.06 * h, hip / 2, 0));
  const torso = capsule(0.1 * h, 0.17 * h, mat, 0, 0.64 * h, 0); torso.scale.z = 0.6; g.add(torso);
  for (const sx of [-1, 1]) { const a = capsule(0.035 * h, 0.31 * h, mat, sx * 0.145 * h, 0.62 * h, 0); a.rotation.z = sx * 0.06; g.add(a); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065 * h, 24, 16), mat); head.position.y = 0.93 * h; g.add(head);
  return g;
}

/**
 * An open right hand lying palm up, fingers pointing away (−z), its palm `b` units across (one
 * handbreadth). The origin is the middle of the palm, on its upper surface, so a small object
 * placed at the origin rests in it.
 */
export function hand(b: number): THREE.Group {
  const g = new THREE.Group(), mat = skin(), t = 0.22 * b, palmL = 1.1 * b;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(b, t, palmL), mat); palm.position.y = -t / 2; g.add(palm);
  // Index (on the thumb side, +x) to little finger; the middle finger reaches HAND_LENGTH handbreadths from the wrist.
  const fw = b / 4, lens = [1.15, HAND_LENGTH - 1.1, 1.2, 0.95].map((k) => k * b);
  lens.forEach((len, i) => {
    const f = capsule(fw * 0.42, len - fw * 0.84, mat, b / 2 - fw * (i + 0.5), -t / 2, -palmL / 2 - len / 2 + fw * 0.2);
    f.rotation.x = Math.PI / 2; g.add(f);
  });
  // The thumb leaves the palm near the wrist and points out and forward.
  const thumbL = 0.95 * b, dir = new THREE.Vector3(0.55, 0, -0.85).normalize(), base = new THREE.Vector3(b / 2 - fw * 0.3, -t / 2, palmL * 0.3);
  const thumb = capsule(fw * 0.5, thumbL - fw, mat, 0, 0, 0);
  thumb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  thumb.position.copy(base).addScaledVector(dir, thumbL / 2); g.add(thumb);
  return g;
}

/** The largest 1, 2 or 5 × 10ⁿ that is ≤ x. */
function niceFloor(x: number) {
  const p = 10 ** Math.floor(Math.log10(x)), d = x / p;
  return (d >= 5 ? 5 : d >= 2 ? 2 : 1) * p;
}
export function formatMetres(m: number) {
  const r = (v: number) => String(+v.toPrecision(3));
  return m >= 1 ? `${r(m)} m` : m >= 0.01 ? `${r(m * 100)} cm` : `${r(m * 1000)} mm`;
}

/**
 * The size reference for one model: a figure or a hand, chosen once from the model's size, and a
 * bar. The viewer moves it to stand beside whatever the camera frames, so `spot` says where it
 * would stand beside a box and `place` puts it there and lays a bar sized to that box. All
 * coordinates are the model's own, before the viewer centres it.
 */
export interface ScaleReference {
  group: THREE.Group; kind: 'figure' | 'hand';
  spot(box: THREE.Box3, at?: [number, number, number], toward?: THREE.Vector3): THREE.Vector3;
  boundsAt(p: THREE.Vector3): THREE.Box3;
  place(p: THREE.Vector3, box: THREE.Box3, toward?: THREE.Vector3): string;
}

export function scaleReference(scale: ModelScale, modelBox: THREE.Box3): ScaleReference {
  const u = scale.metres, modelSize = modelBox.getSize(new THREE.Vector3());
  const kind = Math.max(modelSize.x, modelSize.y, modelSize.z) * u < HAND_BELOW_M ? 'hand' : 'figure';
  const group = new THREE.Group(), bar = new THREE.Group();
  const ref = kind === 'figure' ? figure(FIGURE_M / u) : hand(HANDBREADTH_M / u);
  const local = new THREE.Box3().setFromObject(ref), half = local.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  group.add(ref, bar);
  const boundsAt = (p: THREE.Vector3) => local.clone().translate(p);
  return {
    group, kind, boundsAt,
    // `at` if given; otherwise just off the corner of `box` nearest `toward` (the camera), clear of both faces,
    // or for a model seen whole, beside its +x end. A figure stands on the ground (y = 0) even beside a
    // piece raised above it, such as a capital on its pillar; a hand is held level with the piece.
    spot(box, at, toward) {
      if (at) return new THREE.Vector3(...at);
      const c = box.getCenter(new THREE.Vector3()), gap = kind === 'figure' ? 0.3 / u : half.x * 0.4;
      const y = kind === 'figure' ? Math.min(box.min.y, 0) : box.min.y;
      if (!toward) return new THREE.Vector3(box.max.x + half.x + gap, y, c.z);
      const sx = toward.x >= c.x ? 1 : -1, sz = toward.z >= c.z ? 1 : -1;
      return new THREE.Vector3(c.x + sx * (box.max.x - c.x + half.x + gap), y, c.z + sz * (box.max.z - c.z + half.z + gap));
    },
    // A bar of a round number of the model's units (cubits, or metric), about a quarter as long as the
    // box and figure together, on the ground in front of both.
    place(p, box, toward) {
      ref.position.copy(p);
      for (const c of [...bar.children]) { const mesh = c as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); bar.remove(c); }
      const all = box.clone().union(boundsAt(p));
      const target = Math.max(...all.getSize(new THREE.Vector3()).toArray()) * u / 4;
      const cubits = scale.unit === 'cubit';
      const n = cubits ? Math.max(1, niceFloor(target / CUBIT_M)) : niceFloor(target);
      const metres = cubits ? n * CUBIT_M : n, len = metres / u;
      const lead = Math.round(n / 10 ** Math.floor(Math.log10(n)));
      const segments = cubits && n === 1 ? 1 : lead === 1 ? 10 : lead;
      const w = len / 12, h = w / 3, front = !toward || toward.z >= all.getCenter(new THREE.Vector3()).z;
      for (let i = 0; i < segments; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(len / segments, h, w), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe8e2d4 : 0x2a2723, roughness: 0.8 }));
        seg.position.set(all.min.x + (len / segments) * (i + 0.5), all.min.y + h / 2, front ? all.max.z + 2 * w : all.min.z - 2 * w);
        bar.add(seg);
      }
      const each = n / segments;
      return cubits
        ? `${n} cubit${n === 1 ? '' : 's'} (≈ ${formatMetres(metres)})${segments > 1 ? `, in blocks of ${each}` : ''}`
        : `${formatMetres(metres)}${segments > 1 ? `, in blocks of ${formatMetres(each)}` : ''}`;
    },
  };
}
