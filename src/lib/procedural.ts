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

export function buildProcedural(kind: NonNullable<import('./types').Model3D['procedural']>): THREE.Object3D {
  switch (kind) {
    case 'denarius': return coin(19, 1.5, 0xd6d3c9, 'TI CAESAR DIVI AVG F AVGVSTVS', 'PONTIF MAXIM');
    case 'tetradrachm': return coin(26, 3, 0xd6d3c9, 'TYPOY IEPAΣ', 'KAI AΣYΛOY');
    case 'alabastron': return alabastron(18);
    case 'ark': return ark();
  }
}
