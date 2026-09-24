import * as THREE from 'three';
import { box, boxGeo, bronze, cloth, cylGeo, gold, instances, meshAt, namedPart, sheet, weave, type V3 } from './kit';
import { ark, incenseAltar, lampstand, table } from './furniture';

const ashlar = () => new THREE.MeshStandardMaterial({ color: 0xcfc3a6, roughness: 0.95 });
const cedar = () => new THREE.MeshStandardMaterial({ color: 0x9a5a34, roughness: 0.8 });
const cypress = () => new THREE.MeshStandardMaterial({ color: 0xc09366, roughness: 0.8 });
const olive = () => new THREE.MeshStandardMaterial({ color: 0xb3a176, roughness: 0.8, side: THREE.DoubleSide });
const dark = () => new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 1 });

/** Radius of a lathe profile at height y, read off its points (which must rise in y). */
const radiusAt = (profile: [number, number][], y: number) => {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return profile[profile.length - 1][0];
};
const lathe = (profile: [number, number][], seg = 48) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/**
 * Solomon's temple (1 Kgs 6–7, 2 Chr 3–4), in cubits. East is +x (the entrance) and north is −z,
 * as in the tabernacle; the interior runs from x = −60 to 0, the Most Holy Place being its western
 * 20. The text gives the house (60 × 20 × 30), the porch, the side-chamber storeys (5, 6 and 7
 * wide), the inner sanctuary (20 cubed), the cherubim, the pillars, the Sea, the stands and the
 * bronze altar; wall thicknesses, the court, the doorways and most placements are estimated, and
 * each basis is recorded in models.json. Parts flagged `userData.cutaway` form the building, which
 * the viewer can cut open to show the furniture inside.
 */
