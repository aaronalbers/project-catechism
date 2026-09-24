import * as THREE from 'three';
import { box, gold, meshAt, namedPart } from './kit';

/**
 * Baked brick in running bond, as a grey map on the brick's colour: two courses per tile, the upper
 * offset by half a brick, with darker joints. Sized to a Neo-Babylonian brick of ≈33 cm and a course
 * of ≈10 cm with its joint, so `repeat` is set from a face's size in cubits.
 */
function bricks(wide: number, high: number): THREE.DataTexture {
  const n = 16, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const row = y < n / 2 ? 0 : 1, bx = (x + (row ? n / 4 : 0)) % n, by = y % (n / 2);
    const k = by === 0 || bx % (n / 2) === 0 ? 175 : 228 - ((x * 7 + y * 13) % 5) * 4;
    data.set([k, k, k, 255], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
  // Mipmapped, so the courses blur to an even tone from afar rather than shimmering.
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  const cm = 44.5; t.repeat.set((wide * cm) / 66, (high * cm) / 20); t.needsUpdate = true;
  return t;
}

/**
 * Nebuchadnezzar's statue, Dan 3:1: "sixty cubits high and six cubits wide", in cubits, standing at the
 * origin facing +z. The text gives only those two figures and the gold. A figure that shape would be
 * ten times as tall as it is wide, where a human figure is five or six (Montgomery 1927), so it is drawn
 * as a robed figure 30 cubits high on a brick pedestal of 30, the two together 60 and neither wider
 * than 6. The split, the pedestal and the figure's form are reconstructed; each basis is in models.json.
 */
export function statue(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const W = 6, P = 30;

  // The pedestal: a plinth and cornice the full six cubits across, and a shaft between them a little narrower.
  const brick = (w: number, h: number) => new THREE.MeshStandardMaterial({ color: 0xb48a5c, map: bricks(w, h), roughness: 0.95 });
  const course = 1.5, shaft = W - 0.6;
  part('pedestal',
    box(W, course, W, 0, course / 2, 0, brick(W, course)),
    box(shaft, P - 2 * course, shaft, 0, P / 2, 0, brick(shaft, P - 2 * course)),
    box(W, course, W, 0, P - course / 2, 0, brick(W, course)));

  // The figure, gold, from the pedestal's top (y = P) to 60: a long robe whose outline is [radius, height]
  // above the pedestal, an ellipse `zs` deep; the arms hang close at its sides, so the hem, at 5 cubits,
  // and the shoulders, at 5.8, stay within the six.
  const gm = gold(), zs = 0.6, robeP: [number, number][] = [[0, 0], [2.5, 0], [2.45, 0.6], [2.15, 7], [2.05, 12], [1.9, 14], [2.1, 17.5], [2.2, 20.3], [1.6, 21.4], [0.85, 21.9], [0.8, 22.4]];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robeP.map(([r, y]) => new THREE.Vector2(r, y)), 64), gm);
  robe.scale.z = zs; robe.position.y = P;
  const armGeo = new THREE.CapsuleGeometry(0.55, 8.2, 6, 16);
  const arms = [-1, 1].map((sx) => { const a = meshAt(armGeo, gm, sx * 2.35, P + 16, 0); a.rotation.z = sx * 0.04; return a; });
  // A head, a squared beard and a tall banded crown; the crown's top is at 60.
  const head = meshAt(new THREE.SphereGeometry(1.55, 32, 16), gm, 0, P + 23.9, 0.1);
  const beard = box(1.9, 2.3, 0.9, 0, P + 22.6, 0.95, gm);
  const crownH = 4.4, crownY = P + 25.1, crown = meshAt(new THREE.CylinderGeometry(1.55, 1.4, crownH, 32), gm, 0, crownY + crownH / 2, 0);
  const bands = [0.3, 1.5, 2.7].map((y) => { const b = meshAt(new THREE.TorusGeometry(1.5, 0.14, 8, 40), gm, 0, crownY + y, 0); b.rotation.x = Math.PI / 2; return b; });
  const top = meshAt(new THREE.CylinderGeometry(1.7, 1.6, 0.5, 32), gm, 0, crownY + crownH + 0.25, 0);
  part('statue', robe, ...arms, head, beard, crown, ...bands, top);

  return g;
}
