// Struck coins, to real-world size (1 unit = 2 cm, keeps camera maths simple). The relief is
// schematic; see content/models.json for the measurements and their sources.
import * as THREE from 'three';

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
