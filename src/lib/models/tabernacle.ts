import * as THREE from 'three';
import { boxGeo, bronze, cloth, cylGeo, gold, instances, meshAt, namedPart, post, sheet, silver, weave, box, type V3 } from './kit';
import { ark, basin, bronzeAltar, incenseAltar, lampstand, table } from './furniture';

/**
 * The tabernacle and its courtyard (Exod 25–27, 30; 36–38; 40), in cubits. East is +x (the gate
 * faces the sunrise, 27:13) and north is −z. The text gives the court (100 × 50, hangings 5 high),
 * the frames (10 × 1½), the curtains and the furniture sizes; the rest is estimated and each basis is
 * recorded in models.json. Parts flagged `userData.cutaway` form the tent, which the viewer can cut
 * away to show the furniture inside.
 */
export function tabernacle(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const tent = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };
  const place = (unit: THREE.Object3D, x: number, z: number) => { unit.position.set(x, 0, z); g.add(unit); };
  // The tent runs from x = −30 (west) to 0 (the entrance); the most holy place, x −30…−20, is a
  // 10-cubit cube centred on the court's western square. Frames stand outside the 10-cubit interior.
  const W0 = -30, E0 = 0, half = 5, H = 10, t = 0.5, veilX = -20;
  const outer = half + t; // outer face of the side walls

  place(ark(), -25, 0); // in the most holy place (26:33-34)
  place(table(), -10, -3.2); // on the north side of the holy place (26:35)
  place(lampstand(), -10, 3.2); // on the south side, opposite the table (26:35)
  place(incenseAltar(), -18.5, 0); // before the veil (30:6)
  place(bronzeAltar(), 20, 0); // in the court's eastern half; the text does not say where
  place(basin(), 9, 0); // between the tent and the altar (30:18)

  // Frames: 10 × 1½ (26:16), overlaid with gold (26:29): twenty on each long side (26:18, 20) and
  // six plus two corner frames at the rear (26:22-23), drawn here filling the 11-cubit back wall.
  // Thickness is not given; ½ cubit is assumed. Each wall is its own pair of parts, as the text
  // gives them: south (26:18-19), north (26:20-21), west (26:22-25).
  const wall = (side: string, at: [number, number][], w: number, alongX: boolean) => {
    tent(`frames-${side}`, instances(alongX ? boxGeo(w - 0.04, H, t) : boxGeo(t, H, w - 0.04), gold(), at.map(([x, z]): V3 => [x, H / 2, z])));
    // Two silver bases under each frame (26:19).
    tent(`bases-${side}`, instances(alongX ? boxGeo(w * 0.46, 0.6, t + 0.2) : boxGeo(t + 0.2, 0.6, w * 0.46), silver(),
      at.flatMap(([x, z]) => [-0.25, 0.25].map((k): V3 => alongX ? [x + k * w, 0.3, z] : [x, 0.3, z + k * w]))));
  };
  for (const [side, sz] of [['south', 1], ['north', -1]] as const) wall(side, Array.from({ length: 20 }, (_, i) => [W0 + 0.75 + 1.5 * i, sz * (half + t / 2)]), 1.5, true);
  const backW = 2 * outer / 8;
  wall('west', Array.from({ length: 8 }, (_, i) => [W0 - t / 2, -outer + backW / 2 + backW * i]), backW, false);

  // Bars: five per wall (26:26-27). The middle bar runs end to end (26:28) through the frames; it
  // is drawn on the outer face so it can be seen. The other four are assumed to be half-length.
  const barM = gold(), bar = (len: number, x: number, y: number, z: number, alongX: boolean) => {
    const b = meshAt(cylGeo(0.1, len, 12), barM, x, y, z);
    b.rotation[alongX ? 'z' : 'x'] = Math.PI / 2; return b;
  };
  const bars = tent('bars');
  for (const sz of [-1, 1]) {
    const z = sz * (outer + 0.1);
    bars.add(bar(30, (W0 + E0) / 2, H / 2, z, true));
    for (const y of [1.5, 8.5]) for (const x of [W0 + 7.5, W0 + 22.5]) bars.add(bar(15, x, y, z, true));
  }
  bars.add(bar(2 * outer, W0 - t - 0.1, H / 2, 0, false));
  for (const y of [1.5, 8.5]) for (const z of [-outer / 2, outer / 2]) bars.add(bar(outer, W0 - t - 0.1, y, z, false));

  // Coverings, innermost first. Linen: ten curtains of 28 × 4 (26:1-2) — 28 across, so 9 cubits
  // hang down each side; 40 long, so 10 hang down the back. Goat hair: eleven of 30 × 4 (26:7-8),
  // reaching the ground, the sixth doubled over the front (26:9). The two outer coverings
  // (26:14) have no stated size: ram skins are drawn over roof and sides, leather over the roof.
  const cover = (name: string, gap: number, drop: number, mat: THREE.Material, sides: boolean) => {
    const z = outer + 0.25 + gap, y = H + gap, xb = W0 - t - 0.25 - gap;
    const c = tent(name, sheet(E0 - xb, 2 * z, (xb + E0) / 2, y, 0, 'roof', mat));
    if (sides) {
      for (const sz of [-1, 1]) c.add(sheet(E0 - xb, drop, (xb + E0) / 2, y - drop / 2, sz * z, 'z', mat));
      c.add(sheet(2 * z, Math.min(drop + 1, y), xb, y - Math.min(drop + 1, y) / 2, 0, 'x', mat));
    }
    return c;
  };
  cover('linen', 0, 9, cloth(0xffffff, weave(8)), true);
  const hair = cloth(0x2e2925);
  cover('goat-hair', 0.15, H + 0.15, hair, true).add(sheet(2 * (outer + 0.4), 2, E0 + 0.05, H - 1, 0, 'x', hair));
  cover('ram-skins', 0.3, H + 0.3, cloth(0x8e2b20), true);
  cover('leather', 0.45, 0, cloth(0x6b5a45), false);

  // Veil on four gold posts with silver bases (26:31-32), hung under the clasps (26:33) — 20 cubits
  // in from the entrance, since five curtains of 4 cubits make up the front half. Screen at the
  // entrance on five gold posts with bronze bases (26:36-37).
  const hanging = (name: string, x: number, n: number, postM: THREE.Material, baseM: THREE.Material) => {
    const zs = Array.from({ length: n }, (_, i) => -half + 0.5 + (i * (2 * half - 1)) / (n - 1));
    return tent(name, sheet(2 * half, H, x + 0.25, H / 2, 0, 'x', cloth(0xffffff, weave(6))),
      ...zs.flatMap((z) => [post(x, z, H, 0.2, postM), box(0.6, 0.5, 0.6, x, 0.25, z, baseM)]));
  };
  hanging('veil', veilX, 4, gold(), silver());
  hanging('screen', E0, 5, gold(), bronze());

  // Court: 100 × 50 (27:9-13, 18), hangings 5 high, posts on bronze bases with silver bands
  // (27:10-11, 17). Posts stand every 5 cubits, corners shared, except that the gate's four are
  // spaced evenly across its 20 cubits (27:16); the text's count of sixty does not say how corners were counted.
  // Each side of the court is a part, in the text's order: south (27:9-10), north (27:11), west (27:12),
  // east (27:13-15), gate (27:16).
  const CX = 50, CZ = 25, CH = 5, white = () => cloth(0xefe9dc);
  const stands = (at: [number, number][]) => {
    const pm = bronze(), on = (y: number) => at.map(([x, z]): V3 => [x, y, z]);
    return [instances(cylGeo(0.2, CH, 16), pm, on(CH / 2)), instances(boxGeo(0.6, 0.4, 0.6), pm, on(0.2)), instances(boxGeo(0.46, 0.25, 0.46), silver(), on(CH - 0.12))];
  };
  const span = (from: number, to: number) => Array.from({ length: Math.round((to - from) / 5) + 1 }, (_, i) => from + 5 * i);
  part('court-south', sheet(2 * CX, CH, 0, CH / 2, CZ, 'z', white()), ...stands(span(-CX, CX).map((x) => [x, CZ])));
  part('court-north', sheet(2 * CX, CH, 0, CH / 2, -CZ, 'z', white()), ...stands(span(-CX, CX).map((x) => [x, -CZ])));
  part('court-west', sheet(2 * CZ, CH, -CX, CH / 2, 0, 'x', white()), ...stands(span(-CZ + 5, CZ - 5).map((z) => [-CX, z])));
  const east = white();
  part('court-east', sheet(15, CH, CX, CH / 2, -CZ + 7.5, 'x', east), sheet(15, CH, CX, CH / 2, CZ - 7.5, 'x', east),
    ...stands([-20, -15, 15, 20].map((z) => [CX, z])));
  // Gate: a 20-cubit embroidered screen (27:16), 5 high (38:18), on four posts.
  part('gate', sheet(20, CH, CX + 0.1, CH / 2, 0, 'x', cloth(0xffffff, weave(3))), ...stands([-10, -10 / 3, 10 / 3, 10].map((z) => [CX, z])));
  // A focus unit is what the camera frames while a step builds any part inside it: each piece of
  // furniture with its loose parts, and each part of the tent and court.
  for (const c of g.children) c.userData.focus = true;
  return g;
}
