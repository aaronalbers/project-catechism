// Procedural stand-ins for objects whose dimensions are known from finds, so the
// Models tab works with zero downloaded assets. Each is built to real-world
// proportions; see content/models.json for the measurements and their sources.
import * as THREE from 'three';

function coin(diameterMm: number, thicknessMm: number, color: number, legend: string, reverseLegend: string): THREE.Group {
  const g = new THREE.Group();
  const r = diameterMm / 20; // 1 unit = 2 cm, keeps camera maths simple
  const t = thicknessMm / 20;
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 96), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Raised rim + a bust-like relief so the coin reads as struck rather than a disc.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, t * 0.35, 12, 96), mat);
  g.add(rim);
  const rim2 = rim.clone(); rim2.position.z = -0.001; g.add(rim2);
  const face = (z: number, text: string, bust: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#fff';
    if (bust) { ctx.beginPath(); ctx.ellipse(256, 270, 90, 120, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(256, 420, 150, 70, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(256, 130); ctx.lineTo(300, 400); ctx.lineTo(212, 400); ctx.closePath(); ctx.fill(); }
    ctx.font = 'bold 44px serif'; ctx.textAlign = 'center';
    const chars = text.split(''); const start = -Math.PI / 2 - (chars.length * 0.12) / 2;
    chars.forEach((ch, i) => { ctx.save(); ctx.translate(256, 256); ctx.rotate(start + i * 0.12); ctx.translate(0, -215); ctx.fillText(ch, 0, 0); ctx.restore(); });
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 96), new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.4, bumpMap: tex, bumpScale: 0.02 }));
    m.position.z = z; if (z < 0) m.rotation.y = Math.PI;
    g.add(m);
  };
  face(t / 2 + 0.0005, legend, true);
  face(-t / 2 - 0.0005, reverseLegend, false);
  g.rotation.x = -0.3;
  return g;
}

/** Alabastron: the long-necked, round-bottomed perfume flask. Profile is a lathe. */
function alabastron(heightCm: number): THREE.Group {
  const g = new THREE.Group();
  const h = heightCm / 2; // 1 unit = 2 cm
  const pts: THREE.Vector2[] = [];
  const profile: [number, number][] = [[0, 0], [0.55, 0.05], [0.9, 0.35], [1.0, 0.9], [0.95, 1.5], [0.8, 1.95], [0.55, 2.2], [0.42, 2.45], [0.4, 2.7], [0.55, 2.82], [0.62, 2.88], [0.45, 2.92], [0.3, 2.9], [0.3, 2.6], [0.38, 2.4], [0.5, 2.2], [0.72, 1.9], [0.86, 1.5], [0.9, 0.9], [0.78, 0.4], [0.45, 0.12], [0, 0.1]];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x * (h / 2.92) * 0.42, y * (h / 2.92)));
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xf1e6cf, roughness: 0.55, transmission: 0.35, thickness: 0.4, clearcoat: 0.3, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mat);
  g.add(mesh);
  // Faint banding like veined calcite (banded travertine "alabaster").
  const bands = new THREE.Mesh(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x * 1.002, p.y)), 96), new THREE.MeshStandardMaterial({ color: 0xd9c39a, transparent: true, opacity: 0.25, roughness: 0.6 }));
  g.add(bands);
  g.rotation.z = 0.15;
  return g;
}

// Materials are made per part, so a part can fade in without fading its neighbours.
const wood = () => new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
const gold = () => new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.28 });
const bronze = () => new THREE.MeshStandardMaterial({ color: 0xa8703a, metalness: 1, roughness: 0.4 });
const silver = () => new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.3 });
const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); return b;
};
/** Adds a named group to `g` — the unit a build step reveals. */
const namedPart = (g: THREE.Group) => (name: string, ...children: THREE.Object3D[]) => {
  const p = new THREE.Group(); p.name = name; if (children.length) p.add(...children); g.add(p); return p;
};

