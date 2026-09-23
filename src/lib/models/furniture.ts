// The tabernacle's furniture, in cubits (1 unit = 1 cubit), each drawn at the origin under a name
// prefix (see `furniture` in kit.ts) so a model can place it, and hold more than one. Only some
// measures are in the text; each estimate's basis is recorded in content/models.json.
import * as THREE from 'three';
import { box, boxGeo, bronze, cylGeo, furniture, gold, instances, meshAt, namedPart, pole, post, ring, stone, wood, type V3 } from './kit';

/**
 * Ark of the covenant (Exod 25:10–22). Only the chest and cover sizes are given in the text;
 * every other measure is an estimate.
 */
export function ark(p = 'ark'): THREE.Group {
  const { unit, piece } = furniture(p);
  const L = 2.5, W = 1.5, H = 1.5, wall = 0.06;
  // An open chest — floor and four walls — so the tablets can be seen going in before the cover goes on.
  const shell = (grow: number, mat: THREE.Material) => [
    box(L + grow, wall + grow, W + grow, 0, (wall) / 2, 0, mat),
    box(L + grow, H + grow, wall + grow, 0, H / 2, W / 2 - wall / 2, mat),
    box(L + grow, H + grow, wall + grow, 0, H / 2, -W / 2 + wall / 2, mat),
    box(wall + grow, H + grow, W + grow, L / 2 - wall / 2, H / 2, 0, mat),
    box(wall + grow, H + grow, W + grow, -L / 2 + wall / 2, H / 2, 0, mat),
  ];
  piece('chest', ...shell(0, wood()));
  // "Inside and out": a gold skin slightly thicker than each wall on both faces.
  piece('overlay', ...shell(0.02, gold()));
  const m = gold(), mh = 0.08, lip = 0.05;
  piece('moulding',
    box(L + 2 * lip, mh, lip, 0, H - mh / 2, W / 2 + lip / 2, m), box(L + 2 * lip, mh, lip, 0, H - mh / 2, -W / 2 - lip / 2, m),
    box(lip, mh, W, L / 2 + lip / 2, H - mh / 2, 0, m), box(lip, mh, W, -L / 2 - lip / 2, H - mh / 2, 0, m));
  // Rings low on the long sides ("its four feet"), turned so a pole along the length passes through.
  const ringY = 0.2, poleZ = W / 2 + 0.1, rm = gold();
  piece('rings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ring(0.08, 0.018, sx * (L / 2 - 0.25), ringY, sz * poleZ, rm))));
  const pm = gold();
  piece('poles', ...[-1, 1].map((sz) => pole(0.045, 4.5, 0, ringY, sz * poleZ, pm)));
  const sm = stone();
  piece('tablets', box(0.8, 0.12, 0.55, -0.45, wall + 0.06, 0, sm), box(0.8, 0.12, 0.55, 0.45, wall + 0.06, 0, sm));
  // Cover: one handbreadth (⅙ cubit) thick, per b. Sukkah 5a — the text gives only length and width.
  const seatT = 1 / 6, top = H + seatT;
  piece('mercy-seat', box(L, seatT, W, 0, H + seatT / 2, 0, gold()));
  // Cherubim: the text gives no form, so these are schematic kneeling figures facing each other.
  const cx = L / 2 - 0.3, cm = gold();
  piece('cherubim', ...[-1, 1].map((sx) => {
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
  piece('wings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const w = new THREE.Mesh(wingGeo, wm);
    w.scale.x = -sx; // grow toward the centre from either end
    w.position.set(sx * cx, top + 0.45, sz * 0.13); w.rotation.x = sz * 0.25;
    return w;
  })));
  return unit;
}

/**
 * Table (25:23-30): acacia, 2 × 1 × 1½, overlaid with gold, with a gold molding, a rim a
 * handbreadth wide with its own molding, four rings at the legs near the rim, poles, and gold
 * vessels; the bread is a loose part, set out separately (40:23).
 */
export function table(p = 'table'): THREE.Group {
  const { unit, piece, loose } = furniture(p);
  const H = 1.5, T = 0.08, legX = 0.92, legZ = 0.42;
  const frame = (grow: number, mat: THREE.Material) => [
    box(2 + grow, T + grow, 1 + grow, 0, H - T / 2, 0, mat),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.08 + grow, H - T, 0.08 + grow, sx * legX, (H - T) / 2, sz * legZ, mat))),
  ];
  piece('body', ...frame(0, wood()));
  piece('overlay', ...frame(0.015, gold()));
  // Molding: a raised gold border round the top edge.
  const mm = gold(), tl = 0.03;
  piece('moulding',
    ...[-1, 1].map((sz) => box(2 + 2 * tl, 0.05, tl, 0, H + 0.02, sz * (0.5 + tl / 2), mm)),
    ...[-1, 1].map((sx) => box(tl, 0.05, 1, sx * (1 + tl / 2), H + 0.02, 0, mm)));
  // Rim (misgeret), a handbreadth wide: read here as a frame joining the legs just under the top;
  // others read it as a border standing up round the top. Its molding is the thin band along its foot.
  const rm = gold(), rimH = 1 / 6, rimY = H - T - rimH / 2;
  piece('rim',
    ...[-1, 1].flatMap((sz) => [box(2 * legX, rimH, 0.03, 0, rimY, sz * legZ, rm), box(2 * legX + 0.04, 0.025, 0.05, 0, rimY - rimH / 2, sz * legZ, rm)]),
    ...[-1, 1].flatMap((sx) => [box(0.03, rimH, 2 * legZ, sx * legX, rimY, 0, rm), box(0.05, 0.025, 2 * legZ + 0.04, sx * legX, rimY - rimH / 2, 0, rm)]));
  // Rings at the four corners, on the legs, close to the rim (25:26-27), turned for poles along the length.
  const ringY = rimY - rimH / 2 - 0.08, poleZ = legZ + 0.08, rg = gold();
  piece('rings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ring(0.05, 0.012, sx * legX, ringY, sz * poleZ, rg))));
  const pm = gold();
  piece('poles', ...[-1, 1].map((sz) => pole(0.03, 3.5, 0, ringY, sz * poleZ, pm)));
  // Vessels (25:29), none of them sized: two plates under the bread, two dishes (for the frankincense
  // laid on the rows, Lev 24:7), and a pitcher and a bowl for the drink offerings at each end.
  const vm = gold(), onTop = H + 0.01;
  vm.side = THREE.DoubleSide; // the bowl and pitcher are open shells
  const plateGeo = cylGeo(0.34, 0.02, 28, 0.32), dishGeo = cylGeo(0.07, 0.05, 16, 0.05);
  const pitcherGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.065, 0.06], [0.05, 0.14], [0.035, 0.18], [0.045, 0.2], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  const bowlGeo = new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowlGeo.translate(0, 0.07, 0);
  piece('vessels',
    ...[-0.45, 0.45].map((dx) => meshAt(plateGeo, vm, dx, onTop, 0)),
    ...[-0.2, 0.2].map((dz) => meshAt(dishGeo, vm, 0, onTop + 0.025, dz)),
    ...[-1, 1].flatMap((sx) => [meshAt(pitcherGeo, vm, sx * 0.88, onTop - 0.01, -0.3), meshAt(bowlGeo, vm, sx * 0.88, onTop - 0.01, 0.3)]));
  // Twelve loaves in two stacks of six (Lev 24:5-6).
  const bm = new THREE.MeshStandardMaterial({ color: 0xd9b37a, roughness: 0.9 });
  loose('bread', instances(cylGeo(0.3, 0.08, 24), bm, [-0.45, 0.45].flatMap((dx) => Array.from({ length: 6 }, (_, i): V3 => [dx, H + 0.06 + i * 0.085, 0]))));
  return unit;
}

