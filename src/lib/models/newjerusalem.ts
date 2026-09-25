import * as THREE from 'three';
import { box, cylGeo, instances, meshAt, namedPart, type V3 } from './kit';
import { CUBIT_M } from './scale';

/** The stadion the BSB's note converts 12,000 stadia with (≈ 2,220 km); an Attic stadion of 600 feet. */
export const STADION_M = 185;

// The twelve foundations' stones in the order of Rev 21:19-20, each with the colour drawn. The ancient
// names do not always mean the modern stones; each colour follows what Pliny says of the stone by that
// name (Natural History 37), and the basis is in models.json.
export const FOUNDATION_STONES: [string, number][] = [
  ['jasper', 0x5f9e7a], ['sapphire', 0x2a3f9e], ['chalcedony', 0x8fa3a8], ['emerald', 0x2e9e5b],
  ['sardonyx', 0xc07a5e], ['carnelian', 0xa8322a], ['chrysolite', 0xd9b53a], ['beryl', 0x6fb7b0],
  ['topaz', 0xa8b83a], ['chrysoprase', 0x7fbf6a], ['jacinth', 0x3a5fbf], ['amethyst', 0x7a4a9e],
];

const glassGold = () => new THREE.MeshStandardMaterial({ color: 0xe8c45a, metalness: 0.6, roughness: 0.12, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const jasper = () => new THREE.MeshStandardMaterial({ color: 0x5e9479, roughness: 0.3, metalness: 0.05 });
const glassJasper = () => new THREE.MeshStandardMaterial({ color: 0x5e9479, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.72, depthWrite: false });
const plain = () => new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 });
const pearl = () => new THREE.MeshPhysicalMaterial({ color: 0xd4cec4, roughness: 0.35, iridescence: 1, iridescenceIOR: 1.3, sheen: 0.6, sheenColor: new THREE.Color(0xffe8f0) });
const water = () => new THREE.MeshStandardMaterial({ color: 0x2a78b8, metalness: 0, roughness: 0.45 });
const leaf = () => new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.85 });
const bark = () => new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });

/** A seeded random number generator, so the tree's roots fall the same way on every load. */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** A cylinder of radius r from a to b (rTop at b), for the tree's leaning trunks and hanging roots. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, rTop: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, a.distanceTo(b), 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * The one tree of life of the `face` reading, at the city's centre and standing astride the river
 * (22:2, 'on either side of the river'): two trunks rooted on the banks meet over the water and rise as
 * one, under a broad crown whose roots hang down to both banks, as a banyan's do. Its size is not given;
 * it is drawn ≈ 100 m high and ≈ 180 m across.
 */
function treeOfLife(F: number): THREE.Group {
  const g = new THREE.Group(), wood = bark(), crown = leaf(), rnd = seeded(12), v = (x: number, y: number, z: number) => new THREE.Vector3(x, F + y, z);
  for (const s of [-1, 1]) g.add(limb(v(0, 0, s * 12), v(0, 30, 0), 4, 3, wood));
  g.add(limb(v(0, 30, 0), v(0, 62, 0), 4.5, 3.5, wood));
  const lobes: [number, number, number, number][] = [[0, 78, 0, 55], [45, 70, 25, 38], [-45, 70, -25, 38], [35, 68, -40, 34], [-35, 68, 40, 34]];
  for (const [x, y, z, r] of lobes) { const m = meshAt(new THREE.SphereGeometry(r, 20, 12).scale(1, 0.55, 1), crown, x, F + y, z); g.add(m); }
  // Roots let down from the branches to the ground on both banks, clear of the river.
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = 20 + rnd() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(z) < 8) continue;
    g.add(limb(v(x, 0, z), v(x * 0.9, 52 + rnd() * 10, z * 0.9), 0.9, 0.6, wood));
  }
  return g;
}

/**
 * The New Jerusalem (Rev 21:10-22:2), in metres and to true scale, east towards +x and north towards
 * −z: the city 12,000 stadia (≈ 2,220 km) each way (21:16), a wall measured at 144 cubits (21:17), and
 * three gates on each side (21:13). Two readings, drawn under the same part names so one build serves
 * both (models.json has the case for each):
 *  - `face` (the default): the wall is the city's own face, jasper 144 cubits thick rising the full
 *    height round the gold city, and the twelve foundations are courses under the whole of it, wall and
 *    city alike, so they come with the city.
 *  - `foot`: a wall 144 cubits high at the foot of the gold cube, on foundations of its own.
 * The gates' size and places, the foundations' form, the street, river and trees are estimated; each
 * basis is in models.json. The build frames the middle gate on the east through three views (see `view`).
 */
