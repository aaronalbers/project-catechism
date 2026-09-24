import * as THREE from 'three';
import { box, instances, iron, meshAt, namedPart, wood, type V3 } from './kit';

/**
 * Og's bed, Deut 3:11: "his bed of iron, nine cubits long and four cubits wide", in cubits, lying along
 * x with its head at −x, on the ground at the origin. The text gives the two figures and the iron. It is
 * drawn as a bed, the word's meaning everywhere else, of wood fitted with iron as Millard (1988) reads
 * it: iron legs, straps at the joints and studs along the rails. The height, the raised head and every
 * fitting are reconstructed; each basis is in models.json, with the other readings (a basalt sarcophagus,
 * a dolmen).
 */
export function ogsBed(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const L = 9, W = 4, H = 1.4, rail = 0.35, t = 0.25;

  // The frame, in wood: two side rails the full nine cubits and two end rails between them, the whole
  // four cubits across; slats across it; and a raised head.
  const wm = wood();
  const slatAt: V3[] = Array.from({ length: 17 }, (_, i) => [-L / 2 + 0.5 + i * 0.5, H - 0.12, 0]);
  part('bed',
    ...[-1, 1].map((s) => box(L, rail, t, 0, H - rail / 2, s * (W / 2 - t / 2), wm)),
    ...[-1, 1].map((s) => box(t, rail, W - 2 * t, s * (L / 2 - t / 2), H - rail / 2, 0, wm)),
    instances(new THREE.BoxGeometry(0.38, 0.06, W - 2 * t), wm, slatAt),
    box(0.2, 1.6, W - 0.2, -L / 2 + 0.1, H + 0.8, 0, wm));

  // The iron: six turned legs, straps round the rails at each corner and the middle, a strap along the
  // head's top edge, and studs along the side rails.
  const im = iron(), below = H - rail;
  const legP: [number, number][] = [[0, 0], [0.2, 0], [0.22, 0.06], [0.13, 0.28], [0.1, 0.55], [0.16, 0.66], [0.12, 0.76], [0.14, below], [0, below]];
  const legGeo = new THREE.LatheGeometry(legP.map(([r, y]) => new THREE.Vector2(r, y)), 24);
  const legs = [-1, 0, 1].flatMap((x) => [-1, 1].map((z) => meshAt(legGeo, im, x * (L / 2 - 0.2), 0, z * (W / 2 - 0.2))));
  const straps = [-1, 0, 1].flatMap((x) => [-1, 1].map((z) => box(0.5, rail + 0.04, t + 0.04, x * (L / 2 - 0.35), H - rail / 2, z * (W / 2 - t / 2), im)));
  const ends = [-1, 1].flatMap((x) => [-1, 1].map((z) => box(t + 0.04, rail + 0.04, 0.5, x * (L / 2 - t / 2), H - rail / 2, z * (W / 2 - 0.45), im)));
  const cap = box(0.26, 0.1, W - 0.14, -L / 2 + 0.1, H + 1.62, 0, im);
  const studAt: V3[] = [];
  for (const z of [-1, 1]) for (let x = -L / 2 + 0.85; x < L / 2 - 0.6; x += 0.5) if (Math.abs(x) > 0.4) studAt.push([x, H - rail / 2, z * W / 2]);
  part('iron', ...legs, ...straps, ...ends, cap, instances(new THREE.SphereGeometry(0.06, 12, 8), im, studAt));

  return g;
}