/**
 * Lampstand (25:31-39), laid out after b. Menachot 28b: 18 handbreadths (3 cubits) high, the three
 * branch pairs leaving the shaft at knobs 8½, 10½ and 12½ handbreadths up and rising to the full
 * height; a base with a flower; a goblet, knob and flower at 5–6; three goblets, a knob and a
 * flower at the top — 22 goblets, 11 knobs and 9 flowers in all. Shapes are schematic. The lamps
 * and the tools are loose parts, set on it and beside it (40:24-25).
 */
export function lampstand(p = 'lampstand'): THREE.Group {
  const { unit, piece, loose } = furniture(p);
  const hb = 1 / 6, top = 18 * hb;
  const gobletGeo = cylGeo(0.05, 0.11, 12, 0.018), knobGeo = new THREE.SphereGeometry(0.05, 16, 12), flowerGeo = cylGeo(0.075, 0.045, 16, 0.03);
  const goblet = (m: THREE.Material, x: number, y: number) => meshAt(gobletGeo, m, x, y, 0);
  const knob = (m: THREE.Material, x: number, y: number, k = 1) => { const n = meshAt(knobGeo, m, x, y, 0); n.scale.set(k, 0.8 * k, k); return n; };
  const flower = (m: THREE.Material, x: number, y: number) => meshAt(flowerGeo, m, x, y, 0);
  const sm = gold();
  piece('shaft', post(0, 0, top, 0.04, sm), meshAt(cylGeo(0.2, 0.3, 24, 0.3), sm, 0, 0.15, 0), flower(sm, 0, 3 * hb - 0.03));
  const branchR = [8.5, 10.5, 12.5].map((h) => top - h * hb); // a branch leaving at a knob rises to the top
  const bm = gold();
  piece('branches', ...branchR.map((r) => {
    const arc = meshAt(new THREE.TorusGeometry(r, 0.028, 8, 48, Math.PI), bm, 0, top, 0);
    arc.rotation.z = Math.PI; return arc;
  }));
  // Along a branch, φ runs from 0 at the shaft to π/2 at its lamp; the verse's cups sit near the top.
  const onBranch = (r: number, side: number, phi: number): [number, number] => [side * r * Math.sin(phi), top - r * Math.cos(phi)];
  const cm = gold();
  piece('branch-cups', ...branchR.flatMap((r) => [-1, 1].flatMap((side) => [
    ...[1.0, 1.17, 1.34].map((phi) => goblet(cm, ...onBranch(r, side, phi))),
    knob(cm, ...onBranch(r, side, 1.44)), flower(cm, ...onBranch(r, side, 1.52)),
  ])));
  const scm = gold();
  piece('shaft-cups',
    goblet(scm, 0, 5.2 * hb), knob(scm, 0, 5.5 * hb), flower(scm, 0, 5.85 * hb),
    ...[15.4, 16, 16.6].map((h) => goblet(scm, 0, h * hb)), knob(scm, 0, 17.2 * hb), flower(scm, 0, 17.7 * hb));
  const km = gold();
  piece('knobs', ...branchR.map((r) => knob(km, 0, top - r, 1.3)));
  // Seven lamps, their spouts turned north so they "illuminate the area in front of it" (25:37).
  const flame = new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa53a, emissiveIntensity: 2 });
  const lampGeo = new THREE.SphereGeometry(0.075, 16, 10), flameGeo = new THREE.ConeGeometry(0.03, 0.12, 12), lm = gold();
  loose('lamps', ...[0, ...branchR.flatMap((r) => [-r, r])].flatMap((dx) => {
    const body = meshAt(lampGeo, lm, dx, top + 0.04, -0.02); body.scale.set(1, 0.45, 1.4);
    return [body, meshAt(flameGeo, flame, dx, top + 0.1, -0.12)];
  }));
  // Wick trimmers (tongs) and their trays (25:38), set down beside the base.
  const tm = gold(), trayGeo = cylGeo(0.15, 0.03, 20, 0.13), tongGeo = new THREE.BoxGeometry(0.28, 0.015, 0.02);
  loose('tools', ...[-1, 1].flatMap((sx) => {
    const x = sx * 0.6, z = 0.2;
    const a = meshAt(tongGeo, tm, x, 0.04, z), b = meshAt(tongGeo, tm, x, 0.04, z);
    a.rotation.y = 0.12; b.rotation.y = -0.12;
    return [meshAt(trayGeo, tm, x, 0.015, z), a, b];
  }));
  return unit;
}

