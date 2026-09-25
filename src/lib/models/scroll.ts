import * as THREE from 'three';
import { cylGeo, namedPart } from './kit';

const clay = () => new THREE.MeshStandardMaterial({ color: 0x9a5236, roughness: 0.9 });
const cord = () => new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 });

/** A seeded random number generator, so the writing looks the same on every load. */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/**
 * Papyrus written in columns, as a DataTexture (no canvas, so the model builds under test). `u` runs
 * round the roll, the way a line of writing runs along the sheet; `v` runs along the roll's axis.
 * The ink is schematic: strokes of varying length, not letters.
 */
function writing(): THREE.DataTexture {
  const w = 512, h = 256, data = new Uint8Array(w * h * 4), rnd = seeded(7);
  for (let i = 0; i < w * h; i++) data.set([0xb8, 0x9f, 0x72, 255], i * 4);
  const ink = (x: number, y: number) => data.set([0x2e, 0x24, 0x1c, 255], (y * w + (x % w)) * 4);
  // Two columns round the roll, each with lines 6 px apart and margins at the ends of the roll.
  for (const c0 of [20, 276]) for (let y = 22; y < h - 22; y += 6) {
    let x = c0;
    while (x < c0 + 216) { const len = 4 + Math.floor(rnd() * 14); for (let k = 0; k < len && x + k < c0 + 216; k++) for (let t = 0; t < 2; t++) ink(x + k, y + t); x += len + 3; }
  }
  const t = new THREE.DataTexture(data, w, h);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

/** The end of the roll: the sheet's turns, seen edge on, as rings. */
function turns(): THREE.DataTexture {
  const n = 128, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), edge = (r * 14 + Math.atan2(y - n / 2, x - n / 2) / (2 * Math.PI)) % 1;
    const c = edge < 0.2 ? [0x76, 0x62, 0x44] : [0xb3, 0x9b, 0x70];
    data.set([...c, 255], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

/**
 * The scroll of Rev 5:1, "written inside and on the back" and "sealed with seven seals", in
 * centimetres, rolled along x and lying on the palm at the origin. The text gives neither size nor
 * how it was sealed. It is drawn as a papyrus roll 24 cm high, the breadth Pliny gives the best
 * paper (13 digits), tied with seven cords, each sealed with a clay bulla over the sheet's outer edge
 * as the seven on Samaria Papyrus 1 were. Each seal is a part, `seal-1` to `seal-7`, so the Lamb's
 * opening them (6:1-8:1) can take them off one by one; `broken-1` to `broken-7`, the cracked halves
 * and cut cord, are the alternates drawn in their place. Each basis is in models.json.
 */
export function sealedScroll(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const L = 24, R = 1.6, top = 2 * R;

  // The roll, written on the outside (the back, 5:1), its ends showing the turns of the sheet, and
  // the sheet's outer edge running along the top, where the seals are.
  const roll = new THREE.Mesh(cylGeo(R, L, 48), new THREE.MeshStandardMaterial({ map: writing(), roughness: 0.95 }));
  const endMat = new THREE.MeshStandardMaterial({ map: turns(), roughness: 1 });
  const ends = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.CircleGeometry(R, 48), endMat); e.position.y = s * (L / 2 + 0.001); e.rotation.x = -s * Math.PI / 2; return e; });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, L), new THREE.MeshStandardMaterial({ color: 0xb09870, roughness: 0.95 }));
  const body = new THREE.Group(); body.add(roll, ...ends); body.rotation.z = Math.PI / 2; body.position.y = R;
  edge.rotation.y = Math.PI / 2; edge.position.set(0, top + 0.01, 0.25);
  part('scroll', body, edge);

  // Seven cords round the roll, 3 cm apart, each through a lump of clay pressed on the outer edge
  // and sealed with a ring; the cord's cut ends hang from the bulla.
  const xs = Array.from({ length: 7 }, (_, i) => (i - 3) * 3);
  const bullaGeo = new THREE.SphereGeometry(0.8, 24, 12).scale(1, 0.35, 1), faceGeo = new THREE.TorusGeometry(0.42, 0.06, 8, 24).rotateX(Math.PI / 2);
  const loopGeo = new THREE.TorusGeometry(R + 0.04, 0.05, 6, 48).rotateY(Math.PI / 2), tailGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
  const seals = part('seals');
  xs.forEach((x, i) => {
    const s = new THREE.Group(); s.name = `seal-${i + 1}`; seals.add(s);
    const cm = clay(), km = cord();
    const bulla = new THREE.Mesh(bullaGeo, cm); bulla.position.set(x, top + 0.12, 0);
    const face = new THREE.Mesh(faceGeo, cm); face.position.set(x, top + 0.38, 0);
    const loop = new THREE.Mesh(loopGeo, km); loop.position.set(x, R, 0);
    const tails = [-1, 1].map((k) => { const t = new THREE.Mesh(tailGeo, km); t.position.set(x + k * 0.45, top - 0.1, 0.9); t.rotation.set(1.1, 0, k * 0.4); return t; });
    s.add(bulla, face, loop, ...tails);
  });

  // The seals as the Lamb leaves them (6:1-8:1): the bulla cracked in two across the cord, its halves
  // fallen apart on the roll, and the cord cut. How a seal was broken is not described.
  // Each half is the bulla's +x half (split across the cord, which runs round the roll at x), turned
  // round for the −x half; drawn double-sided so the broken face shows.
  const halfGeo = new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI).rotateY(Math.PI / 2).scale(1, 0.35, 1);
  const broken = part('broken-seals');
  xs.forEach((x, i) => {
    const b = new THREE.Group(); b.name = `broken-${i + 1}`; broken.add(b);
    const cm = new THREE.MeshStandardMaterial({ color: 0x9a5236, roughness: 0.9, side: THREE.DoubleSide }), km = cord();
    const halves = [-1, 1].map((k) => {
      const h = new THREE.Mesh(halfGeo, cm);
      h.rotation.set(0, k < 0 ? Math.PI : 0, -k * 0.45); h.position.set(x + k * 0.4, top + 0.05, 0);
      return h;
    });
    // The cut cord's two ends, lying loose over the roll to either side.
    const ends = [-1, 1].map((k) => {
      const t = new THREE.Mesh(tailGeo, km); t.scale.y = 1.4;
      t.rotation.x = Math.PI / 2 + k * 0.6; t.position.set(x + 0.15 * k, R + Math.cos(0.6) * (R + 0.05), k * Math.sin(0.6) * (R + 0.05) * 1.1);
      return t;
    });
    b.add(...halves, ...ends);
  });

  return g;
}