export function temple(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const building = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };
  const place = (unit: THREE.Object3D, x: number, z: number, into: THREE.Object3D = g) => { unit.position.set(x, 0, z); into.add(unit); return unit; };

  const X0 = -60, X1 = 0, HALF = 10, H = 30, DEBIR = -40, EAST = 6;
  // The walls step in a cubit at each storey of the side chambers, so their beams rest on ledges
  // rather than in the wall (6:6): 6 cubits thick (Ezek 41:5) up to the first floor, 5, then 4.
  const tiers: [number, number, number][] = [[0, 5, 6], [5, 11, 5], [11, H, 4]];

  // The house (6:2): stone walls round the 60 × 20 interior, 30 high, with a doorway in the east wall.
  const walls = building('walls');
  for (const [y0, y1, t] of tiers) {
    const hy = y1 - y0, cy = (y0 + y1) / 2, xw = X0 - t;
    const m = ashlar();
    walls.add(...[-1, 1].map((sz) => box(EAST - xw, hy, t, (EAST + xw) / 2, cy, sz * (HALF + t / 2), m)), box(t, hy, 2 * HALF, X0 - t / 2, cy, 0, m));
  }
  const door = { w: 10, h: 15 }, em = ashlar(), eastZ = HALF + 6;
  walls.add(...[-1, 1].map((sz) => box(6, H, eastZ - door.w / 2, 3, H / 2, sz * (door.w / 2 + eastZ) / 2, em)), box(6, H - door.h, door.w, 3, (H + door.h) / 2, 0, em));

  // The porch (6:3): 20 across the front and 10 deep, 20 high (2 Chr 3:4), open to the east.
  const pm = ashlar(), porchH = 20, P1 = EAST + 10;
  building('portico', ...[-1, 1].map((sz) => box(10, porchH, 6, (EAST + P1) / 2, porchH / 2, sz * (HALF + 3), pm)), box(10, 1, 2 * HALF + 12, (EAST + P1) / 2, porchH + 0.5, 0, pm));

  // Windows high in the walls (6:4), above the side chambers: narrow slots through the 4-cubit wall.
  const winAt: V3[] = [];
  for (let x = X0 + 2.5; x < X1; x += 5) for (const sz of [-1, 1]) winAt.push([x, 24, sz * (HALF + 2)]);
  building('windows', instances(boxGeo(1, 6, 4.5), dark(), winAt));

  // Side chambers (6:5-10) round the north, south and west, three storeys each 5 high, their inner
  // edge on the wall's ledges: 5 wide below, 6 in the middle, 7 at the top (6:6). The outer wall's
  // 5 cubits follow Ezek 41:9. The chambers' own partitions are not drawn.
  const CH = 18, CZ = HALF + 6 + 5, CX = X0 - 6 - 5; // top, and the chambers' outer edge at the first storey
  const cm = ashlar();
  building('side-chambers',
    ...[-1, 1].map((sz) => box(EAST - (CX - 5), CH, 5, (EAST + CX - 5) / 2, CH / 2, sz * (CZ + 2.5), cm)),
    box(5, CH, 2 * (CZ + 5), CX - 2.5, CH / 2, 0, cm),
    ...[-1, 1].map((sz) => box(5, CH, CZ - (HALF + 4), EAST - 2.5, CH / 2, sz * (CZ + HALF + 4) / 2, cm)),
    ...[-1, 1].map((sz) => box(EAST - CX, 1, CZ - (HALF + 4), (EAST + CX) / 2, CH - 0.5, sz * (CZ + HALF + 4) / 2, cm)),
    box(X0 - 4 - CX, 1, 2 * (HALF + 4), (X0 - 4 + CX) / 2, CH - 0.5, 0, cm));

  // Floors between the storeys, resting on the ledges. On the south side they leave a stairwell.
  const stairX = -30, stairR = 2.4, fm = cedar(), floors = building('side-floors');
  for (const [y, t] of [[5, 5], [11, 4]]) {
    const inner = HALF + t, w = CZ - inner, cz = (CZ + inner) / 2;
    floors.add(box(EAST - CX, 1, w, (EAST + CX) / 2, y + 0.5, -cz, fm));
    for (const [a, b] of [[CX, stairX - stairR], [stairX + stairR, EAST]]) floors.add(box(b - a, 1, w, (a + b) / 2, y + 0.5, cz, fm));
    floors.add(box(X0 - t - CX, 1, 2 * inner, (X0 - t + CX) / 2, y + 0.5, 0, fm));
  }

  // The entrance on the south side and the winding stair up to the middle and third storeys (6:8).
  const sm = cedar(), stairZ = HALF + 6 + 2.5, stairs = building('stairs', box(3, 5, 0.3, stairX, 2.5, CZ + 5.15, sm));
  for (let i = 0; i < 24; i++) {
    const pivot = new THREE.Object3D(); pivot.position.set(stairX, 0.5 * i + 0.25, stairZ); pivot.rotation.y = (i * Math.PI) / 6;
    pivot.add(box(stairR - 0.3, 0.25, 0.8, (stairR - 0.3) / 2 + 0.3, 0, 0, sm)); stairs.add(pivot);
  }
  stairs.add(meshAt(cylGeo(0.3, 12, 12), sm, stairX, 6, stairZ));

  // A cedar roof of beams and planks (6:9) over the whole house.
  const rm = cedar();
  building('roof', box(EAST - (X0 - 6), 0.8, 2 * (HALF + 4), (EAST + X0 - 6) / 2, H + 0.4, 0, rm),
    instances(boxGeo(0.6, 0.6, 2 * HALF), rm, Array.from({ length: 20 }, (_, i): V3 => [X0 + 1.5 + 3 * i, H - 0.3, 0])));

  // Cedar panelling from floor to ceiling (6:15) on every inner face; a cypress floor, laid just
  // below y = 0 so the furniture stands on it.
  const panel = 0.15, inner = HALF - panel, lm = cedar();
  building('panelling', ...[-1, 1].map((sz) => box(X1 - X0, H, panel, (X0 + X1) / 2, H / 2, sz * (inner + panel / 2), lm)),
    box(panel, H, 2 * HALF, X0 + panel / 2, H / 2, 0, lm),
    ...[-1, 1].map((sz) => box(panel, H, HALF - door.w / 2, X1 - panel / 2, H / 2, sz * (HALF + door.w / 2) / 2, lm)),
    box(panel, H - door.h, door.w, X1 - panel / 2, (H + door.h) / 2, 0, lm));
  part('floor', box(X1 - X0, 0.2, 2 * HALF, (X0 + X1) / 2, -0.15, 0, cypress()));

  // The partition of cedar boards 20 cubits from the back (6:16), floor to ceiling, with a doorway
  // into the inner sanctuary; and the sanctuary's ceiling, 20 cubits up (6:20).
  const dw = 6, dh = 10, pt = 0.5, bm = cedar();
  building('partition', ...[-1, 1].map((sz) => box(pt, H, HALF - dw / 2, DEBIR, H / 2, sz * (HALF + dw / 2) / 2, bm)),
    box(pt, H - dh, dw, DEBIR, (H + dh) / 2, 0, bm), box(DEBIR - X0, 0.5, 2 * HALF, (X0 + DEBIR) / 2, 20.25, 0, bm));

  // Gold over every inner face: first the inner sanctuary (6:20), then the main hall (6:21-22).
  const skin = 0.05, sk = inner - skin / 2;
  const sg = gold();
  building('sanctuary-gold', ...[-1, 1].map((sz) => box(DEBIR - X0, 20, skin, (X0 + DEBIR) / 2, 10, sz * sk, sg)),
    box(skin, 20, 2 * inner, X0 + panel + skin / 2, 10, 0, sg),
    ...[-1, 1].map((sz) => box(skin, 20, inner - dw / 2, DEBIR - pt / 2 - skin / 2, 10, sz * (inner + dw / 2) / 2, sg)),
    box(skin, 20 - dh, dw, DEBIR - pt / 2 - skin / 2, (20 + dh) / 2, 0, sg), box(DEBIR - X0, skin, 2 * inner, (X0 + DEBIR) / 2, 20 - skin / 2, 0, sg));
  const hg = gold();
  building('hall-gold', ...[-1, 1].map((sz) => box(X1 - DEBIR, H, skin, (DEBIR + X1) / 2, H / 2, sz * sk, hg)),
    ...[-1, 1].map((sz) => box(skin, H, inner - dw / 2, DEBIR + pt / 2 + skin / 2, H / 2, sz * (inner + dw / 2) / 2, hg)),
    box(skin, H - dh, dw, DEBIR + pt / 2 + skin / 2, (H + dh) / 2, 0, hg),
    ...[-1, 1].map((sz) => box(skin, H, inner - door.w / 2, X1 - panel - skin / 2, H / 2, sz * (inner + door.w / 2) / 2, hg)),
    box(skin, H - door.h, door.w, X1 - panel - skin / 2, (H + door.h) / 2, 0, hg));
  // Gold chains across the front of the inner sanctuary (6:21): two swags of links above its door.
  const links: V3[] = [];
  for (const y of [12, 13.5]) for (let z = -inner; z <= inner; z += 0.25) links.push([DEBIR + 0.5, y - 0.6 * Math.sin((Math.PI * ((z + inner) % 5)) / 5), z]);
  building('chains', instances(new THREE.TorusGeometry(0.12, 0.03, 6, 12), gold(), links));

  // Two cherubim of olive wood, 10 high, each with two wings of 5, the outer wings touching the
  // walls and the inner ones meeting over the middle (6:23-27), facing the main room (2 Chr 3:13).
  // The text gives no form; these are schematic figures. The gold overlay (6:28) is a skin over both.
  const cherubX = (X0 + DEBIR) / 2, shoulder = 8;
  const figure = (mat: THREE.Material, grow: number) => [-1, 1].flatMap((sz) => {
    const z = sz * 5;
    return [
      ...[-0.7, 0.7].map((dz) => meshAt(cylGeo(0.5 + grow, 4.5, 16), mat, cherubX, 2.25, z + dz)),
      meshAt(cylGeo(0.9 + grow, 3.9, 24, 1.2 + grow), mat, cherubX, 6.45, z),
      meshAt(new THREE.SphereGeometry(0.8 + grow, 24, 16), mat, cherubX, 9.2 - grow, z),
    ];
  });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.9); wingShape.lineTo(0, 0.7); wingShape.quadraticCurveTo(2.2, 1.6, 5, 1.3);
  wingShape.lineTo(5, 0.8); wingShape.quadraticCurveTo(2.4, 0.3, 0, -0.9);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 12);
  const wings = (mat: THREE.Material, dx: number) => [-1, 1].flatMap((sz) => [-1, 1].map((dir) => {
    const w = new THREE.Mesh(wingGeo, mat); w.position.set(cherubX + dx, shoulder, sz * 5); w.rotation.y = -dir * Math.PI / 2; // along ±z
    return w;
  }));
  part('cherubim', ...figure(olive(), 0));
  part('cherubim-wings', ...wings(olive(), 0));
  const cg = gold(); cg.side = THREE.DoubleSide;
  part('cherubim-gold', ...figure(cg, 0.04), ...wings(cg, 0.03), ...wings(cg, -0.03));
  part('floor-gold', box(X1 - X0, 0.04, 2 * HALF, (X0 + X1) / 2, -0.02, 0, gold()));

  // Olive-wood doors into the inner sanctuary, carved and overlaid with gold (6:31-32), drawn
  // standing open into the main hall.
  const od = olive(), og = gold();
  building('inner-doors', ...[-1, 1].flatMap((sz) => [
    box(dw / 2, dh, 0.15, DEBIR + pt / 2 + dw / 4, dh / 2, sz * (dw / 2 + 0.1), od),
    box(dw / 2 - 0.5, dh - 1, 0.2, DEBIR + pt / 2 + dw / 4, dh / 2, sz * (dw / 2 + 0.1), og),
  ]));
  // The main doors: two of cypress, each of two folding leaves, overlaid with gold (6:33-35); closed.
  const dc = cypress(), dg = gold();
  part('doors', ...[-3.75, -1.25, 1.25, 3.75].flatMap((z) => [box(0.2, door.h, 2.45, 3, door.h / 2, z, dc), box(0.3, door.h - 1, 2, 3, door.h / 2, z, dg)]));
  // The veil of blue, purple and crimson (2 Chr 3:14), hung across the doorway inside the sanctuary.
  part('veil', sheet(dw + 0.4, dh + 0.2, DEBIR - pt / 2 - 0.3, (dh + 0.2) / 2, 0, 'x', cloth(0xffffff, weave(4))));

  // The inner court (6:36): three courses of dressed stone and one of cedar beams, round the house,
  // with a gateway to the east. Its size is not given.
  const KX0 = -86, KX1 = 70, KZ = 50, kt = 2, ks = ashlar(), kc = cedar();
  const courses = (len: number, x: number, z: number, alongX: boolean) => [0, 1, 2].map((i) => box(alongX ? len : kt, 0.97, alongX ? kt : len, x, i + 0.485, z, ks))
    .concat(box(alongX ? len : kt + 0.1, 0.5, alongX ? kt + 0.1 : len, x, 3.25, z, kc));
  part('court', ...[-1, 1].flatMap((sz) => courses(KX1 - KX0, (KX0 + KX1) / 2, sz * KZ, true)), ...courses(2 * KZ, KX0, 0, false),
    ...[-1, 1].flatMap((sz) => courses(KZ - 10, KX1, sz * (KZ + 10) / 2, false)));

  // Jachin (south) and Boaz (north), bronze, 18 high and 12 round (7:15), standing free before the porch.
  const pillarX = P1 + 4, pillarZ = 6, pr = 12 / (2 * Math.PI), top = 18;
  part('pillars', ...[-1, 1].map((sz) => meshAt(cylGeo(pr, top, 40), bronze(), pillarX, top / 2, sz * pillarZ)));
  // Capitals of 5 cubits (7:16): a rounded bowl (7:41) with a lily shape above it (7:19, 22).
  const bowl: [number, number][] = [[pr, 0], [2.3, 0.5], [2.5, 1.2], [2.3, 2], [1.9, 2.4]];
  const capGeo = lathe([[0, 0], ...bowl, [2.1, 3.4], [2.6, 4.4], [2.9, 5], [0, 5]]);
  part('capitals', ...[-1, 1].map((sz) => meshAt(capGeo, bronze(), pillarX, top, sz * pillarZ)));
  // A network of lattice over each bowl, with seven wreaths of chainwork (7:17).
  const netM = bronze(); netM.wireframe = true;
  const netGeo = lathe(bowl.map(([r, y]) => [r + 0.06, y]), 36);
  const wreathY = Array.from({ length: 7 }, (_, i) => 0.25 + i * 0.3);
  const wm = bronze();
  part('networks', ...[-1, 1].flatMap((sz) => [meshAt(netGeo, netM, pillarX, top, sz * pillarZ),
    ...wreathY.map((y) => { const w = meshAt(new THREE.TorusGeometry(radiusAt(bowl, y) + 0.08, 0.035, 6, 48), wm, pillarX, top + y, sz * pillarZ); w.rotation.x = Math.PI / 2; return w; })]));
  // Two rows of a hundred pomegranates round each capital (7:18, 20, 42).
  const pomAt: V3[] = [];
  for (const sz of [-1, 1]) for (const y of [0.25, 2.2]) for (let i = 0; i < 100; i++) {
    const a = (2 * Math.PI * i) / 100, r = radiusAt(bowl, y) + 0.2;
    pomAt.push([pillarX + r * Math.cos(a), top + y, sz * pillarZ + r * Math.sin(a)]);
  }
  part('pomegranates', instances(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x9b5a3c, metalness: 1, roughness: 0.4 }), pomAt));

  // The Sea (7:23-26): cast bronze, 10 across at the brim, 5 high, a handbreadth thick, its brim
  // flared like a lily. The line of 30 goes round just below the brim, where the radius is 30/2π.
  const seaX = 10, seaZ = 36, oxH = 2.4;
  const seaOuter: [number, number][] = [[0, 0], [2.8, 0.05], [3.85, 0.6], [4.5, 1.8], [4.74, 3.3], [4.78, 4.4], [4.86, 4.85], [5, 5]];
  const seaInner: [number, number][] = [[4.85, 5], [4.7, 4.9], [4.61, 4.4], [4.57, 3.3], [4.33, 1.85], [3.72, 0.75], [2.75, 0.22], [0, 0.17]];
  const seaM = bronze(); seaM.side = THREE.DoubleSide;
  part('sea', meshAt(lathe([...seaOuter, ...seaInner], 64), seaM, seaX, oxH, seaZ));
  // Two rows of gourds below the brim, ten to the cubit (7:24): 300 a row.
  const gourdAt: V3[] = [];
  for (const y of [4.05, 4.3]) for (let i = 0; i < 300; i++) {
    const a = (2 * Math.PI * i) / 300, r = radiusAt(seaOuter, y) + 0.04;
    gourdAt.push([seaX + r * Math.cos(a), oxH + y, seaZ + r * Math.sin(a)]);
  }
  part('sea-ornaments', instances(new THREE.SphereGeometry(0.06, 6, 4), bronze(), gourdAt));
  // Twelve oxen, three facing each way, hindquarters inward (7:25). Schematic figures.
  const oxM = bronze(), oxen = part('oxen');
  for (const [dx, dz] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) for (const k of [-1.3, 0, 1.3]) {
    const ox = new THREE.Group();
    ox.add(box(2.4, 1.2, 1.1, 0, oxH - 0.6, 0, oxM), box(0.8, 0.7, 0.6, 1.5, oxH - 0.4, 0, oxM),
      ...[-0.9, 0.9].flatMap((x) => [-0.35, 0.35].map((z) => box(0.3, oxH - 1.2, 0.3, x, (oxH - 1.2) / 2, z, oxM))));
    ox.position.set(seaX + 2.6 * dx - k * dz, 0, seaZ + 2.6 * dz + k * dx); ox.rotation.y = Math.atan2(-dz, dx);
    oxen.add(ox);
  }

  // Ten bronze stands, 4 × 4 × 3 (7:27), five north and five south of the house (7:39): panelled
  // bodies with corner uprights and a round band half a cubit high on top (7:35).
  const standAt: [number, number][] = [-48, -36, -24, -12, 0].flatMap((x) => [-1, 1].map((sz): [number, number] => [x, sz * 31]));
  const at = (y: number, dx = 0, dz = 0) => standAt.map(([x, z]): V3 => [x + dx, y, z + dz]);
  const stM = bronze();
  part('stands', instances(boxGeo(4, 1.6, 4), stM, at(1.7)),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => instances(boxGeo(0.3, 2.5, 0.3), stM, at(1.25, sx * 1.85, sz * 1.85)))),
    instances(cylGeo(0.85, 0.5, 24), stM, at(2.75)));
  // Four wheels a cubit and a half across, on axles, like chariot wheels (7:30-33).
  const wheelGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.15, 20).rotateX(Math.PI / 2), axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.4, 8).rotateX(Math.PI / 2);
  const whM = bronze();
  part('stand-wheels', ...[-1.4, 1.4].flatMap((dx) => [instances(axleGeo, whM, at(0.75, dx)), ...[-2.1, 2.1].map((dz) => instances(wheelGeo, whM, at(0.75, dx, dz)))]));
  // A basin on each, 4 cubits across and holding 40 baths (7:38): a shallow bowl 1.4 deep holds that.
  const bR = (4 + 1.4 ** 2) / 2.8, bA = Math.acos((bR - 1.4) / bR);
  const basinM = bronze(); basinM.side = THREE.DoubleSide;
  part('basins', instances(new THREE.SphereGeometry(bR, 32, 8, 0, 2 * Math.PI, Math.PI - bA, bA), basinM, at(3 + bR)));

  // The bronze altar, 20 × 20 × 10 (2 Chr 4:1), before the porch, with horns and a ramp on the south.
  const altarX = 40, ramp = new THREE.Shape();
  ramp.moveTo(0, 0); ramp.lineTo(32, 0); ramp.lineTo(0, 10); ramp.lineTo(0, 0);
  const rampGeo = new THREE.ExtrudeGeometry(ramp, { depth: 16, bevelEnabled: false }).rotateY(-Math.PI / 2);
  const am = bronze();
  part('bronze-altar', box(20, 10, 20, altarX, 5, 0, am),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => meshAt(new THREE.ConeGeometry(0.8, 1.5, 12), am, altarX + 9 * sx, 10.75, 9 * sz))),
    meshAt(rampGeo, ashlar(), altarX + 8, 0, 10));

  // Furniture. The incense altar before the sanctuary (6:20-22); ten lampstands, five on each side
  // (7:49); one table in Kings (7:48), ten in Chronicles (2 Chr 4:8), laid out between them; the
  // ark beneath the cherubim's wings (8:6).
  place(incenseAltar(), DEBIR + 3, 0);
  const lamps = part('lampstands');
  [-33, -27, -21, -15, -9].forEach((x, i) => [-1, 1].forEach((sz, j) => {
    const l = place(lampstand(`lampstand-${2 * i + j + 1}`), x, sz * 7.5, lamps);
    if (sz < 0) l.rotation.y = Math.PI; // the north row's lamps face the middle of the hall
  }));
  place(table(), -18, -4);
  const tables = part('more-tables'), bread = part('more-bread');
  let n = 2;
  for (const x of [-30, -24, -18, -12, -6]) for (const sz of [-1, 1]) {
    if (x === -18 && sz < 0) continue; // Kings' one table
    const p = `table-${n++}`, u = place(table(p), x, sz * 4, tables);
    const b = u.getObjectByName(`${p}-bread`)!;
    bread.add(b); b.position.copy(u.position);
  }
  place(ark(), cherubX, 0);

  // A focus unit is what the camera frames while a step builds any part inside it.
  for (const c of g.children) c.userData.focus = true;
  return g;
}