/**
 * Altar of incense (30:1-5): acacia, 1 × 1 × 2 with horns of one piece, overlaid with gold on
 * the top, sides and horns, a gold molding, two gold rings below it and poles.
 */
export function incenseAltar(p = 'incense-altar'): THREE.Group {
  const { unit, piece } = furniture(p);
  const H = 2, horn = new THREE.ConeGeometry(0.08, 0.2, 12);
  const horns = (mat: THREE.Material, k: number) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => { const h = meshAt(horn, mat, sx * 0.42, H + 0.1, sz * 0.42); h.scale.setScalar(k); return h; }));
  piece('body', box(1, H, 1, 0, H / 2, 0, wood()));
  piece('horns', ...horns(wood(), 1));
  const om = gold();
  piece('overlay', box(1.02, H + 0.01, 1.02, 0, H / 2, 0, om), ...horns(om, 1.12));
  const mm = gold(), lip = 0.04, crownY = H - 0.04;
  piece('moulding',
    ...[-1, 1].map((sz) => box(1 + 2 * lip, 0.08, lip, 0, crownY, sz * (0.51 + lip / 2), mm)),
    ...[-1, 1].map((sx) => box(lip, 0.08, 1.02, sx * (0.51 + lip / 2), crownY, 0, mm)));
  // One ring on each of two opposite sides; "two rings… on its two sides" is also read as two a side.
  const ringY = H - 0.3, poleZ = 0.6, rg = gold();
  piece('rings', ...[-1, 1].map((sz) => ring(0.07, 0.016, 0, ringY, sz * poleZ, rg)));
  const pm = gold();
  piece('poles', ...[-1, 1].map((sz) => pole(0.035, 3, 0, ringY, sz * poleZ, pm)));
  return unit;
}

/**
 * Altar of burnt offering (27:1-8): a hollow box of acacia boards (v. 8), 5 × 5 × 3, horns of one
 * piece, overlaid with bronze; its utensils; a bronze mesh grate with a ring at each corner, set
 * under the ledge so it comes halfway up; poles through the rings on two sides.
 */
