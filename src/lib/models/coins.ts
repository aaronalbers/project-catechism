// Struck coins, to real-world size (1 unit = 2 cm, keeps camera maths simple). The relief is
// schematic; see content/models.json for the measurements and their sources.
import * as THREE from 'three';

/** A coin's device, drawn white on black into a 512px bump map. */
type Device = (ctx: CanvasRenderingContext2D) => void;
const bust: Device = (ctx) => { ctx.beginPath(); ctx.ellipse(256, 270, 90, 120, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(256, 420, 150, 70, 0, 0, Math.PI * 2); ctx.fill(); };
const figure: Device = (ctx) => { ctx.beginPath(); ctx.moveTo(256, 130); ctx.lineTo(300, 400); ctx.lineTo(212, 400); ctx.closePath(); ctx.fill(); };
/** Jannaeus's anchor, upside down (flukes at the top, as if hung on a ship's side), within a circle. */
const anchor: Device = (ctx) => {
  ctx.lineWidth = 26; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(256, 256, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(256, 150); ctx.lineTo(256, 350); ctx.stroke(); // shank
  ctx.beginPath(); ctx.moveTo(206, 330); ctx.lineTo(306, 330); ctx.stroke(); // stock
  ctx.beginPath(); ctx.arc(256, 150, 70, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); // arms
  ctx.beginPath(); ctx.arc(256, 372, 22, 0, Math.PI * 2); ctx.stroke(); // ring
};
/** An eight-rayed star with a pellet at its centre, within a border of dots. */
const star: Device = (ctx) => {
  ctx.lineWidth = 28; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(256 + 40 * Math.cos(a), 256 + 40 * Math.sin(a)); ctx.lineTo(256 + 175 * Math.cos(a), 256 + 175 * Math.sin(a)); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(256, 256, 30, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 40; i++) { const a = (i * Math.PI) / 20; ctx.beginPath(); ctx.arc(256 + 225 * Math.cos(a), 256 + 225 * Math.sin(a), 9, 0, Math.PI * 2); ctx.fill(); }
};

/** The bump map for one face; none where there is no DOM to draw it (the tests build models in Node). */
function relief(legend: string, device: Device): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  device(ctx);
  ctx.font = 'bold 44px serif'; ctx.textAlign = 'center';
  const chars = legend.split(''); const start = -Math.PI / 2 - (chars.length * 0.12) / 2;
  chars.forEach((ch, i) => { ctx.save(); ctx.translate(256, 256); ctx.rotate(start + i * 0.12); ctx.translate(0, -215); ctx.fillText(ch, 0, 0); ctx.restore(); });
  return new THREE.CanvasTexture(c);
}

export function coin(diameterMm: number, thicknessMm: number, color: number, legend: string, reverseLegend: string): THREE.Group {
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
  const face = (z: number, text: string, device: Device) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 96), new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.4, bumpMap: relief(text, device), bumpScale: 0.02 }));
    m.position.z = z; if (z < 0) m.rotation.y = Math.PI;
    g.add(m);
  };
  face(t / 2 + 0.0005, legend, bust);
  face(-t / 2 - 0.0005, reverseLegend, figure);
  g.rotation.x = -0.3;
  return g;
}

/**
 * A lepton: a small bronze struck on a ragged, uneven flan, its design often off-centre. The outline
 * wanders by a few per cent of the radius, seeded so the coin looks the same on every load.
 */
function lepton(name: string, diameterMm: number, thicknessMm: number, seed: number): THREE.Group {
  const r = diameterMm / 40, t = thicknessMm / 20; // 1 unit = 2 cm
  const wobble = (a: number) => 1 + 0.05 * Math.sin(2 * a + seed) + 0.03 * Math.sin(3 * a + 2 * seed) + 0.02 * Math.sin(5 * a + 3 * seed);
  const outline = new THREE.Shape();
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, k = r * wobble(a); outline[i ? 'lineTo' : 'moveTo'](k * Math.cos(a), k * Math.sin(a)); }
  // Weathered bronze, like the excavated coins, rather than bright new metal.
  const color = 0x6e4028, mat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: t, bevelEnabled: true, bevelThickness: t * 0.25, bevelSize: r * 0.04, bevelSegments: 3 }), mat);
  body.position.z = -t / 2;
  const g = new THREE.Group(); g.name = name; g.add(body);
  // The faces: the flan's outline, mapped so the design sits a little off-centre, as on most specimens.
  const faceGeo = new THREE.ShapeGeometry(outline, 96), uv = faceGeo.attributes.uv, pos = faceGeo.attributes.position;
  const span = r * 2.3, off = [0.03 * Math.cos(seed), 0.03 * Math.sin(seed)];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / span + 0.5 + off[0], pos.getY(i) / span + 0.5 + off[1]);
  // The back face shows the same geometry's back side, so its outline matches the flan's; its design
  // reads mirrored, which the star (symmetric, and drawn without its legend) does not show.
  const face = (z: number, text: string, device: Device) => {
    const m = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.75, bumpMap: relief(text, device), bumpScale: 0.08, side: z < 0 ? THREE.BackSide : THREE.FrontSide }));
    m.position.z = z;
    g.add(m);
  };
  face(t / 2 + t * 0.25 + 0.0005, 'ΒΑΣΙΛΕΩΣ ΑΛΕΞΑΝΔΡΟΥ', anchor);
  face(-t / 2 - t * 0.25 - 0.0005, '', star);
  return g;
}

/**
 * The widow's two lepta (Mark 12:42), standing side by side in the palm: one the size of Yale's
 * specimen, the other a smaller one of the kind, turned to show its star. The origin is between
 * their lower edges, where the hand's palm goes.
 */
export function lepta(): THREE.Group {
  const g = new THREE.Group();
  const place = (c: THREE.Group, x: number, turn: number) => {
    const r = new THREE.Box3().setFromObject(c).getSize(new THREE.Vector3()).y / 2;
    c.rotation.set(-0.3, turn, 0.2 * (x > 0 ? 1 : -1)); c.position.set(x, r * Math.cos(0.3), 0);
    g.add(c);
  };
  place(lepton('lepton-yale', 15.9, 1.1, 1.3), -0.45, 0);
  place(lepton('lepton-small', 13, 1, 4.1), 0.42, Math.PI);
  return g;
}
