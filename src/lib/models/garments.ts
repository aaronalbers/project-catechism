import * as THREE from 'three';
import { cloth, gold, instances, meshAt, namedPart, weave, type V3 } from './kit';
import { CUBIT_M, FIGURE_M, shoulder } from './scale';

/**
 * A cloth of gold thread worked with blue, purple and scarlet yarn and fine linen (Exod 28:6, 39:3),
 * for the ephod, its waistband and the breastpiece. The text names the materials, not the pattern.
 */
function goldWork(repeatY: number): THREE.DataTexture {
  const bands = [[0xf2, 0xec, 0xdc], [0xd4, 0xa6, 0x40], [0x2b, 0x4c, 0x9b], [0xd4, 0xa6, 0x40], [0x6b, 0x2d, 0x7a], [0xd4, 0xa6, 0x40], [0xb3, 0x22, 0x2a], [0xd4, 0xa6, 0x40]];
  return dataTexture(bands, 1, bands.length, 1, repeatY);
}
/** Linen woven in a check (tashbets, Exod 28:39), for the tunic. */
const check = () => dataTexture([[0xf4, 0xf0, 0xe6], [0xdd, 0xd6, 0xc6], [0xdd, 0xd6, 0xc6], [0xf4, 0xf0, 0xe6]], 2, 2, 48, 36);
function dataTexture(texels: number[][], w: number, h: number, repeatX: number, repeatY: number) {
  const data = new Uint8Array(texels.length * 4);
  texels.forEach((c, i) => data.set([...c, 255], i * 4));
  const t = new THREE.DataTexture(data, w, h);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  t.repeat.set(repeatX, repeatY); t.needsUpdate = true;
  return t;
}
const linen = () => cloth(0xf4f0e6);
const blue = () => cloth(0x2b4c9b);
const gem = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.1 });

/**
 * The high priest's garments (Exod 28, 39; Lev 8:7-9), in cubits, cut to fit the size figure
 * (≈1.66 m, scale.ts) standing at the origin facing +z; the model's `scale.at` puts it there, so the
 * figure the viewer draws for scale wears them. The text gives only the breastpiece's size (a span square) and
 * the robe's colour; every other shape and measure is reconstructed, each basis recorded in
 * models.json. Every part is a focus, so a step frames just what it adds; each step's `view` in
 * models.json faces the part, so the camera is never inside the figure.
 */