export function bronzeAltar(p = 'altar'): THREE.Group {
  const { unit, piece } = furniture(p);
  const S = 5, H = 3, board = 0.12;
  const walls = (grow: number, mat: THREE.Material) => [-1, 1].flatMap((s) => [
    box(S + grow, H + grow, board + grow, 0, H / 2, s * (S / 2 - board / 2), mat),
    box(board + grow, H + grow, S + grow, s * (S / 2 - board / 2), H / 2, 0, mat),
  ]);
  piece('body', ...walls(0, wood()));
  const horn = new THREE.ConeGeometry(0.25, 0.5, 12), hm = bronze();
  piece('horns', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => meshAt(horn, hm, sx * 2.25, H + 0.25, sz * 2.25))));
  piece('overlay', ...walls(0.03, bronze()));
  // Utensils (27:3): pots for the ashes, shovels, sprinkling bowls, meat forks and firepans, laid out
  // on the north side. None of their sizes is given.
  const um = bronze(), ux = (i: number) => -2 + i, uz = -3.4;
  const pot = meshAt(cylGeo(0.22, 0.35, 20, 0.18), um, ux(0), 0.175, uz);
  const shovel = new THREE.Group().add(box(0.3, 0.02, 0.35, 0, 0.01, 0.2, um), meshAt(cylGeo(0.02, 0.8, 8), um, 0, 0.02, -0.35).rotateX(Math.PI / 2));
  shovel.position.set(ux(1), 0, uz);
  const sprinkler = meshAt(new THREE.SphereGeometry(0.18, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), um, ux(2), 0.18, uz);
  const fork = new THREE.Group().add(meshAt(cylGeo(0.015, 0.7, 8), um, 0, 0.02, -0.25).rotateX(Math.PI / 2),
    ...[-0.05, 0, 0.05].map((dx) => box(0.012, 0.012, 0.18, dx, 0.02, 0.18, um)));
  fork.position.set(ux(3), 0, uz);
  const pan = new THREE.Group().add(meshAt(cylGeo(0.2, 0.05, 20, 0.18), um, 0, 0.025, 0.1), box(0.03, 0.02, 0.4, 0, 0.03, -0.28, um));
  pan.position.set(ux(4), 0, uz);
  piece('utensils', pot, shovel, sprinkler, fork, pan);
  // Grate: a bronze mesh round the lower half, just outside the walls, as its corner rings imply.
  const gm = bronze(), gOff = S / 2 + 0.08, gH = H / 2, step = 0.25;
  const upright: V3[] = [], alongX: V3[] = [], alongZ: V3[] = [];
  for (const s of [-1, 1]) {
    for (let u = -S / 2; u <= S / 2 + 1e-6; u += step) upright.push([u, gH / 2, s * gOff], [s * gOff, gH / 2, u]);
    for (let y = step; y <= gH + 1e-6; y += step) alongX.push([0, y, s * gOff]), alongZ.push([s * gOff, y, 0]);
  }
  piece('grate', instances(boxGeo(0.03, gH, 0.03), gm, upright), instances(boxGeo(S + 0.16, 0.03, 0.03), gm, alongX), instances(boxGeo(0.03, 0.03, S + 0.16), gm, alongZ));
  const ringY = gH - 0.15, poleZ = gOff + 0.1, rg = bronze();
  piece('rings', ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ring(0.12, 0.03, sx * 2.2, ringY, sz * poleZ, rg))));
  // Ledge (karkov, a rare word): drawn as a band round the altar where the grate ends, halfway up.
  const lm = bronze(), lw = 0.3;
  piece('ledge',
    ...[-1, 1].map((sz) => box(S + 2 * lw, 0.15, lw, 0, gH + 0.075, sz * (S / 2 + lw / 2), lm)),
    ...[-1, 1].map((sx) => box(lw, 0.15, S, sx * (S / 2 + lw / 2), gH + 0.075, 0, lm)));
  const pm = bronze();
  piece('poles', ...[-1, 1].map((sz) => pole(0.1, 7.5, 0, ringY, sz * poleZ, pm)));
  return unit;
}

/** Basin: bronze on a bronze stand (30:18). No size or shape is given. */
export function basin(p = 'basin'): THREE.Group {
  const unit = new THREE.Group(), lv = bronze();
  lv.side = THREE.DoubleSide; // the bowl is an open shell
  const bowl = meshAt(new THREE.SphereGeometry(0.9, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lv, 0, 1.9, 0);
  namedPart(unit)(p, meshAt(cylGeo(0.2, 1.9, 24, 0.45), lv, 0, 0.95, 0), bowl);
  return unit;
}