/**
 * Ark of the covenant (Exod 25:10–22), in cubits (1 unit = 1 cubit). Each child is a named
 * part so a build in content/models.json can reveal it at the verse that describes it. Only
 * the chest and cover sizes are given in the text; every other measure is an estimate, and
 * its basis is recorded on the step in models.json.
 */
function ark(): THREE.Group {
  const g = new THREE.Group();
  const L = 2.5, W = 1.5, H = 1.5, wall = 0.06;
  const part = namedPart(g);
  // An open chest — floor and four walls — so the tablets can be seen going in before the cover goes on.
  const shell = (grow: number, mat: THREE.Material) => [
    box(L + grow, wall + grow, W + grow, 0, (wall) / 2, 0, mat),
    box(L + grow, H + grow, wall + grow, 0, H / 2, W / 2 - wall / 2, mat),
    box(L + grow, H + grow, wall + grow, 0, H / 2, -W / 2 + wall / 2, mat),
    box(wall + grow, H + grow, W + grow, L / 2 - wall / 2, H / 2, 0, mat),
    box(wall + grow, H + grow, W + grow, -L / 2 + wall / 2, H / 2, 0, mat),
  ];
  part('chest', ...shell(0, wood()));
  // "Inside and out": a gold skin slightly thicker than each wall on both faces.
  part('overlay', ...shell(0.02, gold()));
  const m = gold(), mh = 0.08, lip = 0.05;
  part('moulding',
    box(L + 2 * lip, mh, lip, 0, H - mh / 2, W / 2 + lip / 2, m), box(L + 2 * lip, mh, lip, 0, H - mh / 2, -W / 2 - lip / 2, m),
    box(lip, mh, W, L / 2 + lip / 2, H - mh / 2, 0, m), box(lip, mh, W, -L / 2 - lip / 2, H - mh / 2, 0, m));
  // Rings low on the long sides ("its four feet"), turned so a pole along the length passes through.
  const ringY = 0.2, poleZ = W / 2 + 0.1, rm = gold();
  const rings = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 12, 32), rm);
    r.rotation.y = Math.PI / 2; r.position.set(sx * (L / 2 - 0.25), ringY, sz * poleZ); return r;
  }));
  part('rings', ...rings);
  const pm = gold(), poleLen = 4.5;
  part('poles', ...[-1, 1].map((sz) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, poleLen, 24), pm);
    p.rotation.z = Math.PI / 2; p.position.set(0, ringY, sz * poleZ); return p;
  }));
  const stone = () => new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 });
  part('tablets', box(0.8, 0.12, 0.55, -0.45, wall + 0.06, 0, stone()), box(0.8, 0.12, 0.55, 0.45, wall + 0.06, 0, stone()));
  // Cover: one handbreadth (⅙ cubit) thick, per b. Sukkah 5a — the text gives only length and width.
  const seatT = 1 / 6, top = H + seatT;
  part('mercy-seat', box(L, seatT, W, 0, H + seatT / 2, 0, gold()));
  // Cherubim: the text gives no form, so these are schematic kneeling figures facing each other.
  const cx = L / 2 - 0.3, cm = gold();
  part('cherubim', ...[-1, 1].map((sx) => {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.55, 24), cm); body.position.y = 0.275;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), cm); head.position.set(-sx * 0.06, 0.64, 0);
    c.add(body, head);
    c.position.set(sx * cx, top, 0); c.rotation.z = sx * 0.18; // leaning in, "looking toward the mercy seat"
    return c;
  }));
  // Wings "spread upward, overshadowing the mercy seat": each reaches up and in until the tips nearly meet.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.15, 0.55, 0.55, 0.85); wingShape.lineTo(0.9, 0.9);
  wingShape.quadraticCurveTo(0.65, 0.6, 0.12, -0.05); wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 16), wm = gold();
  wm.side = THREE.DoubleSide;
  part('wings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const w = new THREE.Mesh(wingGeo, wm);
    w.scale.x = -sx; // grow toward the centre from either end
    w.position.set(sx * cx, top + 0.45, sz * 0.13); w.rotation.x = sz * 0.25;
    return w;
  })));
  return g;
}

