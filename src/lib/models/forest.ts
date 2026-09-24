import * as THREE from 'three';
import { box, boxGeo, gold, instances, namedPart, type V3 } from './kit';

const ashlar = () => new THREE.MeshStandardMaterial({ color: 0xcfc3a6, roughness: 0.95 });
const cedar = () => new THREE.MeshStandardMaterial({ color: 0x9a5a34, roughness: 0.8 });
const dark = () => new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 1 });

/**
 * The House of the Forest of Lebanon (1 Kgs 7:2-5), in cubits, its length along x and its floor at
 * y = 0. The text gives the house (100 × 50 × 30), four rows of cedar pillars, 45 beams on them,
 * fifteen to a row, a cedar roof, windows in three tiers and doorways facing one another. It is read
 * as the BSB reads it: a hall whose roof rests on beams laid across the pillars, four rows of fifteen
 * (Josephus: "quadrangular pillars, all of cedar"), the beams spanning the three aisles between the
 * rows. Wall thickness, pillar size, the openings' size and places and the cedar courses are
 * estimated; each basis is in models.json. Solomon's gold shields (1 Kgs 10:16-17) are alternates,
 * drawn only in the states that hang and remove them.
 */
export function forestOfLebanon(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const building = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };

  const L = 100, W = 50, H = 30, T = 3, X = L / 2, Z = W / 2;
  // Four rows of fifteen pillars, the outer rows just clear of the walls, so the beams make three
  // aisles of equal width; a doorway at each end of each aisle (7:5).
  const rows = [-23, -23 / 3, 23 / 3, 23], aisles = [-46 / 3, 0, 46 / 3], bay = L / 15;
  const pillarX = Array.from({ length: 15 }, (_, i) => -X + bay * (i + 0.5));
  const door = { w: 6, h: 10 }, beam = 1.25, top = H - beam;

  // Stone walls round the 100 × 50 interior (7:2, 9), with courses of cedar beams laid in them
  // (7:11-12), and three doorways through each end wall.
  const sm = ashlar(), cm = cedar(), band = 0.75, bands = [14.75, 22.25];
  const walls = building('walls', ...[-1, 1].flatMap((sz) => [box(L + 2 * T, H, T, 0, H / 2, sz * (Z + T / 2), sm),
    ...bands.map((y) => box(L + 2 * T + 0.2, band, T + 0.2, 0, y, sz * (Z + T / 2), cm))]));
  const edges = [-Z, ...aisles.flatMap((c) => [c - door.w / 2, c + door.w / 2]), Z];
  for (const sx of [-1, 1]) {
    const x = sx * (X + T / 2);
    for (let i = 0; i < edges.length; i += 2) {
      const [a, b] = [edges[i], edges[i + 1]];
      walls.add(box(T, H, b - a, x, H / 2, (a + b) / 2, sm));
      for (const y of bands) walls.add(box(T + 0.2, band, b - a, x, y, (a + b) / 2, cm));
    }
    for (const c of aisles) {
      walls.add(box(T, H - door.h, door.w, x, (H + door.h) / 2, c, sm));
      for (const y of bands.filter((y) => y > door.h)) walls.add(box(T + 0.2, band, door.w, x, y, c, cm));
    }
  }

  // The pillars (7:2), square as Josephus has them, and the 45 beams across them, fifteen to a row (7:3).
  part('pillars', instances(boxGeo(1.5, top, 1.5), cedar(), rows.flatMap((z) => pillarX.map((x): V3 => [x, top / 2, z]))));
  part('beams', instances(boxGeo(beam, beam, 46 / 3 + 1.5), cedar(), aisles.flatMap((z) => pillarX.map((x): V3 => [x, top + beam / 2, z]))));

  // A cedar roof over the beams (7:3), flat, as the text gives no pitch.
  building('roof', box(L + 2 * T, 1, W + 2 * T, 0, H + 0.5, 0, cedar()));

  // Windows in three tiers, facing one another across the hall (7:4): a slot between each pair of pillars.
  const winAt: V3[] = [];
  for (const y of [11, 18.5, 26]) for (let i = 0; i < 14; i++) for (const sz of [-1, 1]) winAt.push([pillarX[i] + bay / 2, y, sz * (Z + T / 2)]);
  building('windows', instances(boxGeo(2, 3, T + 0.4), dark(), winAt));

  // Rectangular cedar frames round the doorways (7:5), three pairs facing one another down the aisles.
  const fm = cedar(), f = 0.6;
  building('doorways', ...[-1, 1].flatMap((sx) => aisles.flatMap((c) => [
    ...[-1, 1].map((s) => box(T + 0.6, door.h + f, f, sx * (X + T / 2), (door.h + f) / 2, c + s * (door.w + f) / 2, fm)),
    box(T + 0.6, f, door.w + 2 * f, sx * (X + T / 2), door.h + f / 2, c, fm),
  ])));

  // Solomon's shields of hammered gold, put in the house (10:16-17) and taken by Shishak (14:26). Where
  // they hung is not given: the 200 large ones in two rows along the long walls, below the windows, the
  // 300 small ones five to a pillar, on the face towards the middle of the hall.
  const large: V3[] = [];
  for (const y of [3.5, 7]) for (let i = 0; i < 50; i++) for (const sz of [-1, 1]) large.push([-X + 1 + 2 * i, y, sz * (Z - 0.2)]);
  const lg = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24).rotateX(Math.PI / 2).scale(1, 2, 1);
  // Cut open with the walls they hang on, except while they are being hung.
  building('large-shields', instances(lg, gold(), large));
  const small: V3[] = [];
  for (const z of rows) for (const x of pillarX) for (let k = 0; k < 5; k++) small.push([x, 6 + 2.5 * k, z - Math.sign(z) * 0.82]);
  part('small-shields', instances(new THREE.CylinderGeometry(0.65, 0.65, 0.12, 24).rotateX(Math.PI / 2), gold(), small));

  return g;
}
