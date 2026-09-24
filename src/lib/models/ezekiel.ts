import * as THREE from 'three';
import { box, boxGeo, cylGeo, furniture, instances, meshAt, namedPart, type V3 } from './kit';

const ashlar = () => new THREE.MeshStandardMaterial({ color: 0xb3a582, roughness: 0.95 });
const paving = () => new THREE.MeshStandardMaterial({ color: 0x857761, roughness: 1 });
const earth = () => new THREE.MeshStandardMaterial({ color: 0x9a8b6a, roughness: 1 });
const timber = () => new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.8 });
const relief = () => new THREE.MeshStandardMaterial({ color: 0x8c7a55, roughness: 0.9, side: THREE.DoubleSide });
const dark = () => new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 1 });

/** One step's rise, the platform's 6 cubits (41:8) over the ten steps up to it (40:49). */
const RISE = 0.6;
/** The gate buildings' walls, whose height the text does not give (see models.json on 40:14). */
const GATE_H = 10;

/** A palm tree carved in low relief, 6 high and facing +z, its foot at the origin. */
function palmGeometry(): THREE.ShapeGeometry {
  const trunk = new THREE.Shape();
  trunk.moveTo(-0.25, 0); trunk.lineTo(0.25, 0); trunk.lineTo(0.15, 4.4); trunk.lineTo(-0.15, 4.4); trunk.lineTo(-0.25, 0);
  const fronds = [15, 45, 75, 105, 135, 165].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg), dx = Math.cos(a), dy = Math.sin(a), nx = -dy * 0.35, ny = dx * 0.35;
    const s = new THREE.Shape(), y0 = 4.3, tip = [1.9 * dx, y0 + 1.9 * dy - 0.5 * Math.abs(dx)];
    s.moveTo(0, y0); s.quadraticCurveTo(dx + nx, y0 + dy + ny, tip[0], tip[1]); s.quadraticCurveTo(dx - nx, y0 + dy - ny, 0, y0);
    return s;
  });
  return new THREE.ShapeGeometry([trunk, ...fronds], 6);
}

/**
 * A gate building (40:6-16), 50 long and 25 wide, drawn in its own frame: its passage runs along
 * +x from the outer threshold at x = 0 to the portico's jambs at x = 50, centred on z = 0, its floor
 * at y = 0. Along the passage: the threshold (6), three chambers a side (6 each) with 5-cubit piers
 * between, the inner threshold (6), the portico (8) and its jambs (2). The outer gates are climbed by
 * seven steps before their threshold (40:22); the inner gates face the other way, their portico
 * toward the outer court, and are climbed by eight steps before the portico (40:31), standing on a
 * base as high as those steps. Parts are named `p-…`, as furniture is, so seven gates can share it.
 */
