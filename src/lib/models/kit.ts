// Building blocks for the procedural models. Two rules keep build steps working:
//  - Materials are made per part (call `gold()` etc. inside each part), so a part can fade in
//    without fading its neighbours. The content tests fail if a material spans two parts.
//  - Geometries carry no per-part state, so the sized helpers share one per size.
import * as THREE from 'three';

export const wood = () => new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
export const gold = () => new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.28 });
export const bronze = () => new THREE.MeshStandardMaterial({ color: 0xa8703a, metalness: 1, roughness: 0.4 });
export const silver = () => new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 1, roughness: 0.3 });
export const stone = () => new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 });
export const cloth = (color: number, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, ...(map && { map }), roughness: 0.95, side: THREE.DoubleSide });

/**
 * White linen with bands of blue, purple and scarlet (Exod 26:1, 26:31, 26:36, 27:16). The text
 * names the colours but not the pattern, and the woven cherubim are not drawn. A DataTexture
 * needs no canvas, so the model also builds under test.
 */
export function weave(repeatY: number): THREE.DataTexture {
  const bands = [[0xf2, 0xec, 0xdc], [0x2b, 0x4c, 0x9b], [0xf2, 0xec, 0xdc], [0x6b, 0x2d, 0x7a], [0xf2, 0xec, 0xdc], [0xb3, 0x22, 0x2a]];
  const data = new Uint8Array(bands.length * 4);
  bands.forEach((c, i) => data.set([...c, 255], i * 4));
  const t = new THREE.DataTexture(data, 1, bands.length);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  t.repeat.set(1, repeatY); t.needsUpdate = true;
  return t;
}

const geometries = new Map<string, THREE.BufferGeometry>();
const shared = <G extends THREE.BufferGeometry>(key: string, make: () => G): G => {
  let g = geometries.get(key) as G | undefined;
  if (!g) geometries.set(key, g = make());
  return g;
};
export const boxGeo = (w: number, h: number, d: number) => shared(`box ${w} ${h} ${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylGeo = (r: number, h: number, seg: number, rBottom = r) => shared(`cyl ${r} ${rBottom} ${h} ${seg}`, () => new THREE.CylinderGeometry(r, rBottom, h, seg));
export const torusGeo = (r: number, tube: number, radial: number, tubular: number) => shared(`torus ${r} ${tube} ${radial} ${tubular}`, () => new THREE.TorusGeometry(r, tube, radial, tubular));

export const meshAt = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
};
export const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => meshAt(boxGeo(w, h, d), mat, x, y, z);
/** An upright cylinder of height `h` standing on the ground at (x, z). */
export const post = (x: number, z: number, h: number, r: number, mat: THREE.Material) => meshAt(cylGeo(r, h, 16), mat, x, h / 2, z);
/** A ring standing upright, turned so a pole along x passes through it. */
export const ring = (r: number, tube: number, x: number, y: number, z: number, mat: THREE.Material) => {
  const m = meshAt(torusGeo(r, tube, 10, 24), mat, x, y, z); m.rotation.y = Math.PI / 2; return m;
};
/** A carrying pole along x. */
export const pole = (r: number, len: number, x: number, y: number, z: number, mat: THREE.Material) => {
  const m = meshAt(cylGeo(r, len, 12), mat, x, y, z); m.rotation.z = Math.PI / 2; return m;
};
/** A w × h sheet centred on (x, y, z); `face` turns it to hang facing x or z, or to lie flat as a roof. */
export const sheet = (w: number, h: number, x: number, y: number, z: number, face: 'x' | 'z' | 'roof', mat: THREE.Material) => {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  s.position.set(x, y, z);
  if (face === 'x') s.rotation.y = Math.PI / 2;
  if (face === 'roof') s.rotation.x = -Math.PI / 2;
  return s;
};
export type V3 = [number, number, number];
/** One draw call for many copies of a piece — the court's posts, the frames and their bases. */
export function instances(geo: THREE.BufferGeometry, mat: THREE.Material, at: V3[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, at.length), o = new THREE.Object3D();
  at.forEach(([x, y, z], i) => { o.position.set(x, y, z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  return m;
}

/** Adds a named group to `g` — the unit a build step reveals. */
export const namedPart = (g: THREE.Object3D) => (name: string, ...children: THREE.Object3D[]) => {
  const p = new THREE.Group(); p.name = name; if (children.length) p.add(...children); g.add(p); return p;
};
/**
 * A piece of furniture: an unnamed group holding the piece, named `p`, whose parts are named
 * `p-…`, plus any loose parts (`p-bread`, `p-lamps`) that the text sets out separately. The
 * prefix lets a model hold several of one kind (Solomon's ten lampstands), and a model places
 * the group; builders draw at the origin. Returns the group and adders for the piece and for
 * loose parts.
 */
export function furniture(p: string) {
  const unit = new THREE.Group(), loose = namedPart(unit), piece = namedPart(loose(p));
  return { unit, piece: (name: string, ...c: THREE.Object3D[]) => piece(`${p}-${name}`, ...c), loose: (name: string, ...c: THREE.Object3D[]) => loose(`${p}-${name}`, ...c) };
}
