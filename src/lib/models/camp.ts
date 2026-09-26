import * as THREE from 'three';
import { TALLIES } from '../content';
import type { TallyRow } from '../types';
import { namedPart } from './kit';
import { tabernacle } from './tabernacle';

/**
 * How each reading of ʾeleph turns a figure in the text into people counted, and how many people in
 * all the camp holds. As a thousand, the figures stand (Keil & Delitzsch's ≈ 2 million, on 603,550
 * men and 22,000 Levites). As a troop, only the hundreds are men, and Kohath is read as 8,300, as some
 * Septuagint manuscripts have it (Humphreys 1998, Tables 2–3, and his ≈ 20,000 in all).
 */
const READINGS = {
  thousands: { counted: (r: TallyRow) => r.count, people: 2_000_000 },
  troops: { counted: (r: TallyRow) => (r.label === 'Kohath' ? 8300 : r.count) % 1000, people: 20_000 },
} as const;
type Reading = keyof typeof READINGS;

/** Ground per person, roads and services included: UNHCR's camp planning standard without garden plots. */
const M2_PER_PERSON = 30;
const SQ_CUBIT = 0.445 ** 2;
/** Where the Levites begin, just outside the court (100 × 50), and the tribes, 2,000 cubits out (Rashi on Num 2:2, from Josh 3:4). */
const LEVITES_FROM = 60, TRIBES_FROM = 2000, GAP = 50;
/** Moses', Aaron's and Aaron's sons' households: no number is given; ≈ 30 people. */
const PRIESTS = 30;

type Side = 'east' | 'south' | 'west' | 'north';
/** A point `d` out from the tabernacle on `side`, `s` along it, in model coordinates (x east, z south). */
function onSide(side: Side, s: number, d: number): [number, number] {
  switch (side) {
    case 'east': return [d, s];
    case 'west': return [-d, -s];
    case 'south': return [-s, d];
    case 'north': return [s, -d];
  }
}

/**
 * The ground one camp covers on its side, from `from` outward, as long pieces side by side (`areas`,
 * in square cubits, in order along the side). A camp small enough is a block twice as wide as it is
 * deep; a larger one fills the quarter between the diagonals, as far out as its area takes it, so
 * neighbouring camps meet at the corners without overlapping. Returns each piece's outline as
 * (s, d) points and how far out the camp reaches.
 */
function camp(areas: number[], from: number): { outlines: [number, number][][]; reach: number } {
  const total = areas.reduce((a, b) => a + b, 0);
  const half = Math.sqrt(total / 2);
  if (half <= from) {
    let s = -half;
    const outlines = areas.map((a) => {
      const w = (a / total) * 2 * half, o: [number, number][] = [[s, from], [s + w, from], [s + w, from + half], [s, from + half]];
      s += w; return o;
    });
    return { outlines, reach: from + half };
  }
  // The quarter between the diagonals, from `from` to R: at depth d it is 2d wide, so its area is R² − from².
  const R = Math.sqrt(total + from * from);
  const depth = (s: number) => R - Math.max(from, Math.abs(s));
  const N = 4000, cum = [0];
  for (let i = 1; i <= N; i++) { const a = -R + (2 * R * (i - 0.5)) / N; cum.push(cum[i - 1] + depth(a) * (2 * R) / N); }
  const at = (target: number) => { const i = cum.findIndex((c) => c >= target); return i <= 0 ? -R : -R + (2 * R * i) / N; };
  let done = 0, s0 = -R;
  const outlines = areas.map((a, k) => {
    done += a;
    const s1 = k === areas.length - 1 ? R : at((done / total) * cum[N]);
    const inner: [number, number][] = [];
    for (const s of [s0, -from, from, s1]) if (s >= s0 && s <= s1 && !inner.some(([x]) => x === s)) inner.push([s, Math.max(from, Math.abs(s))]);
    // At the far corners the inner edge meets the outer one; drop the repeated point.
    const o = [...inner, [s1, R], [s0, R]].filter(([s, d], i, all) => { const [ps, pd] = all[(i + all.length - 1) % all.length]; return Math.abs(s - ps) > 1e-6 || Math.abs(d - pd) > 1e-6; }) as [number, number][];
    s0 = s1; return o;
  });
  return { outlines, reach: R };
}

/** A repeating pattern of tents, tinted by the material's colour; mipmapped, so from far off it is a flat tone. */
function tents(cell: number): THREE.DataTexture {
  const n = 16, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tent = x >= 4 && x < 12 && y >= 5 && y < 11 && Math.abs(x - 7.5) <= (11 - y) * 0.75;
    data.set(tent ? [120, 120, 120, 255] : [200, 200, 200, 255], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / cell, 1 / cell);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

/**
 * One piece of ground, laid flat just above the ground at y. Unlit: the viewer's lights are set for metal
 * and cloth, and would wash a flat, rough, upward face out to white; ground has no shape to shade.
 */
function ground(side: Side, outline: [number, number][], colour: number, y = 0.2): THREE.Mesh {
  const shape = new THREE.Shape(outline.map(([s, d]) => { const [x, z] = onSide(side, s, d); return new THREE.Vector2(x, -z); }));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colour, map: tents(24) }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = y;
  return mesh;
}

/**
 * A name laid flat on a piece of ground, at its centre and sized to it, reading upright from outside the
 * camp with its top toward the tabernacle, as the camera sees it when the text turns to that side.
 * Null without a DOM (the tests), where only the ground is needed.
 */