/**
 * White linen with bands of blue, purple and scarlet (Exod 26:1, 26:31, 26:36, 27:16). The text
 * names the colours but not the pattern, and the woven cherubim are not drawn. A DataTexture
 * needs no canvas, so the model also builds under test.
 */
function weave(repeatY: number): THREE.DataTexture {
  const bands = [[0xf2, 0xec, 0xdc], [0x2b, 0x4c, 0x9b], [0xf2, 0xec, 0xdc], [0x6b, 0x2d, 0x7a], [0xf2, 0xec, 0xdc], [0xb3, 0x22, 0x2a]];
  const data = new Uint8Array(bands.length * 4);
  bands.forEach((c, i) => data.set([...c, 255], i * 4));
  const t = new THREE.DataTexture(data, 1, bands.length);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  t.repeat.set(1, repeatY); t.needsUpdate = true;
  return t;
}
const cloth = (color: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, ...(map && { map }), roughness: 0.95, side: THREE.DoubleSide });
/** A w × h sheet centred on (x, y, z); `face` turns it to hang facing x or z, or to lie flat as a roof. */
const sheet = (w: number, h: number, x: number, y: number, z: number, face: 'x' | 'z' | 'roof', mat: THREE.Material) => {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  s.position.set(x, y, z);
  if (face === 'x') s.rotation.y = Math.PI / 2;
  if (face === 'roof') s.rotation.x = -Math.PI / 2;
  return s;
};
const meshAt = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
};
const post = (x: number, z: number, h: number, r: number, mat: THREE.Material) => {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat); p.position.set(x, h / 2, z); return p;
};

/**
 * The tabernacle and its courtyard (Exod 25–27, 30; 36–38; 40), in cubits. East is +x (the gate
 * faces the sunrise, 27:13) and north is −z. The text gives the court (100 × 50, hangings 5 high),
 * the frames (10 × 1½), the curtains and the furniture sizes; the rest is estimated and each basis is
 * recorded on its step in models.json. Parts flagged `userData.cutaway` form the tent, which the
 * viewer can cut away to show the furniture inside.
 */
