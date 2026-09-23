import * as THREE from 'three';

/** Alabastron: the long-necked, round-bottomed perfume flask. Profile is a lathe. */
export function alabastron(heightCm: number): THREE.Group {
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