function name(text: string, side: Side, ground: THREE.Mesh): THREE.Object3D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  if (!ctx) return null;
  const px = 96, font = `600 ${px}px system-ui, sans-serif`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + 24; c.height = px + 24;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(20,18,16,0.7)'; ctx.strokeText(text, c.width / 2, c.height / 2);
  ctx.fillStyle = '#f4efe4'; ctx.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // The ground's area and centroid, from its triangles in the shape's own plane (x, −z).
  const pos = ground.geometry.getAttribute('position'), idx = ground.geometry.getIndex()!;
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const [a, b, d] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)].map((k) => [pos.getX(k), pos.getY(k)]);
    const w = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1])) / 2;
    area += w; cx += w * (a[0] + b[0] + d[0]) / 3; cy += w * (a[1] + b[1] + d[1]) / 3;
  }
  const width = Math.sqrt(area) * 0.6, height = width * (c.height / c.width);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  const pivot = new THREE.Object3D();
  pivot.position.set(cx / area, 1, -cy / area);
  pivot.rotation.y = { east: Math.PI / 2, south: 0, west: -Math.PI / 2, north: Math.PI }[side];
  mesh.renderOrder = 1;
  pivot.add(mesh);
  return pivot;
}
/** Ground with its name on it. */
const named = (text: string, side: Side, g: THREE.Mesh) => { const n = name(text, side, g); return n ? [g, n] : [g]; };

// The four camps in the order of Numbers 2, each named for the tribe that leads it; the leader camps in
// the middle of its side under the camp's standard, the other two 'next to it' on either hand.
const CAMPS: { name: string; side: Side; hue: number }[] = [
  { name: 'judah', side: 'east', hue: 0.1 },
  { name: 'reuben', side: 'south', hue: 0.0 },
  { name: 'ephraim', side: 'west', hue: 0.3 },
  { name: 'dan', side: 'north', hue: 0.6 },
];
const LEVITE_SIDES: Record<string, Side> = { Gershon: 'west', Kohath: 'south', Merari: 'north' };

/**
 * The camp of Israel round the tabernacle (Num 2–3), in cubits, the tabernacle's own model at its
 * centre (east +x, north −z). Each tribe and each Levite clan covers ground in proportion to the
 * people its figure stands for under `reading`; the figures are the tallies' rows, so the model and
 * the charts cannot disagree. What each distance and area rests on is in models.json.
 */
export function israelsCamp(reading?: string): THREE.Group {
  const r = READINGS[(reading ?? 'thousands') as Reading] ?? READINGS.thousands;
  const camp2 = TALLIES.find((t) => t.id === 'num2-camp')!, levites = TALLIES.find((t) => t.id === 'num3-levites')!;
  const counted = [...camp2.rows, ...levites.rows].reduce((n, x) => n + r.counted(x), 0);
  const perHead = (r.people * M2_PER_PERSON) / counted / SQ_CUBIT; // square cubits per person counted

  const g = new THREE.Group();
  const part = namedPart(g);
  const focus = <T extends THREE.Object3D>(o: T) => { o.userData.focus = true; return o; };

  // The tabernacle as its own model builds it, whole; here it is one part, and its tent is not cut open.
  const tent = tabernacle();
  tent.traverse((o) => { delete o.userData.cutaway; delete o.userData.focus; });
  focus(part('tabernacle', ...tent.children.slice()));
  // The cloud over the tent (Num 9:15-16; Exod 40:34-38), 'in the sight of all the house of Israel'. No
  // size is given: a column from just above the tent to 1,500 cubits, widening as it rises, so the centre
  // can be found from anywhere in the camp. It starts clear of the tent so the tent is not hidden under it.
  const cloudM = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(100, 25, 1450, 32), cloudM); column.position.set(-15, 775, 0);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(25, 32, 16), cloudM); foot.position.set(-15, 50, 0);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), cloudM); crown.position.set(-15, 1500, 0);
  focus(part('cloud', column, foot, crown));

  // The Levites close round the court (3:23-38), each clan on its side; Moses and the priests before the entrance.
  const lev = focus(part('levites'));
  const reach: Record<Side, number> = { east: LEVITES_FROM, south: LEVITES_FROM, west: LEVITES_FROM, north: LEVITES_FROM };
  for (const row of levites.rows) {
    const side = LEVITE_SIDES[row.label], c = camp([r.counted(row) * perHead], LEVITES_FROM);
    focus(namedPart(lev)(row.label.toLowerCase(), ...named(row.label, side, ground(side, c.outlines[0], new THREE.Color().setHSL(0.1, 0.12, 0.78).getHex()))));
    reach[side] = c.reach;
  }
  const priests = camp([PRIESTS * (M2_PER_PERSON / SQ_CUBIT)], LEVITES_FROM);
  focus(namedPart(lev)('priests', ...named('Moses and Aaron', 'east', ground('east', priests.outlines[0], 0xd9ae4a))));

  // The tribes, 2,000 cubits out, or clear of the Levites where a clan reaches further.
  for (const { name, side, hue } of CAMPS) {
    const g2 = camp2.groups!.find((x) => x.members[0].toLowerCase() === name)!;
    const rows = g2.members.map((m) => camp2.rows.find((x) => x.label === m)!);
    // Along the side: the second tribe, the leader in the middle, the third.
    const order = [rows[1], rows[0], rows[2]];
    const c = camp(order.map((x) => r.counted(x) * perHead), Math.max(TRIBES_FROM, reach[side] + GAP));
    const whole = focus(part(`camp-${name}`));
    order.forEach((row, i) => {
      const shade = row === rows[0] ? 0.42 : i === 0 ? 0.54 : 0.64;
      focus(namedPart(whole)(row.label.toLowerCase(), ...named(row.label, side, ground(side, c.outlines[i], new THREE.Color().setHSL(hue, 0.5, shade).getHex()))));
    });
  }
  return g;
}