export function garments(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const h = FIGURE_M / CUBIT_M, H = (f: number) => f * h;

  // Body outlines, as [radius, height] in fractions of h, rising; the robe's and tunic's cross-sections
  // are ellipses, their depth `zs` of their width. The tunic stays inside the robe at every height.
  type Profile = { pts: [number, number][]; zs: number };
  const robeP: Profile = { zs: 0.8, pts: [[0.19, 0.1], [0.17, 0.25], [0.15, 0.4], [0.135, 0.52], [0.13, 0.62], [0.13, 0.72], [0.125, 0.79], [0.09, 0.835], [0.05, 0.85]] };
  const tunicP: Profile = { zs: 0.7, pts: [[0.18, 0.03], [0.165, 0.12], [0.15, 0.25], [0.137, 0.4], [0.125, 0.52], [0.12, 0.62], [0.12, 0.72], [0.115, 0.79], [0.085, 0.83], [0.048, 0.845]] };
  const rAt = ({ pts }: Profile, y: number) => {
    if (y <= pts[0][1]) return pts[0][0];
    for (let i = 1; i < pts.length; i++) {
      const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return pts[pts.length - 1][0];
  };
  /** Depth (z, in cubits) of a profile's front surface at height f·h, x cubits off the centre line. */
  const zAt = (p: Profile, f: number, x = 0) => p.zs * Math.sqrt(Math.max(0, H(rAt(p, f)) ** 2 - x * x));
  /** A lathe of a profile (grown by `grow`·h), optionally only part of the way round (phi from +z towards +x). */
  const shell = (p: Profile, from: number, to: number, grow: number, mat: THREE.Material, phiStart = 0, phiLength = Math.PI * 2) => {
    const pts = [[rAt(p, from), from] as [number, number], ...p.pts.filter(([, y]) => y > from && y < to), [rAt(p, to), to] as [number, number]];
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(H(r + grow), H(y))), 64, phiStart, phiLength), mat);
    m.scale.z = p.zs; return m;
  };
  /** A flat strip `w` wide (across x) following `path`, for straps and hanging ends. */
  const ribbon = (w: number, path: THREE.Vector3[], mat: THREE.Material) => {
    const geo = new THREE.PlaneGeometry(w, 1, 1, path.length - 1), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const p = path[Math.floor(i / 2)];
      pos.setXYZ(i, pos.getX(i) + p.x, p.y, p.z);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  const tube = (pts: V3[], r: number, mat: THREE.Material) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 6), mat);

  // Undergarments (28:42): linen from the waist to the thigh.
  part('undergarments', shell({ zs: 0.65, pts: [[0.122, 0.32], [0.122, 0.5]] }, 0.32, 0.5, 0, linen()));

  // Tunic (28:39): checkered linen to the feet, with sleeves to the wrist (Josephus, Ant. 3.7.2).
  const tm = cloth(0xffffff, check()), sleeve = new THREE.CylinderGeometry(H(0.045), H(0.042), H(0.3), 16, 1, true);
  part('tunic', shell(tunicP, 0.03, 0.845, 0, tm), ...[-1, 1].map((sx) => shoulder(h, sx, meshAt(sleeve, tm, 0, -H(0.15), 0))));

  // Sash (28:39, 39:29): four fingers broad, wound round the breast above the elbows, its ends
  // hanging to the ankles (Josephus, Ant. 3.7.2). It is under the robe; its ends show below the hem.
  const sash = cloth(0xffffff, weave(2)), sashY = 0.68, sashW = 4 / 24;
  const between = (f: number) => f > 0.1 ? (zAt(tunicP, f) + zAt(robeP, f)) / 2 : zAt(tunicP, f) + H(0.008);
  const end = (x: number) => ribbon(H(0.04), Array.from({ length: 30 }, (_, i) => { const f = sashY - 0.02 - i * 0.021; return new THREE.Vector3(x, H(f), between(f)); }), sash);
  part('sash', shell({ zs: 0.72, pts: [[0.124, sashY - 0.0224], [0.124, sashY + 0.0224]] }, sashY - sashW / (2 * h), sashY + sashW / (2 * h), 0, sash), end(-H(0.03)), end(H(0.03)));

  // Robe (28:31-35): all blue, to the ankles, parted for the arms (Josephus, Ant. 3.7.4), with a woven
  // collar round the head opening, and 72 gold bells alternating with 72 pomegranates of blue, purple
  // and scarlet round the hem (b. Zevachim 88b).
  const robe = part('robe');
  const inRobe = namedPart(robe);
  inRobe('robe-body', shell(robeP, 0.1, 0.85, 0, blue()));
  const collar = meshAt(new THREE.TorusGeometry(H(0.05), H(0.008), 8, 32), cloth(0x223d7d), 0, H(0.85), 0);
  collar.rotation.x = Math.PI / 2; collar.scale.y = robeP.zs;
  inRobe('robe-collar', collar);
  const N = 72, hem = (i: number, dy: number): V3 => {
    const a = (i / (2 * N)) * Math.PI * 2, r = H(0.19);
    return [r * Math.sin(a), H(0.1) - dy, r * robeP.zs * Math.cos(a)];
  };
  const pomGeo = new THREE.SphereGeometry(H(0.004), 10, 8);
  inRobe('pomegranates', ...[0x2b4c9b, 0x6b2d7a, 0xb3222a].map((c, k) => instances(pomGeo, cloth(c), Array.from({ length: N / 3 }, (_, j) => hem(2 * (3 * j + k), H(0.006))))));
  const bellGeo = new THREE.LatheGeometry([[0, 0], [0.004, 0.001], [0.0035, 0.005], [0.002, 0.008], [0, 0.009]].map(([r, y]) => new THREE.Vector2(H(r), H(y))), 12);
  bellGeo.translate(0, -H(0.009), 0);
  inRobe('bells', instances(bellGeo, gold(), Array.from({ length: N }, (_, j) => hem(2 * j + 1, 0))));

  // Ephod (28:6-14), after Rashi on 28:6: an apron tied on behind at the height of the heart, as wide
  // as the back and reaching to the heels, its waistband of one piece with it (28:8), and shoulder
  // pieces rising from the band behind, over the shoulders, and down the front to just above the band.
  const ephod = part('ephod');
  const inEphod = namedPart(ephod);
  const bandY = 0.6, bandW = 1 / 6, off = 0.012;
  inEphod('ephod-apron', shell(robeP, 0.1, bandY, off, cloth(0xffffff, goldWork(10)), Math.PI / 2, Math.PI));
  const sx0 = H(0.075), front = (f: number) => zAt(robeP, f, sx0) + H(off);
  const strap = (x: number): THREE.Vector3[] => {
    const up = Array.from({ length: 12 }, (_, i) => bandY + 0.025 + (i * (0.83 - bandY - 0.025)) / 11);
    const pts = up.map((f) => new THREE.Vector3(x, H(f), front(f)));
    return [...pts, new THREE.Vector3(x, H(0.852), 0), ...pts.reverse().map((p) => new THREE.Vector3(x, p.y, -p.z))];
  };
  const shm = cloth(0xffffff, goldWork(2));
  inEphod('shoulder-pieces', ...[-1, 1].map((s) => ribbon(H(0.035), strap(s * sx0), shm)));
  const band = shell({ zs: robeP.zs, pts: [[rAt(robeP, bandY) + off, bandY - 0.03], [rAt(robeP, bandY) + off, bandY + 0.03]] }, bandY - bandW / (2 * h), bandY + bandW / (2 * h), 0.002, cloth(0xffffff, goldWork(1)));
  inEphod('waistband', band);
  // Onyx stones in gold settings on the shoulders (28:9-12); their size is not given.
  const onyxAt = (s: number): V3 => [s * sx0, H(0.852) + 0.02, 0.02];
  const om = gem(0x2a2522), osm = gold(), settingGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), onyxGeo = new THREE.SphereGeometry(0.05, 20, 12);
  inEphod('onyx-stones', ...[-1, 1].flatMap((s) => {
    const [x, y, z] = onyxAt(s), st = meshAt(onyxGeo, om, x, y + 0.01, z); st.scale.y = 0.45;
    return [meshAt(settingGeo, osm, x, y, z), st];
  }));

  // Breastpiece (28:15-30): a span (½ cubit) square, folded double, on the chest above the waistband.
  const bp = part('breastpiece');
  const inBp = namedPart(bp);
  const S = 0.5, T = 0.04, bpY = H(bandY) + bandW / 2 + 0.02 + S / 2, bpZ = zAt(robeP, bpY / h) + T / 2 + 0.02;
  const top = bpY + S / 2, bottom = bpY - S / 2, face = bpZ + T / 2;
  inBp('breastpiece-pouch', meshAt(new THREE.BoxGeometry(S, S, T), cloth(0xffffff, goldWork(3)), 0, bpY, bpZ));
  // Twelve stones in four rows of three (28:17-20), each in a gold setting; colours follow the BSB's names.
  const rows = [[0x9b111e, 0xe0a526, 0x1f8a4c], [0x3fb8af, 0x1f3a93, 0xe8eef2], [0xd9622b, 0x9c6b4e, 0x7b3fa0], [0x8fc9b9, 0x2a2522, 0x7f3b2a]];
  const cellW = S / 3, cellH = S / 4, stoneGeo = new THREE.SphereGeometry(0.045, 20, 12), setGeo = new THREE.BoxGeometry(cellW * 0.82, cellH * 0.82, 0.012);
  rows.forEach((colors, r) => {
    const y = top - cellH * (r + 0.5), sm = gold();
    inBp(`stones-row-${r + 1}`, ...colors.flatMap((c, i) => {
      const x = -S / 2 + cellW * (i + 0.5), st = meshAt(stoneGeo, gem(c), x, y, face + 0.012);
      st.scale.set(1, 0.75, 0.4);
      return [meshAt(setGeo, sm, x, y, face + 0.006), st];
    }));
  });
  // Braided gold chains from the shoulder settings to rings at the breastpiece's top corners (28:14, 22-25).
  const ringGeo = new THREE.TorusGeometry(0.022, 0.006, 8, 20), cx = S / 2 - 0.03;
  const cm = gold();
  inBp('chains', ...[-1, 1].map((s) => {
    const [x, y, z] = onyxAt(s);
    return tube([[x, y, z + 0.05], [x, y - 0.08, 0.24], [s * (cx + 0.02), top + 0.12, face - 0.02], [s * cx, top - 0.01, face + 0.005]], 0.007, cm);
  }));
  const rg = gold();
  inBp('breastpiece-rings', ...[-1, 1].map((s) => meshAt(ringGeo, rg, s * cx, top - 0.03, face + 0.004)));
  // Two more on the inside edge at the bottom corners (28:26), tied with blue cord (28:28) to rings at
  // the foot of the shoulder pieces, just above the waistband (28:27).
  const lr = gold();
  inBp('lower-rings', ...[-1, 1].map((s) => meshAt(ringGeo, lr, s * cx, bottom + 0.03, bpZ - T / 2 - 0.004)));
  const footY = H(bandY + 0.03), er = gold();
  inEphod('ephod-rings', ...[-1, 1].map((s) => meshAt(ringGeo, er, s * sx0, footY, front(bandY + 0.03) + 0.004)));
  const bc = blue();
  inBp('blue-cord', ...[-1, 1].map((s) => tube([[s * cx, bottom + 0.03, bpZ - T / 2 - 0.004], [s * (cx + sx0) / 2, (bottom + footY) / 2 + 0.01, bpZ - T / 2 - 0.02], [s * sx0, footY, front(bandY + 0.03) + 0.004]], 0.005, bc)));

  // Urim and Thummim (28:30), put "in" the breastpiece: drawn as two small lots standing in its fold.
  const ut = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.5 }), utGeo = new THREE.BoxGeometry(0.06, 0.09, 0.012);
  part('urim-and-thummim', ...[-1, 1].map((s) => meshAt(utGeo, ut, s * 0.05, top + 0.015, bpZ)));

  // Turban (28:39) of fine linen, wound round the head.
  const tu = linen(), turbanP: [number, number][] = [[0.069, 0.952], [0.076, 0.965], [0.079, 0.99], [0.074, 1.015], [0.055, 1.035], [0, 1.042]];
  const turban = part('turban', new THREE.Mesh(new THREE.LatheGeometry(turbanP.map(([r, y]) => new THREE.Vector2(H(r), H(y))), 40), tu));
  for (const [r, y] of [[0.078, 0.97], [0.0805, 0.99], [0.077, 1.01]]) {
    const w = meshAt(new THREE.TorusGeometry(H(r), H(0.004), 8, 40), tu, 0, H(y), 0); w.rotation.x = Math.PI / 2; turban.add(w);
  }
  // The holy crown (28:36-38, 39:30-31): a gold plate two fingerbreadths wide on the forehead, from ear
  // to ear (b. Shabbat 63b), tied on with a blue cord round the back of the head.
  const crown = part('holy-crown');
  const inCrown = namedPart(crown), pm = gold();
  pm.side = THREE.DoubleSide;
  inCrown('plate', meshAt(new THREE.CylinderGeometry(H(0.067), H(0.067), 2 / 24, 40, 1, true, -Math.PI / 2, Math.PI), pm, 0, H(0.94), 0));
  const cord = meshAt(new THREE.TorusGeometry(H(0.067), H(0.003), 6, 24, Math.PI), blue(), 0, H(0.94), 0);
  cord.rotation.x = -Math.PI / 2;
  inCrown('plate-cord', cord);

  g.traverse((o) => { if (o.name) o.userData.focus = true; });
  // Each garment can be cut open, but only at a step that puts something on under it (see ModelStep).
  for (const c of g.children) c.userData.cutaway = 'step';

  return g;
}
