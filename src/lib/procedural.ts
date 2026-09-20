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

export function buildProcedural(kind: NonNullable<import('./types').Model3D['procedural']>): THREE.Object3D {
  switch (kind) {
    case 'denarius': return coin(19, 1.5, 0xd6d3c9, 'TI CAESAR DIVI AVG F AVGVSTVS', 'PONTIF MAXIM');
    case 'tetradrachm': return coin(26, 3, 0xd6d3c9, 'TYPOY IEPAΣ', 'KAI AΣYΛOY');
    case 'alabastron': return alabastron(18);
  }
}