function tabernacle(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const tent = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };
  // A focus unit is what the camera frames while a step builds any part inside it. Every top-level
  // child is one (set at the end); an unnamed unit groups parts revealed separately but seen together.
  const unit = () => { const u = new THREE.Group(); g.add(u); return namedPart(u); };
  // The tent runs from x = −30 (west) to 0 (the entrance); the most holy place, x −30…−20, is a
  // 10-cubit cube centred on the court's western square. Frames stand outside the 10-cubit interior.
  const W0 = -30, E0 = 0, half = 5, H = 10, t = 0.5, veilX = -20;
  const outer = half + t; // outer face of the side walls

  const theArk = ark(); theArk.position.set(-25, 0, 0);
  part('ark', theArk);

  // Table (25:23-29): acacia, 2 × 1 × 1½, overlaid with gold, with a gold molding, a rim a
  // handbreadth wide with its own molding, four rings at the legs near the rim, poles, and gold
  // vessels. On the north side of the holy place (26:35).
  const tx = -10, tz = -3.2, tH = 1.5, tT = 0.08, legX = 0.92, legZ = 0.42, tableUnit = unit(), table = namedPart(tableUnit('table'));
  const tableFrame = (grow: number, mat: THREE.Material) => [
    box(2 + grow, tT + grow, 1 + grow, tx, tH - tT / 2, tz, mat),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.08 + grow, tH - tT, 0.08 + grow, tx + sx * legX, (tH - tT) / 2, tz + sz * legZ, mat))),
  ];
  table('table-body', ...tableFrame(0, wood()));
  table('table-overlay', ...tableFrame(0.015, gold()));
  // Molding: a raised gold border round the top edge.
  const tmm = gold(), tl = 0.03;
  table('table-moulding',
    ...[-1, 1].map((sz) => box(2 + 2 * tl, 0.05, tl, tx, tH + 0.02, tz + sz * (0.5 + tl / 2), tmm)),
    ...[-1, 1].map((sx) => box(tl, 0.05, 1, tx + sx * (1 + tl / 2), tH + 0.02, tz, tmm)));
  // Rim (misgeret), a handbreadth wide: read here as a frame joining the legs just under the top;
  // others read it as a border standing up round the top. Its molding is the thin band along its foot.
  const trm = gold(), rimH = 1 / 6, rimY = tH - tT - rimH / 2;
  table('table-rim',
    ...[-1, 1].flatMap((sz) => [box(2 * legX, rimH, 0.03, tx, rimY, tz + sz * legZ, trm), box(2 * legX + 0.04, 0.025, 0.05, tx, rimY - rimH / 2, tz + sz * legZ, trm)]),
    ...[-1, 1].flatMap((sx) => [box(0.03, rimH, 2 * legZ, tx + sx * legX, rimY, tz, trm), box(0.05, 0.025, 2 * legZ + 0.04, tx + sx * legX, rimY - rimH / 2, tz, trm)]));
  // Rings at the four corners, on the legs, close to the rim (25:26-27), turned for poles along the length.
  const tRingY = rimY - rimH / 2 - 0.08, tPoleZ = legZ + 0.08, trg = gold();
  table('table-rings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const r = meshAt(new THREE.TorusGeometry(0.05, 0.012, 10, 24), trg, tx + sx * legX, tRingY, tz + sz * tPoleZ); r.rotation.y = Math.PI / 2; return r;
  })));
  const tpm = gold();
  table('table-poles', ...[-1, 1].map((sz) => { const p = meshAt(new THREE.CylinderGeometry(0.03, 0.03, 3.5, 12), tpm, tx, tRingY, tz + sz * tPoleZ); p.rotation.z = Math.PI / 2; return p; }));
  // Vessels (25:29), none of them sized: two plates under the bread, two dishes (for the frankincense
  // laid on the rows, Lev 24:7), and a pitcher and a bowl for the drink offerings at each end.
  const vm = gold(), onTop = tH + 0.01;
  vm.side = THREE.DoubleSide; // the bowl and pitcher are open shells
  const plateGeo = new THREE.CylinderGeometry(0.34, 0.32, 0.02, 28), dishGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.05, 16);
  const pitcherGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.065, 0.06], [0.05, 0.14], [0.035, 0.18], [0.045, 0.2], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  const bowlGeo = new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowlGeo.translate(0, 0.07, 0);
  table('table-vessels',
    ...[-0.45, 0.45].map((dx) => meshAt(plateGeo, vm, tx + dx, onTop, tz)),
    ...[-0.2, 0.2].map((dz) => meshAt(dishGeo, vm, tx, onTop + 0.025, tz + dz)),
    ...[-1, 1].flatMap((sx) => [meshAt(pitcherGeo, vm, tx + sx * 0.88, onTop - 0.01, tz - 0.3), meshAt(bowlGeo, vm, tx + sx * 0.88, onTop - 0.01, tz + 0.3)]));
  const bm = new THREE.MeshStandardMaterial({ color: 0xd9b37a, roughness: 0.9 });
  const loaf = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24);
  tableUnit('bread', ...[-0.45, 0.45].flatMap((dx) => Array.from({ length: 6 }, (_, i) => {
    const l = new THREE.Mesh(loaf, bm); l.position.set(tx + dx, tH + 0.06 + i * 0.085, tz); return l;
  })));

  // Lampstand (25:31-39), laid out after b. Menachot 28b: 18 handbreadths (3 cubits) high, the three
  // branch pairs leaving the shaft at knobs 8½, 10½ and 12½ handbreadths up and rising to the full
  // height; a base with a flower; a goblet, knob and flower at 5–6; three goblets, a knob and a
  // flower at the top — 22 goblets, 11 knobs and 9 flowers in all. Shapes are schematic.
  const hb = 1 / 6, lx = -10, lz = 3.2, top = 18 * hb, lm = gold();
  const lampUnit = unit(), piece = namedPart(lampUnit('lampstand'));
  const gobletGeo = new THREE.CylinderGeometry(0.05, 0.018, 0.11, 12), knobGeo = new THREE.SphereGeometry(0.05, 16, 12), flowerGeo = new THREE.CylinderGeometry(0.075, 0.03, 0.045, 16);
  const goblet = (x: number, y: number) => meshAt(gobletGeo, lm, x, y, lz);
  const knob = (x: number, y: number, k = 1) => { const n = meshAt(knobGeo, lm, x, y, lz); n.scale.set(k, 0.8 * k, k); return n; };
  const flower = (x: number, y: number) => meshAt(flowerGeo, lm, x, y, lz);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.3, 24), lm); base.position.set(lx, 0.15, lz);
  piece('lampstand-shaft', post(lx, lz, top, 0.04, lm), base, flower(lx, 3 * hb - 0.03));
  const branchR = [8.5, 10.5, 12.5].map((h) => top - h * hb); // a branch leaving at a knob rises to the top
  piece('lampstand-branches', ...branchR.map((r) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 8, 48, Math.PI), lm);
    arc.rotation.z = Math.PI; arc.position.set(lx, top, lz); return arc;
  }));
  // Along a branch, φ runs from 0 at the shaft to π/2 at its lamp; the verse's cups sit near the top.
  const onBranch = (r: number, side: number, phi: number): [number, number] => [lx + side * r * Math.sin(phi), top - r * Math.cos(phi)];
  piece('lampstand-branch-cups', ...branchR.flatMap((r) => [-1, 1].flatMap((side) => [
    ...[1.0, 1.17, 1.34].map((phi) => goblet(...onBranch(r, side, phi))),
    knob(...onBranch(r, side, 1.44)), flower(...onBranch(r, side, 1.52)),
  ])));
  piece('lampstand-shaft-cups',
    goblet(lx, 5.2 * hb), knob(lx, 5.5 * hb), flower(lx, 5.85 * hb),
    ...[15.4, 16, 16.6].map((h) => goblet(lx, h * hb)), knob(lx, 17.2 * hb), flower(lx, 17.7 * hb));
  piece('lampstand-knobs', ...branchR.map((r) => knob(lx, top - r, 1.3)));
  // Seven lamps, their spouts turned north so they "illuminate the area in front of it" (25:37).
  const flame = new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa53a, emissiveIntensity: 2 });
  const lampGeo = new THREE.SphereGeometry(0.075, 16, 10), flameGeo = new THREE.ConeGeometry(0.03, 0.12, 12), lampM = gold();
  lampUnit('lamps', ...[0, ...branchR.flatMap((r) => [-r, r])].flatMap((dx) => {
    const body = meshAt(lampGeo, lampM, lx + dx, top + 0.04, lz - 0.02); body.scale.set(1, 0.45, 1.4);
    return [body, meshAt(flameGeo, flame, lx + dx, top + 0.1, lz - 0.12)];
  }));
  // Wick trimmers (tongs) and their trays (25:38), set down beside the base.
  const tm2 = gold(), trayGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.03, 20), tongGeo = new THREE.BoxGeometry(0.28, 0.015, 0.02);
  lampUnit('lampstand-tools', ...[-1, 1].flatMap((sx) => {
    const x = lx + sx * 0.6, z = lz + 0.2;
    const a = meshAt(tongGeo, tm2, x, 0.04, z), b = meshAt(tongGeo, tm2, x, 0.04, z);
    a.rotation.y = 0.12; b.rotation.y = -0.12;
    return [meshAt(trayGeo, tm2, x, 0.015, z), a, b];
  }));

  // Altar of incense (30:1-5): acacia, 1 × 1 × 2 with horns of one piece, overlaid with gold on
  // the top, sides and horns, a gold molding, two gold rings below it and poles. Before the veil (30:6).
  const ix = -18.5, iH = 2, incense = namedPart(part('incense-altar'));
  const iHorn = new THREE.ConeGeometry(0.08, 0.2, 12);
  const iHorns = (mat: THREE.Material, k: number) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => { const h = meshAt(iHorn, mat, ix + sx * 0.42, iH + 0.1, sz * 0.42); h.scale.setScalar(k); return h; }));
  incense('incense-body', box(1, iH, 1, ix, iH / 2, 0, wood()));
  incense('incense-horns', ...iHorns(wood(), 1));
  incense('incense-overlay', box(1.02, iH + 0.01, 1.02, ix, iH / 2, 0, gold()), ...iHorns(gold(), 1.12));
  const im = gold(), lip = 0.04, crownY = iH - 0.04;
  incense('incense-moulding',
    ...[-1, 1].map((sz) => box(1 + 2 * lip, 0.08, lip, ix, crownY, sz * (0.51 + lip / 2), im)),
    ...[-1, 1].map((sx) => box(lip, 0.08, 1.02, ix + sx * (0.51 + lip / 2), crownY, 0, im)));
  // One ring on each of two opposite sides; "two rings… on its two sides" is also read as two a side.
  const iRingY = iH - 0.3, iPoleZ = 0.6, rgm = gold();
  incense('incense-rings', ...[-1, 1].map((sz) => { const r = meshAt(new THREE.TorusGeometry(0.07, 0.016, 10, 24), rgm, ix, iRingY, sz * iPoleZ); r.rotation.y = Math.PI / 2; return r; }));
  const ipm = gold();
  incense('incense-poles', ...[-1, 1].map((sz) => { const p = meshAt(new THREE.CylinderGeometry(0.035, 0.035, 3, 12), ipm, ix, iRingY, sz * iPoleZ); p.rotation.z = Math.PI / 2; return p; }));

  // Altar of burnt offering (27:1-8): a hollow box of acacia boards (v. 8), 5 × 5 × 3, horns of one
  // piece, overlaid with bronze; its utensils; a bronze mesh grate with a ring at each corner, set
  // under the ledge so it comes halfway up; poles through the rings on two sides. Placed in the
  // court's eastern half.
  const ax = 20, aS = 5, aH = 3, board = 0.12, altar = namedPart(part('altar'));
  const walls = (grow: number, mat: THREE.Material) => [-1, 1].flatMap((s) => [
    box(aS + grow, aH + grow, board + grow, ax, aH / 2, s * (aS / 2 - board / 2), mat),
    box(board + grow, aH + grow, aS + grow, ax + s * (aS / 2 - board / 2), aH / 2, 0, mat),
  ]);
  altar('altar-body', ...walls(0, wood()));
  const aHorn = new THREE.ConeGeometry(0.25, 0.5, 12), ahm = bronze();
  altar('altar-horns', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => meshAt(aHorn, ahm, ax + sx * 2.25, aH + 0.25, sz * 2.25))));
  altar('altar-overlay', ...walls(0.03, bronze()));
  // Utensils (27:3): pots for the ashes, shovels, sprinkling bowls, meat forks and firepans, laid out
  // on the north side. None of their sizes is given.
  const um = bronze(), ux = (i: number) => ax - 2 + i, uz = -3.4;
  const pot = meshAt(new THREE.CylinderGeometry(0.22, 0.18, 0.35, 20), um, ux(0), 0.175, uz);
  const shovel = new THREE.Group().add(box(0.3, 0.02, 0.35, 0, 0.01, 0.2, um), meshAt(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), um, 0, 0.02, -0.35).rotateX(Math.PI / 2));
  shovel.position.set(ux(1), 0, uz);
  const sprinkler = meshAt(new THREE.SphereGeometry(0.18, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), um, ux(2), 0.18, uz);
  const fork = new THREE.Group().add(meshAt(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8), um, 0, 0.02, -0.25).rotateX(Math.PI / 2),
    ...[-0.05, 0, 0.05].map((dx) => box(0.012, 0.012, 0.18, dx, 0.02, 0.18, um)));
  fork.position.set(ux(3), 0, uz);
  const pan = new THREE.Group().add(meshAt(new THREE.CylinderGeometry(0.2, 0.18, 0.05, 20), um, 0, 0.025, 0.1), box(0.03, 0.02, 0.4, 0, 0.03, -0.28, um));
  pan.position.set(ux(4), 0, uz);
  altar('altar-utensils', pot, shovel, sprinkler, fork, pan);
  // Grate: a bronze mesh round the lower half, just outside the walls, as its corner rings imply.
  const gm = bronze(), gOff = aS / 2 + 0.08, gH = aH / 2, step = 0.25;
  const vRod = new THREE.BoxGeometry(0.03, gH, 0.03), hRodX = new THREE.BoxGeometry(aS + 0.16, 0.03, 0.03), hRodZ = new THREE.BoxGeometry(0.03, 0.03, aS + 0.16);
  const grate: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    for (let u = -aS / 2; u <= aS / 2 + 1e-6; u += step) grate.push(meshAt(vRod, gm, ax + u, gH / 2, s * gOff), meshAt(vRod, gm, ax + s * gOff, gH / 2, u));
    for (let y = step; y <= gH + 1e-6; y += step) grate.push(meshAt(hRodX, gm, ax, y, s * gOff), meshAt(hRodZ, gm, ax + s * gOff, y, 0));
  }
  altar('altar-grate', ...grate);
  const aRingY = gH - 0.15, aPoleZ = gOff + 0.1, arm = bronze();
  altar('altar-rings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => { const r = meshAt(new THREE.TorusGeometry(0.12, 0.03, 10, 24), arm, ax + sx * 2.2, aRingY, sz * aPoleZ); r.rotation.y = Math.PI / 2; return r; })));
  // Ledge (karkov, a rare word): drawn as a band round the altar where the grate ends, halfway up.
  const lgm = bronze(), lw = 0.3;
  altar('altar-ledge',
    ...[-1, 1].map((sz) => box(aS + 2 * lw, 0.15, lw, ax, gH + 0.075, sz * (aS / 2 + lw / 2), lgm)),
    ...[-1, 1].map((sx) => box(lw, 0.15, aS, ax + sx * (aS / 2 + lw / 2), gH + 0.075, 0, lgm)));
  const apm = bronze();
  altar('altar-poles', ...[-1, 1].map((sz) => { const p = meshAt(new THREE.CylinderGeometry(0.1, 0.1, 7.5, 12), apm, ax, aRingY, sz * aPoleZ); p.rotation.z = Math.PI / 2; return p; }));

  // Basin: bronze on a bronze stand, between the tent and the altar (30:18). No size is given.
  const lv = bronze(), lvx = 9;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lv);
  bowl.position.set(lvx, 1.9, 0); bowl.material.side = THREE.DoubleSide;
  part('basin', new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 1.9, 24), lv).translateX(lvx).translateY(0.95), bowl);

  // Frames: 10 × 1½ (26:16), overlaid with gold (26:29): twenty on each long side (26:18, 20) and
  // six plus two corner frames at the rear (26:22-23), drawn here filling the 11-cubit back wall.
  // Thickness is not given; ½ cubit is assumed.
  // Each wall is its own pair of parts, as the text gives them: south (26:18-19), north (26:20-21), west (26:22-25).
  const fm = gold(), sm = silver();
  const frame = (side: string, x: number, z: number, w: number, alongX: boolean) => {
    const frames = g.getObjectByName(`frames-${side}`) ?? tent(`frames-${side}`), sockets = g.getObjectByName(`bases-${side}`) ?? tent(`bases-${side}`);
    frames.add(box(alongX ? w - 0.04 : t, H, alongX ? t : w - 0.04, x, H / 2, z, fm));
    // Two silver bases under each frame (26:19).
    for (const k of [-0.25, 0.25]) sockets.add(box(alongX ? w * 0.46 : t + 0.2, 0.6, alongX ? t + 0.2 : w * 0.46, alongX ? x + k * w : x, 0.3, alongX ? z : z + k * w, sm));
  };
  for (const [side, sz] of [['south', 1], ['north', -1]] as const) for (let i = 0; i < 20; i++) frame(side, W0 + 0.75 + 1.5 * i, sz * (half + t / 2), 1.5, true);
  const backW = 2 * outer / 8;
  for (let i = 0; i < 8; i++) frame('west', W0 - t / 2, -outer + backW / 2 + backW * i, backW, false);

  // Bars: five per wall (26:26-27). The middle bar runs end to end (26:28) through the frames; it
  // is drawn on the outer face so it can be seen. The other four are assumed to be half-length.
  const barM = gold(), bar = (len: number, x: number, y: number, z: number, alongX: boolean) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 12), barM);
    b.rotation[alongX ? 'z' : 'x'] = Math.PI / 2; b.position.set(x, y, z); return b;
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
  const linen = cloth(0xffffff, weave(8)), hair = cloth(0x2e2925), ram = cloth(0x8e2b20), hide = cloth(0x6b5a45);
  const cover = (name: string, gap: number, drop: number, mat: THREE.Material, sides: boolean) => {
    const z = outer + 0.25 + gap, y = H + gap, xb = W0 - t - 0.25 - gap;
    const c = tent(name, sheet(E0 - xb, 2 * z, (xb + E0) / 2, y, 0, 'roof', mat));
    if (sides) {
      for (const sz of [-1, 1]) c.add(sheet(E0 - xb, drop, (xb + E0) / 2, y - drop / 2, sz * z, 'z', mat));
      c.add(sheet(2 * z, Math.min(drop + 1, y), xb, y - Math.min(drop + 1, y) / 2, 0, 'x', mat));
    }
    return c;
  };
  cover('linen', 0, 9, linen, true);
  const goat = cover('goat-hair', 0.15, H + 0.15, hair, true);
  goat.add(sheet(2 * (outer + 0.4), 2, E0 + 0.05, H - 1, 0, 'x', hair));
  cover('ram-skins', 0.3, H + 0.3, ram, true);
  cover('leather', 0.45, 0, hide, false);

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
  const CX = 50, CZ = 25, CH = 5, pm = bronze(), cap = silver(), white = cloth(0xefe9dc);
  const stand = (x: number, z: number) => [post(x, z, CH, 0.2, pm), box(0.6, 0.4, 0.6, x, 0.2, z, pm), box(0.46, 0.25, 0.46, x, CH - 0.12, z, cap)];
  const span = (from: number, to: number) => Array.from({ length: Math.round((to - from) / 5) + 1 }, (_, i) => from + 5 * i);
  part('court-south', sheet(2 * CX, CH, 0, CH / 2, CZ, 'z', white), ...span(-CX, CX).flatMap((x) => stand(x, CZ)));
  part('court-north', sheet(2 * CX, CH, 0, CH / 2, -CZ, 'z', white), ...span(-CX, CX).flatMap((x) => stand(x, -CZ)));
  part('court-west', sheet(2 * CZ, CH, -CX, CH / 2, 0, 'x', white), ...span(-CZ + 5, CZ - 5).flatMap((z) => stand(-CX, z)));
  part('court-east', sheet(15, CH, CX, CH / 2, -CZ + 7.5, 'x', white), sheet(15, CH, CX, CH / 2, CZ - 7.5, 'x', white),
    ...[-20, -15, 15, 20].flatMap((z) => stand(CX, z)));
  // Gate: a 20-cubit embroidered screen (27:16), 5 high (38:18), on four posts.
  part('gate', sheet(20, CH, CX + 0.1, CH / 2, 0, 'x', cloth(0xffffff, weave(3))), ...[-10, -10 / 3, 10 / 3, 10].flatMap((z) => stand(CX, z)));
  for (const c of g.children) c.userData.focus = true;
  return g;
}

export function buildProcedural(kind: NonNullable<import('./types').Model3D['procedural']>): THREE.Object3D {
  switch (kind) {
    case 'denarius': return coin(19, 1.5, 0xd6d3c9, 'TI CAESAR DIVI AVG F AVGVSTVS', 'PONTIF MAXIM');
    case 'tetradrachm': return coin(26, 3, 0xd6d3c9, 'TYPOY IEPAΣ', 'KAI AΣYΛOY');
    case 'alabastron': return alabastron(18);
    case 'ark': return ark();
    case 'tabernacle': return tabernacle();
  }
}