function gate(p: string, steps: number, stepsAtPortico: boolean): THREE.Group {
  const { unit, piece } = furniture(p);
  const W = 12.5, P = 5, C = 11, H = GATE_H, drop = steps * RISE; // half-widths: gate, passage, chambers' back wall
  const sides = (f: (s: number) => THREE.Object3D) => [f(-1), f(1)];

  // Steps up to it: treads a cubit deep across the 10-cubit entrance, the last step being the floor.
  const sm = ashlar(), treads: THREE.Object3D[] = [];
  for (let k = 1; k < steps; k++) {
    const h = drop - k * RISE, x = stepsAtPortico ? 50 + k - 0.5 : -k + 0.5;
    treads.push(box(1, h, 2 * P, x, -drop + h / 2, 0, sm));
  }
  if (stepsAtPortico) treads.push(box(50, drop, 2 * W, 25, -drop / 2, 0, sm));
  piece('steps', ...treads).userData.ground = true; // the inner gates' base is a floor the figure can stand on

  // The threshold, a rod deep (40:6), between the masses of the wall.
  const tm = ashlar();
  piece('threshold', box(6, 0.2, 2 * P, 3, 0, 0, tm), ...sides((s) => box(6, H, W - P, 3, H / 2, s * (P + W) / 2, tm)));
  // Three chambers a side, each a rod square, with 5 cubits between them (40:7, 10): the piers and the back walls.
  const cm = ashlar();
  piece('chambers', ...sides((s) => box(28, H, W - C, 20, H / 2, s * (C + W) / 2, cm)),
    ...[14.5, 25.5].flatMap((x) => sides((s) => box(5, H, C - P, x, H / 2, s * (C + P) / 2, cm))));
  const im = ashlar();
  piece('inner-threshold', box(6, 0.2, 2 * P, 37, 0, 0, im), ...sides((s) => box(6, H, W - P, 37, H / 2, s * (P + W) / 2, im)));
  // The portico, 8 deep, and its jambs, 2 thick (40:9).
  const pm = ashlar();
  piece('portico', ...sides((s) => box(8, H, W - C, 44, H / 2, s * (C + W) / 2, pm)), ...sides((s) => box(2, H, W - P, 49, H / 2, s * (P + W) / 2, pm)));
  // A wall a cubit high in front of each chamber (40:12).
  const bm = ashlar();
  piece('barriers', ...[9, 20, 31].flatMap((x) => sides((s) => box(6, 1, 0.5, x, 0.5, s * (P + 0.25), bm))));
  // Roofs over the chambers, 25 cubits from the back of one to the back of the other (40:13), and over the portico.
  const rm = ashlar();
  piece('roof', ...sides((s) => box(34, 0.5, W - P, 17, H + 0.25, s * (P + W) / 2, rm)), box(16, 0.5, 2 * W, 42, H + 0.25, 0, rm));
  // The gateposts, sixty cubits high (40:14 as the BSB reads it): the portico's jambs carried up.
  const gm = ashlar();
  piece('posts', ...sides((s) => box(2, 60 - H, W - P, 49, (60 + H) / 2, s * (P + W) / 2, gm)));
  // Windows all round the inside (40:16): a slot through the back wall of each chamber and of the portico.
  piece('windows', instances(boxGeo(2, 3, W - C + 0.2), dark(), [9, 20, 31, 44].flatMap((x) => [-1, 1].map((s): V3 => [x, H * 0.6, s * (C + W) / 2]))));
  // Palm trees on the side pillars (40:16): on the piers and the jambs, facing the passage.
  const palm = palmGeometry(), lm = relief();
  piece('palms', ...[14.5, 25.5, 49].flatMap((x) => sides((s) => { const m = meshAt(palm, lm, x, 1.5, s * (P - 0.03)); m.rotation.y = s > 0 ? Math.PI : 0; return m; })));
  return unit;
}

/**
 * Ezekiel's temple (Ezek 40–43), in long cubits (a cubit and a handbreadth, 40:5). East is +x and
 * north −z, as in Solomon's temple; the altar stands at the origin, in the middle of the inner court
 * and of the whole square. Along the east–west axis the text's measures add up to the 500 of 42:16-20:
 * the outer gate (50), the outer court between the gates (100), the inner gate (50), the inner court
 * (100), the temple (100), and the yard and west building (100). North and south likewise, with the
 * priests' chambers beside the temple. The heights are mostly estimates; each basis is in models.json.
 * Parts flagged `userData.cutaway` form the temple house, which the viewer can cut open.
 */
