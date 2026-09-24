import * as THREE from 'three';
import { box, namedPart, wood } from './kit';

/**
 * A first-century fishing boat of the Sea of Galilee, after the hull found at Ginosar in 1986, in
 * metres, bow towards +x. The surviving hull gives the length, beam, depth and shape: a rounded
 * stern, a fine bow, cedar planks edge-joined on a keel, oak frames. Everything above it (decks,
 * benches, mast, sail, oars, the cushion) is reconstructed; see content/models.json for what each
 * rests on. The hull is one open shell, so the camera sees into it from above without a cutaway.
 */
export function galileeBoat(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const L = 8.2, B = 2.3, D = 1.25, N = 48, M = 24;

  // Half-breadth along the hull, u = 0 at the stern to 1 at the bow: fullest a little aft of
  // amidships, closing bluntly at the stern and to a fine point at the bow.
  const widest = 0.45;
  const half = (u: number) => {
    const t = u < widest ? (widest - u) / widest : (u - widest) / (1 - widest);
    return (B / 2) * (u < widest ? Math.sqrt(Math.max(0, 1 - t ** 2.4)) : Math.max(0, 1 - t ** 1.7) ** 0.85);
  };
  // The keel rises a little towards both ends; the sheer (top of the side) rises more at the bow.
  const keelY = (u: number) => 0.18 * (2 * u - 1) ** 4 + (u > 0.9 ? 0.6 * ((u - 0.9) / 0.1) ** 2 : 0);
  const sheerY = (u: number) => D + 0.12 * (1 - 2 * u) ** 2 + 0.2 * Math.max(0, u - 0.6) ** 2 / 0.16;
  const x = (u: number) => -L / 2 + L * u;
  // A point on the hull: θ runs round the section from −π/2 (port sheer) through 0 (keel) to π/2.
  const at = (u: number, th: number, inset = 0) => {
    const b = Math.max(0, half(u) - inset), y0 = keelY(u) + inset, y1 = sheerY(u);
    return new THREE.Vector3(x(u), y0 + (y1 - y0) * (1 - Math.cos(th)), b * Math.sin(th));
  };

  // Planks: the shell, its strakes drawn as bands of lighter and darker cedar running fore and aft.
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
    const u = i / N, p = at(u, -Math.PI / 2 + (Math.PI * j) / M);
    pos.push(p.x, p.y, p.z); uv.push(u, j / M);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  shell.setIndex(idx); shell.computeVertexNormals();
  const strakes = new Uint8Array([0xa0, 0x6a, 0x3c, 255, 0x8a, 0x58, 0x30, 255]);
  const tex = new THREE.DataTexture(strakes, 1, 2);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter;
  tex.repeat.set(1, 24); tex.needsUpdate = true;
  part('planks', new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })));

  // A curve along the hull or round a section, drawn as a round timber.
  const timber = (pts: THREE.Vector3[], r: number, mat: THREE.Material) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8), mat);
  const along = (f: (u: number) => THREE.Vector3, from = 0, to = 1) => Array.from({ length: 33 }, (_, i) => f(from + ((to - from) * i) / 32));

  // Keel and stem: the backbone the planks were fastened to, rising at the bow into the stem.
  const keel = wood();
  part('keel', timber(along((u) => at(u, 0).setY(keelY(u) - 0.05)), 0.07, keel),
    timber([at(0.97, 0), at(1, 0).setY(sheerY(1) * 0.7), at(1, 0).setY(sheerY(1) + 0.1)].map((p) => p.setX(Math.min(p.x, L / 2 + 0.05))), 0.07, keel));

  // Frames: oak ribs across the inside of the planking.
  const oak = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const frames: THREE.Object3D[] = [];
  for (let u = 0.06; u < 0.95; u += 0.3 / L) {
    const w = half(u) / (B / 2), reach = Math.PI / 2 * (w > 0.25 ? 0.98 : 0.9);
    frames.push(timber(Array.from({ length: 13 }, (_, j) => at(u, -reach + (2 * reach * j) / 12, 0.04)), 0.03, oak));
  }
  part('frames', ...frames);

  // Wales: a heavier timber along the top of each side, where the oars bear.
  const wale = wood();
  part('wales', ...[-1, 1].map((s) => timber(along((u) => at(u, (s * Math.PI) / 2)).map((p) => p.setY(p.y - 0.03)), 0.045, wale)));

  // A flat deck laid across the hull between u0 and u1, a little below the sheer.
  const deck = (u0: number, u1: number, drop: number) => {
    const us = Array.from({ length: 17 }, (_, i) => u0 + ((u1 - u0) * i) / 16);
    const shape = new THREE.Shape(us.map((u) => new THREE.Vector2(x(u), half(u) - 0.04)));
    for (const u of [...us].reverse()) shape.lineTo(x(u), -(half(u) - 0.04));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a6a40, roughness: 0.8 }));
    m.rotation.x = Math.PI / 2; m.position.y = Math.min(sheerY(u0), sheerY(u1)) - drop;
    return m;
  };
  part('stern-deck', deck(0.015, 0.16, 0.12));
  part('bow-deck', deck(0.86, 0.985, 0.12));

  // Benches for the rowers, two across the waist.
  const bench = wood();
  part('benches', ...[0.33, 0.62].map((u) => box(0.25, 0.05, 2 * half(u) - 0.1, x(u), sheerY(u) - 0.35, 0, bench)));

  // Mast, stepped on the keel a little forward of amidships, with its yard and the sail brailed up to it.
  const mastU = 0.56, mastX = x(mastU), mastH = 6, yardY = mastH - 0.3;
  const mast = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
  const spar = (len: number, r: number, px: number, py: number, pz: number, rx: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mast); m.position.set(px, py, pz); m.rotation.x = rx; return m;
  };
  part('mast', spar(mastH, 0.07, mastX, keelY(mastU) + mastH / 2, 0, 0), spar(3.4, 0.045, mastX + 0.08, yardY, 0, Math.PI / 2));
  const sailcloth = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.95 });
  const furled = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 2.9, 4, 12), sailcloth);
  furled.rotation.x = Math.PI / 2; furled.position.set(mastX + 0.18, yardY - 0.12, 0);
  part('sail', furled);

  // Oars, two a side, resting on the wales and trailing aft; and two steering oars at the stern quarters.
  const oarWood = new THREE.MeshStandardMaterial({ color: 0xa9804f, roughness: 0.8 });
  const oar = (len: number, blade: number, from: THREE.Vector3, dir: THREE.Vector3) => {
    const o = new THREE.Group(), d = dir.clone().normalize();
    const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), oarWood); loom.position.y = len / 2;
    const bl = new THREE.Mesh(new THREE.BoxGeometry(blade, 0.9, 0.02), oarWood); bl.position.y = len - 0.45;
    o.add(loom, bl); o.position.copy(from); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    return o;
  };
  const oars: THREE.Object3D[] = [];
  for (const u of [0.33, 0.62]) for (const s of [-1, 1]) {
    const p = at(u, (s * Math.PI) / 2), inboard = p.clone().add(new THREE.Vector3(0.2, 0.25, -s * 0.8));
    oars.push(oar(4, 0.14, inboard, p.clone().sub(inboard).normalize().add(new THREE.Vector3(-0.3, 0, 0))));
  }
  part('oars', ...oars);
  const helm = new THREE.MeshStandardMaterial({ color: 0x96703f, roughness: 0.8 });
  part('steering-oars', ...[-1, 1].map((s) => {
    const o = oar(2.6, 0.3, at(0.07, (s * Math.PI) / 2).add(new THREE.Vector3(0.3, 0.45, 0)), new THREE.Vector3(-1, -0.8, s * 0.3));
    o.traverse((c) => { if (c instanceof THREE.Mesh) c.material = helm; });
    return o;
  }));

  // The cushion (Mark 4:38), under the stern deck on the floor of the hull.
  const cushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8c7a5c, roughness: 1 }));
  cushion.rotation.x = Math.PI / 2; cushion.scale.set(1.3, 1, 0.55); cushion.position.set(x(0.13), keelY(0.13) + 0.22, 0);
  part('cushion', cushion);
  return g;
}