export function newJerusalem(reading = 'face'): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const face = reading === 'face';
  const S = 12000 * STADION_M, c = CUBIT_M, gatesAt = [-S / 4, 0, S / 4], gateW = 30 * c;
  const course = 2 * c, F = face ? 12 * course : 0; // the foundations' top, where the city stands in `face`
  // The wall: in `face` 144 cubits thick, its outer face the city's edge; in `foot` 144 cubits high and
  // 16 thick, against the city's foot. D is the middle of its thickness.
  const T = face ? 144 * c : 16 * c, H = face ? S : 144 * c, D = face ? S / 2 - T / 2 : S / 2 + T / 2;
  const inner = face ? S / 2 - T - 2 : S / 2; // the edge of the gold, just inside the wall in `face`
  const outer = face ? S / 2 + c : S / 2 + T; // the outermost thing on the ground: the foundations or the wall

  /**
   * Boxes for a band round the city `t` thick and centred `d` from the middle, from y0 to y0 + h, of
   * one material; broken for a gap `gap` wide at each gate, or whole when `gap` is 0.
   */
  const band = (d: number, y0: number, h: number, t: number, gap: number, m: THREE.Material) => {
    const runs = (from: number, to: number) => {
      if (!gap) return [[from, to]];
      const edges = [from, ...gatesAt.flatMap((x) => [x - gap / 2, x + gap / 2]), to], out: [number, number][] = [];
      for (let i = 0; i < edges.length; i += 2) out.push([edges[i], edges[i + 1]]);
      return out;
    };
    const e = d + t / 2, y = y0 + h / 2;
    return [-1, 1].flatMap((s) => [
      ...runs(-e, e).map(([a, b]) => box(b - a, h, t, (a + b) / 2, y, s * d, m)), // north and south
      ...runs(-(d - t / 2), d - t / 2).map(([a, b]) => box(t, h, b - a, s * d, y, (a + b) / 2, m)), // west and east
    ]);
  };

  // The city (21:10-11, 16, 18): pure gold, clear as glass. In `face` it stands on the foundations,
  // which are its own as much as the wall's (Heb 11:10), so they come with it. The gold alone is cut
  // open while the build looks inside.
  const city = part('city');
  const gold = new THREE.Group(); gold.userData.cutaway = 'step'; city.add(gold);
  // In `face` the gold has no floor of its own, which would flicker against the foundations' top.
  const goldGeo = new THREE.BoxGeometry(2 * inner, S, 2 * inner);
  if (face) { const idx = [...goldGeo.index!.array]; goldGeo.setIndex([...idx.slice(0, 18), ...idx.slice(24)]); } // faces: +x −x +y −y +z −z
  gold.add(meshAt(goldGeo, glassGold(), 0, F + S / 2, 0)); // as high as it is wide in both readings (21:16)

  // Boxes a step's `frame` names, never drawn: the east gate whole, with the rod before it; the foot of
  // the wall there, for the foundations; and the street just inside it. The city holds them, so they
  // are in the model from the first step.
  const view = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    const v = box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, new THREE.MeshBasicMaterial());
    v.visible = false;
    const n = new THREE.Group(); n.name = name; n.add(v); city.add(n);
  };
  const gateTop = face ? F + 40 * c : H;
  view('view-east-gate', S / 2 - 5, outer + 12, 0, gateTop, -25, 25);
  view('view-wall-foot', S / 2 - 2, outer + 10, 0, face ? F + 3 : 12, -24, 8);
  view('view-street', inner - 45, inner + 5, F, F + 14, -15, 15);
  // Where 22:2 looks: in `face`, the tree of life at the city's centre; in `foot`, the trees by the gate.
  if (face) view('view-tree', -90, 90, F, F + 110, -90, 90);
  else view('view-tree', inner - 45, inner + 5, F, F + 14, -15, 15);

  // The twelve foundations (21:14), courses 2 cubits high, each to be adorned with its stone (21:19-20).
  // In `face` they run under the whole city and a cubit beyond the wall, and the figure stands on them
  // inside; in `foot` they run under the wall alone, a cubit proud of each face, broken at the gates.
  const P = S / 2 + c;
  // In `face` the courses stop half a metre inside their facing: over 2,220 km the depth buffer cannot
  // tell apart two faces a few centimetres apart, and they would flicker.
  // The top course is cut away under the street (half-width W), which is laid into the gap: the street's
  // floor would otherwise lie a few centimetres under it across 2,220 km, and at the gate, 1,110 km from
  // the model's middle, the GPU's rounding is tens of centimetres, so the floor showed through the street.
  const W = 50 * c, top = FOUNDATION_STONES.length - 1;
  const course12 = () => {
    const m = plain(), y = top * course + course / 2, e = P - 0.5, side = (e - W) / 2 + W;
    return [...[-1, 1].map((s) => box(2 * e, course, e - W, 0, y, s * side, m)), ...[-1, 1].map((s) => box(e - inner, course, 2 * W, s * (inner + e) / 2, y, 0, m))];
  };
  const foundations = face
    ? new THREE.Group().add(...FOUNDATION_STONES.slice(0, top).map((_, i) => box(2 * P - 1, course, 2 * P - 1, 0, i * course + course / 2, 0, plain())), ...course12())
    : null;
  if (foundations) { foundations.name = 'foundations'; foundations.userData.ground = true; city.add(foundations); }
  else part('foundations', ...FOUNDATION_STONES.flatMap((_, i) => band(D, i * course, course, T + 2 * c, gateW, plain())));
  FOUNDATION_STONES.forEach(([name, color], i) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 });
    // In `face`, a facing 60 cm thick round the courses' edges; in `foot`, a casing round each course.
    part(name, ...(face ? band(P, i * course, course, 0.6, 0, m) : band(D, i * course, course, T + 2 * c + 0.1, gateW, m)));
  });

  // The wall of jasper (21:12, 18). In `face`, clear jasper on the foundations as high as the city,
  // solid but for the gates at its foot; in `foot`, a wall 144 cubits high broken by the gates.
  const gateH = face ? 30 * c : H;
  part('wall', ...(face
    ? (() => { const m = glassJasper(); return [...band(D, F, gateH, T, gateW, m), ...band(D, F + gateH, H - gateH, T, 0, m)]; })()
    : band(D, 0, H, T, gateW, jasper())));

  // The golden measuring rod (21:15), drawn at Ezekiel's six long cubits, standing outside the east gate.
  const rod = part('rod', meshAt(cylGeo(0.03, 6 * 0.519, 12), new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.28 }), outer + 8, 3 * 0.519, 4));
  rod.userData.focus = true;

  // Each gate a single pearl (21:21), filling its gap in the wall with a passage 10 cubits wide and 20
  // high through it, as the pearls of b. Baba Batra 75a are 30 cubits across with an opening 10 by 20.
  // In `face` each is 30 cubits high and runs through the wall's whole thickness; in `foot` it fills
  // its gap to the top of the wall. Always open (21:25).
  const pw = 10 * c, ph = 20 * c, pier = (gateW - pw) / 2;
  const gates = part('gates');
  const sides: [string, number, number][] = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]];
  for (const [side, sx, sz] of sides) gatesAt.forEach((along, i) => {
    const gate = new THREE.Group(); gate.name = `gate-${side}-${i + 1}`; gates.add(gate);
    const m = pearl(), across = sx !== 0; // on the east and west, the gate runs along z
    const at = (u: number, y: number, w: number, h: number) => across
      ? box(T + 2, h, w, sx * D, F + y, along + u, m)
      : box(w, h, T + 2, along + u, F + y, sz * D, m);
    gate.add(at(-(pw + pier) / 2, gateH / 2, pier, gateH), at((pw + pier) / 2, gateH / 2, pier, gateH), at(0, (gateH + ph) / 2, pw, gateH - ph));
  });

  // The main street of gold (21:21), from the east gate to the west through the middle of the city,
  // 100 cubits wide; the river of the water of life down the middle of it (22:1), 20 cubits wide. The
  // river runs in a channel between two strips of street rather than on top of it: over 2,220 km the
  // depth buffer cannot keep water a few centimetres above gold, and the street would hide it.
  const sm = new THREE.MeshStandardMaterial({ color: 0xb88a2e, metalness: 0.7, roughness: 0.5 });
  // In `face` both fill the gap in the foundations' top course down to the course below.
  const base = face ? F - course : F;
  part('street', ...[-1, 1].map((s) => box(2 * inner, F + 0.3 - base, 40 * c, 0, (F + 0.3 + base) / 2, s * 30 * c, sm)));
  part('river', box(2 * inner, F + 0.25 - base, 20 * c, 0, (F + 0.25 + base) / 2, 0, water()));

  // Trees in rows on both banks, every 20 m for the first kilometre inside the east gate. In `foot` they are
  // the trees of life of 22:2, read as many; in `face` they are the garden's other trees, 'every tree
  // … good for food' (Gen 2:9), 'fruit trees of all kinds' (Ezek 47:12), and stand at the centre too,
  // either side of the one tree of life.
  const banks = [-1, 1].map((s) => s * 16 * c), at: [number, number][] = [];
  const row = (from: number, to: number) => { for (let x = from; x > to; x -= 20) for (const z of banks) at.push([x, z]); };
  row(inner - 20, inner - 1000);
  if (face) { row(-90, -700); row(700, 90); }
  const trees = part('trees', instances(cylGeo(0.35, 6, 8), bark(), at.map(([x, z]): V3 => [x, F + 3, z])), instances(new THREE.SphereGeometry(4, 12, 8), leaf(), at.map(([x, z]): V3 => [x, F + 8, z])));
  if (face) trees.add(treeOfLife(F));

  return g;
}