export function ezekielsTemple(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const house = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };
  const sides = (f: (s: number) => THREE.Object3D | THREE.Object3D[]) => [f(-1), f(1)].flat();

  // Floor levels: the ground outside, then seven steps up to the outer court (40:22), eight more to
  // the inner court (40:31) and ten to the temple (40:49), which stands on its 6-cubit platform (41:8).
  const E = 250, OUT = 7 * RISE, IN = OUT + 8 * RISE, TF = IN + 10 * RISE;

  // The wall round the whole, a rod thick and a rod high (40:5), with openings for the three outer gates.
  const wm = ashlar(), wallH = OUT + 6, t = 6;
  const run = (from: number, to: number, fixed: number, alongX: boolean) =>
    alongX ? box(to - from, wallH, t, (from + to) / 2, wallH / 2, fixed, wm) : box(t, wallH, to - from, fixed, wallH / 2, (from + to) / 2, wm);
  part('outer-wall',
    ...sides((s) => [run(-E, -12.5, s * (E - t / 2), true), run(12.5, E, s * (E - t / 2), true)]),
    run(-E + t, -12.5, E - t / 2, false), run(12.5, E - t, E - t / 2, false), run(-E + t, E - t, -E + t / 2, false));

  // The gates: the east first, piece by piece (40:6-16), then the north and south, 'with the same
  // measurements' (40:21, 24), then the three gates of the inner court (40:28-37).
  const placeGate = (unit: THREE.Object3D, x: number, y: number, z: number, turn: number) => { unit.position.set(x, y, z); unit.rotation.y = turn; g.add(unit); return unit; };
  placeGate(gate('east-gate', 7, false), E, OUT, 0, Math.PI);
  placeGate(gate('north-gate', 7, false), 0, OUT, -E, -Math.PI / 2);
  placeGate(gate('south-gate', 7, false), 0, OUT, E, Math.PI / 2);
  placeGate(gate('inner-south-gate', 8, true), 0, IN, 50, -Math.PI / 2);
  placeGate(gate('inner-east-gate', 8, true), 50, IN, 0, 0);
  const northFrame = placeGate(gate('inner-north-gate', 8, true), 0, IN, -50, Math.PI / 2);

  // The outer court, raised seven steps, and its lower pavement along the walls, as wide as the gates
  // are long (40:17-18). West of the temple the building stands where the pavement would be.
  const inside = E - t, pave = 50;
  part('outer-court', box(2 * inside, OUT, 2 * inside, 0, OUT / 2, 0, earth()));
  const pv = paving();
  part('pavement', ...sides((s) => box(2 * inside, 0.1, pave, 0, OUT + 0.05, s * (inside - pave / 2), pv)),
    box(pave, 0.1, 2 * (inside - pave), inside - pave / 2, OUT + 0.05, 0, pv));
  // Thirty chambers facing the pavement (40:17): ten along each wall that has a gate, five either side of it.
  const chamberAt: V3[] = [], cw = 20, cd = 10, ch = 8;
  for (const along of [40, 80, 120, 160, 200].flatMap((a) => [-a, a])) {
    chamberAt.push([inside - cd / 2, OUT + ch / 2, along], [along, OUT + ch / 2, -(inside - cd / 2)], [along, OUT + ch / 2, inside - cd / 2]);
  }
  const om = ashlar(), eastRow = chamberAt.filter((_, i) => i % 3 === 0), otherRows = chamberAt.filter((_, i) => i % 3 !== 0);
  part('outer-chambers', instances(boxGeo(cd, ch, cw), om, eastRow), instances(boxGeo(cw, ch, cd), om, otherRows));

  // Beside the portico of each inner gate, a chamber where the burnt offering was washed (40:38).
  const wr = ashlar();
  part('washing-rooms', box(8, ch, 6, 94, OUT + ch / 2, -15.5, wr), ...sides((s) => box(6, ch, 8, 15.5, OUT + ch / 2, s * 94, wr)));
  // In and outside the portico of the inner north gate, eight tables for slaughtering (40:39-41), and
  // four of dressed stone, a cubit and a half square and a cubit high, for the burnt offering (40:42),
  // either side of the way through.
  // They are laid out in the gate's own frame, so they turn with it.
  const tableGroup = (name: string, at: [number, number, number][], mat: THREE.Material) => {
    const frame = new THREE.Group(); frame.position.copy(northFrame.position); frame.rotation.copy(northFrame.rotation);
    frame.add(...at.map(([x, y, z]) => box(1.5, 1, 1.5, x, y + 0.5, z, mat)));
    return part(name, frame);
  };
  tableGroup('slaughter-tables', [42, 46].flatMap((x) => [-1, 1].map((s): [number, number, number] => [x, 0, s * 8.5]))
    .concat([52, 55].flatMap((x) => [-1, 1].map((s): [number, number, number] => [x, -8 * RISE, s * 8.5]))), timber());
  tableGroup('stone-tables', [42, 46].flatMap((x) => [-1, 1].map((s): [number, number, number] => [x, 0, s * 3])), ashlar());

  // Two chambers in the inner court, beside the north gate facing south and beside the south gate facing north (40:44-46).
  part('priests-rooms', ...sides((s) => box(25, ch, 10, 30, IN + ch / 2, s * 45, ashlar())));
  // The inner court, 100 cubits square (40:47), raised eight steps, with the temple's yard behind it.
  part('inner-court', box(220, IN - OUT, 100, -60, (IN + OUT) / 2, 0, earth()));

  // The temple house (40:48–41:26). The portico's front is at x = −50; then its 12 depth, the nave's
  // 6-cubit front wall, the nave (40), the partition (2), the Most Holy Place (20), the back wall (6),
  // the side rooms (4) and their outer wall (5): 100 in all (41:13). Its height is not given.
  const H = 30, hy = (y: number) => TF + y;
  const hbox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => box(w, h, d, x, hy(y), z, mat);
  const P0 = -50, P1 = -67, N1 = -73, S0 = -113, S1 = -115, B0 = -135, B1 = -141, HALF = 10;
  // The portico (40:48-49): side walls 5 thick, the front stepping in 3 either side of a 14-cubit opening.
  const qm = ashlar();
  house('temple-portico', ...sides((s) => [hbox(P0 - P1, H, 5, (P0 + P1) / 2, H / 2, s * 12.5, qm), hbox(5, H, 3, P0 - 2.5, H / 2, s * 8.5, qm)]),
    hbox(5, H - 20, 14, P0 - 2.5, 20 + (H - 20) / 2, 0, qm));
  // Ten steps up to it (40:49), on the axis, as wide as its opening.
  const tm = ashlar(), up: THREE.Object3D[] = [];
  for (let k = 1; k < 10; k++) { const h = TF - k * RISE - IN; up.push(box(1, h, 14, P0 + k - 0.5, IN + h / 2, 0, tm)); }
  part('temple-steps', ...up);
  // A column by each jamb (40:49), standing on the court before the portico.
  const colM = ashlar();
  part('columns', ...sides((s) => meshAt(cylGeo(1.9, 18, 32), colM, P0 + 3, IN + 9, s * 10)));

  // The house's walls, 6 cubits thick (41:1, 5), narrowing a cubit at each storey of the side rooms
  // so their beams rest on ledges rather than in the wall (41:6-7). The nave's doorway is 10 wide (41:2).
  const tiers: [number, number, number][] = [[0, 5, 6], [5, 11, 5], [11, H, 4]], door = { w: 10, h: 15 };
  const hw = house('temple-walls');
  for (const [y0, y1, th] of tiers) {
    const m = ashlar(), h = y1 - y0, cy = (y0 + y1) / 2;
    hw.add(...sides((s) => hbox(N1 - (B1 + 6 - th), h, th, (N1 + B1 + 6 - th) / 2, cy, s * (HALF + th / 2), m)), hbox(th, h, 2 * HALF, B0 - th / 2, cy, 0, m));
  }
  const fm = ashlar();
  hw.add(...sides((s) => hbox(6, H, 16 - door.w / 2, (N1 + P1) / 2, H / 2, s * (16 + door.w / 2) / 2, fm)), hbox(6, H - door.h, door.w, (N1 + P1) / 2, (H + door.h) / 2, 0, fm));
  // The wall into the inner sanctuary, 2 thick, with a doorway of 6 (41:3).
  const dw = 6, dh = 10, am = ashlar();
  house('partition', ...sides((s) => hbox(2, H, HALF - dw / 2, (S0 + S1) / 2, H / 2, s * (HALF + dw / 2) / 2, am)), hbox(2, H - dh, dw, (S0 + S1) / 2, (H + dh) / 2, 0, am));

  // Side rooms 4 wide round the north, south and west (41:5), three storeys (41:6), inside an outer
  // wall 5 thick (41:9). The rooms' own partitions are not drawn.
  const CH = 18, RZ = 20, RX = -145, RE = P1 - 5, rm = ashlar(); // RE: the inner face of the rooms' east end
  house('side-rooms', ...sides((s) => [hbox(P1 - (RX - 5), CH, 5, (P1 + RX - 5) / 2, CH / 2, s * (RZ + 2.5), rm), hbox(5, CH, RZ - 16, P1 - 2.5, CH / 2, s * (RZ + 16) / 2, rm)]),
    hbox(5, CH, 2 * (RZ + 5), RX - 2.5, CH / 2, 0, rm));
  // Their floors, resting on the ledges (41:6), so the rooms widen upward: 4, 5 and 6 cubits (41:7).
  const flm = timber(), floors = house('side-floors');
  for (const [y, th] of [[5, 5], [11, 4]]) {
    const inner = HALF + th, w = RZ - inner;
    floors.add(...sides((s) => hbox(RE - RX, 1, w, (RE + RX) / 2, y + 0.5, s * (RZ + inner) / 2, flm)), hbox(B0 - th - RX, 1, 2 * inner, (B0 - th + RX) / 2, y + 0.5, 0, flm));
  }
  // A stairway from the lowest storey to the highest, through the middle one (41:7): drawn winding, in the north rooms.
  const stM = timber(), stair = house('stairway'), stairX = -100, stairZ = -(RZ - 2);
  for (let i = 0; i < 22; i++) {
    const pivot = new THREE.Object3D(); pivot.position.set(stairX, hy(0.5 * i + 0.25), stairZ); pivot.rotation.y = (i * Math.PI) / 6;
    pivot.add(box(1.5, 0.25, 0.7, 0.95, 0, 0, stM)); stair.add(pivot);
  }
  stair.add(meshAt(cylGeo(0.2, 11, 10), stM, stairX, hy(5.5), stairZ));
  // The raised base under the house and its side rooms, a rod high (41:8), with the 5-cubit free space round it (41:11).
  part('platform', box(P0 - (RX - 5) + 5, TF - IN, 2 * (RZ + 5 + 5), (P0 + RX - 5 - 5) / 2, (IN + TF) / 2, 0, ashlar()));
  // The side rooms' two entrances onto the free space, one north and one south (41:11).
  part('side-doors', instances(boxGeo(3, 4, 5.2), dark(), [-1, 1].map((s): V3 => [-100, hy(2), s * (RZ + 2.5)])));
  // The west building, 70 wide and 90 long inside walls 5 thick (41:12), across the yard behind the
  // temple. Its west wall is the outer wall's. Its height is not given.
  const xm = ashlar(), BX0 = -inside, BX1 = -170, BZ = 50, bh = 20;
  part('west-building', ...sides((s) => box(BX1 - BX0, bh, 5, (BX0 + BX1) / 2, OUT + bh / 2, s * (BZ - 2.5), xm)), box(5, bh, 2 * BZ - 10, BX1 - 2.5, OUT + bh / 2, 0, xm),
    box(BX1 - BX0, 0.8, 2 * BZ, (BX0 + BX1) / 2, OUT + bh + 0.4, 0, xm));

  // Wood on every inner face, floor to windows (41:16), drawn floor to ceiling.
  const skin = 0.15, pnl = timber();
  house('panelling', ...sides((s) => hbox(N1 - B0, H, skin, (N1 + B0) / 2, H / 2, s * (HALF - skin / 2), pnl)), hbox(skin, H, 2 * HALF, B0 + skin / 2, H / 2, 0, pnl),
    ...sides((s) => hbox(skin, H, HALF - door.w / 2, N1 - skin / 2, H / 2, s * (HALF + door.w / 2) / 2, pnl)));
  // Beveled windows (41:16), high in the walls above the side rooms.
  const winAt: V3[] = [];
  for (let x = B0 + 3; x < N1; x += 6) for (const s of [-1, 1]) winAt.push([x, hy(24), s * (HALF + 2)]);
  house('temple-windows', instances(boxGeo(1, 5, 4.5), dark(), winAt));
  // The altar of wood, 3 high and 2 square, 'the table that is before the LORD' (41:22), before the inner sanctuary.
  part('wooden-altar', hbox(2, 3, 2, S0 + 4, 1.5, 0, timber()));
  // Double doors of two leaves each, to the nave and to the inner sanctuary (41:23-24), drawn closed.
  const dm = timber();
  part('doors', ...[-3.75, -1.25, 1.25, 3.75].map((z) => hbox(0.3, door.h, 2.45, (N1 + P1) / 2, door.h / 2, z, dm)),
    ...[-2.25, -0.75, 0.75, 2.25].map((z) => hbox(0.3, dh, 1.45, (S0 + S1) / 2, dh / 2, z, dm)));
  // A wooden canopy on the front of the portico (41:25).
  part('canopy', hbox(3, 0.5, 20, P0 + 1.5, 21, 0, timber()));
  // The roofs. Ezekiel never mentions the house's; the side rooms' 'canopies' (41:26) are the nearest.
  const cr = timber();
  house('roof', hbox(P0 - B1, 0.8, 2 * (HALF + 6), (P0 + B1) / 2, H + 0.4, 0, cr),
    ...sides((s) => hbox(P1 - (RX - 5), 0.8, RZ + 5 - (HALF + 4), (P1 + RX - 5) / 2, CH + 0.4, s * (RZ + 5 + HALF + 4) / 2, cr)),
    hbox(B0 - 4 - (RX - 5), 0.8, 2 * (HALF + 4), (B0 - 4 + RX - 5) / 2, CH + 0.4, 0, cr));

  // North of the temple's yard, the priests' chambers (42:1-9): a block of three storeys, 100 long on the
  // inner side and 50 on the outer, with a walkway of 10 between (42:4) and a wall 50 long where the
  // outer block is short (42:7). South of it, the same (42:10-12). The upper storeys are set back (42:5-6).
  const block = (len: number, x: number, z: number, deep: number, s: number, mat: THREE.Material) =>
    [0, 1, 2].map((i) => { const d = deep - 2 * i; return box(len, 5, d, x, OUT + 2.5 + 5 * i, s * (z - (deep - d) / 2), mat); });
  const priestBlock = (s: number) => { const m = ashlar(); return [...block(100, -100, 60, 20, s, m), ...block(50, -125, 90, 20, s, m)]; };
  part('north-chambers', ...priestBlock(-1));
  part('north-chamber-wall', box(50, 5, 1, -75, OUT + 2.5, -80.5, ashlar()));
  part('south-chambers', ...priestBlock(1), box(50, 5, 1, -75, OUT + 2.5, 80.5, ashlar()));

  // The altar (43:13-17), in the middle of the inner court: a base with a gutter a cubit deep and a
  // rim of a span, a lower ledge 2 high, a larger ledge 4 high and 14 square, and the hearth, 12
  // square and 4 high, with four horns. Its steps face east.
  // The altar's parts share one unit, so the camera frames the whole altar while each is added.
  const altar = new THREE.Group(), altarPart = namedPart(altar);
  g.add(altar);
  const alt = (w: number, h: number, y: number, mat: THREE.Material) => box(w, h, w, 0, IN + y + h / 2, 0, mat);
  const bm = ashlar();
  altarPart('altar-base', alt(18, 0.5, 0, bm), ...sides((s) => [box(18, 1, 0.5, 0, IN + 0.5 + 0.5, s * 8.75, bm), box(0.5, 1, 17, s * 8.75, IN + 0.5 + 0.5, 0, bm)]));
  const lm = ashlar();
  altarPart('altar-ledges', alt(16, 2, 0.5, lm), alt(14, 4, 2.5, lm));
  altarPart('altar-hearth', alt(12, 4, 6.5, ashlar()));
  const hornGeo = new THREE.ConeGeometry(0.5, 1, 12), hm = ashlar();
  altarPart('altar-horns', ...sides((sx) => sides((sz) => meshAt(hornGeo, hm, sx * 5.5, IN + 11, sz * 5.5))));
  const sm = ashlar(), rise = 6.5 / 11, flight: THREE.Object3D[] = [];
  for (let k = 1; k <= 11; k++) { const h = k * rise; flight.push(box(1, h, 4, 7 + 11 - k + 0.5, IN + h / 2, 0, sm)); }
  altarPart('altar-steps', ...flight);

  // A focus unit is what the camera frames while a step builds any part inside it.
  for (const c of g.children) c.userData.focus = true;
  // The raised floors, which the size figure stands on beside a piece built on them.
  for (const n of ['outer-court', 'pavement', 'inner-court', 'platform']) g.getObjectByName(n)!.userData.ground = true;
  return g;
}
