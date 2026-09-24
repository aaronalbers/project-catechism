// What the Models tab shows of a model at a verse, and from where: which parts are drawn, which the
// text is working on, where the camera stands and what the cutaway clips. Kept free of the DOM so the
// viewer (ModelsPanel) and the tests share one account of it; the visibility tests cast rays from
// exactly the camera the reader would see.
import * as THREE from 'three';
import { modelBuildAt, modelHiddenIn, modelStateAt, modelViewAt } from '@/lib/content';
import type { Model3D, ModelAngle, ModelChange, ModelStep } from '@/lib/types';
import type { VerseLoc } from '@/lib/refs';
import type { ScaleReference } from './scale';

export const materialsOf = (o: THREE.Object3D) => {
  const out: THREE.Material[] = [];
  o.traverse((x) => { const mt = (x as THREE.Mesh).material; if (mt) out.push(...(Array.isArray(mt) ? mt : [mt])); });
  return out;
};

/** Bounds of what is actually drawn — `Box3.setFromObject` counts hidden meshes too. */
export function visibleBox(root: THREE.Object3D) {
  const b = new THREE.Box3();
  root.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) b.expandByObject(o); });
  return b;
}

/**
 * Which named parts of `object` are drawn at `loc`: inside a build, the parts the text has described
 * so far; outside one, every part the state `stateId` (null: as built) has not hidden, as far as the
 * reading has got through it. Parts nest: naming a part shows everything inside it, hiding one hides
 * everything inside it, and during a build a part stays drawn while anything inside it is shown.
 */
export function partsShown(m: Model3D, object: THREE.Object3D, loc: VerseLoc, stateId: string | null): Map<THREE.Object3D, boolean> {
  const at = modelBuildAt(m, loc);
  const hidden = at ? null : modelHiddenIn(m, stateId, loc);
  const want = new Map<THREE.Object3D, boolean>();
  const decide = (node: THREE.Object3D, inherited: boolean): boolean => {
    const named = !!node.name;
    const self = at ? inherited || (named && at.parts.has(node.name)) : inherited && !(named && hidden!.has(node.name));
    let any = self;
    for (const c of node.children) if (decide(c, self)) any = true;
    if (node.name) want.set(node, any);
    return any;
  };
  for (const c of object.children) decide(c, !at);
  return want;
}

/**
 * The parts the text is working on at `loc`: during a build, those the latest step adds; while
 * reading the state `stateId` in one of its accounts, those its latest change removes or adds
 * (`change` is then set). Undefined elsewhere.
 */
export function activeParts(m: Model3D, loc: VerseLoc, stateId: string | null): { parts?: string[]; change?: ModelChange; step?: ModelStep } {
  const at = modelBuildAt(m, loc);
  if (at) { const step = at.build.steps[at.step - 1]; return { parts: step?.parts, step }; }
  const reading = modelStateAt(m, loc);
  const change = reading && reading.state.id === stateId ? reading.account.changes[reading.step - 1] : undefined;
  return { parts: change && [...(change.hides ?? []), ...(change.shows ?? [])], change };
}

/**
 * What the camera should frame at `loc`: during a build, the objects the latest step is working
 * on — each named part's nearest ancestor flagged `userData.focus`, or the whole model if it has
 * none — so a new piece of furniture fills the view rather than the whole site. While reading a
 * later state, likewise what its latest change removes or adds, including parts still fading out.
 * Otherwise, all that is shown. `whole` says the box is the model's, not one piece's.
 */
export function focusBox(m: Model3D, object: THREE.Object3D, loc: VerseLoc, stateId: string | null): { box: THREE.Box3; whole: boolean } {
  const { parts, change } = activeParts(m, loc, stateId);
  if (!parts) return { box: visibleBox(object), whole: true };
  const box = new THREE.Box3();
  let whole = false;
  for (const name of parts) {
    let n: THREE.Object3D | null | undefined = object.getObjectByName(name);
    while (n && n !== object && !n.userData.focus) n = n.parent;
    if (!n || n === object) whole = true;
    // A part being removed is framed where it stood, though it is on its way out of sight.
    box.union(change ? new THREE.Box3().setFromObject(n ?? object) : visibleBox(n ?? object));
  }
  return { box, whole };
}

/**
 * The top of the highest floor drawn under `p` (model coordinates) and no higher than `maxY`: the
 * parts a model flags `userData.ground` (Ezekiel's courts, raised on steps). Null if there is none,
 * when the figure stands on the ground at y = 0.
 */
export function floorUnder(o: THREE.Object3D, p: THREE.Vector3, maxY: number): number | null {
  const floors: THREE.Object3D[] = [];
  o.traverseVisible((x) => { if ((x as THREE.Mesh).isMesh) for (let n: THREE.Object3D | null = x; n && n !== o; n = n.parent) if (n.userData.ground) { floors.push(x); break; } });
  if (!floors.length) return null;
  o.updateMatrixWorld(true);
  const from = p.clone().add(o.position).setY(1e6), hits = new THREE.Raycaster(from, new THREE.Vector3(0, -1, 0)).intersectObjects(floors, false);
  const ys = hits.map((h) => h.point.y - o.position.y).filter((y) => y <= maxY + 1e-3);
  return ys.length ? Math.max(...ys) : null;
}

/** The unit direction from a model to a camera at `view`, as a spherical angle (phi from +y, theta from +z towards +x). */
export const viewDir = ([azimuth, elevation]: ModelAngle) => new THREE.Spherical(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));

/** The viewer camera's vertical field of view, in degrees. */
export const MODEL_FOV = 35;

/**
 * Where the camera goes at `loc`: it looks at `target` from `dist` away along `dir`. While a passage
 * is building or changing the model, `dir` is that passage's angle (`turning`), turned the short way
 * round from `fromDir`; elsewhere it stays `fromDir`. `reference` is where the size figure or hand
 * stands (`p`, beside the framed box `local`, seen from `toward`), when `ref` is given; the camera
 * frames it too, unless the figure wears the model. Null when nothing is shown.
 */
export interface Framing { target: THREE.Vector3; dist: number; dir: THREE.Spherical; turning: boolean; reference?: { p: THREE.Vector3; local: THREE.Box3; toward?: THREE.Vector3 } }
export function framingAt(m: Model3D, o: THREE.Object3D, loc: VerseLoc, stateId: string | null, ref: ScaleReference | null, fromDir: THREE.Spherical): Framing | null {
  const view = modelViewAt(m, loc, stateId);
  const f = focusBox(m, o, loc, stateId);
  if (f.box.isEmpty()) return null;
  const dir = view ? viewDir(view) : fromDir.clone();
  // Turn the short way round (in spherical angles, so front to back goes round the model, not through it).
  dir.theta = fromDir.theta + THREE.MathUtils.euclideanModulo(dir.theta - fromDir.theta + Math.PI, Math.PI * 2) - Math.PI;
  const b = f.box.clone();
  let reference: Framing['reference'];
  if (ref) {
    // The reference group sits at the model's offset, so work in the model's own coordinates.
    const off = ref.group.position, local = f.box.clone().translate(off.clone().negate());
    const worn = !!m.scale?.worn, authored = f.whole || worn ? m.scale?.at : undefined;
    const toward = f.whole ? undefined : local.getCenter(new THREE.Vector3()).addScaledVector(new THREE.Vector3().setFromSpherical(dir), 1e4);
    const p = ref.spot(local, authored, toward);
    // Beside a piece on a raised floor, the figure stands on that floor rather than inside it.
    if (!authored && ref.kind === 'figure') p.y = floorUnder(o, p, local.min.y) ?? p.y;
    // A figure wearing the model stays where it is and is not framed, so the camera can close in on a small part.
    if (!worn || f.whole) b.union(ref.boundsAt(p).translate(off));
    reference = { p, local, toward };
  }
  // A model seen whole is far enough back that its height fits the view, which the diagonal alone misses
  // for something tall and narrow (Nebuchadnezzar's statue). Never closer than about 70 cm to a piece,
  // so a ring or a cord is seen with what it hangs on.
  const size = b.getSize(new THREE.Vector3()), tall = f.whole ? (size.y / 2 / Math.tan(THREE.MathUtils.degToRad(MODEL_FOV / 2))) * 1.2 : 0;
  const dist = Math.max(size.length() * 1.5, tall, f.whole ? 0.3 : 0.7 / (m.scale?.metres ?? 1));
  return { target: b.getCenter(new THREE.Vector3()), dist, dir, turning: !!view, reference };
}

/**
 * The cutaway is a lengthwise section: a vertical plane down the model's long (x) axis that drops
 * whichever long side faces the camera, so the inside stays open from any angle. Parts flagged
 * `cutaway: true` are cut at the reader's choice (Show outside / Show inside); parts flagged
 * `cutaway: 'step'` (the high priest's garments) only at a step marked `cutaway`, one that puts
 * something on under them. `cutParts` lists their materials (a material belongs to one part, see
 * kit.ts) and how each is cut, and `cutCentre` is where the plane passes.
 */
export type CutHow = true | 'step';
export function cutParts(o: THREE.Object3D): [THREE.Material, CutHow][] {
  return o.children.filter((p) => p.userData.cutaway).flatMap((p) => [...new Set(materialsOf(p))].map((mat): [THREE.Material, CutHow] => [mat, p.userData.cutaway]));
}
export function cutCentre(o: THREE.Object3D): THREE.Vector3 | null {
  const parts = o.children.filter((p) => p.userData.cutaway);
  if (!parts.length) return null;
  const b = new THREE.Box3();
  for (const p of parts) b.union(new THREE.Box3().setFromObject(p));
  return b.getCenter(new THREE.Vector3());
}
/** The section plane for a camera at `camera`; three.js clips what lies on its negative side, the side nearer the camera. */
export const cutPlane = (centre: THREE.Vector3, camera: THREE.Vector3) =>
  new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, camera.z > centre.z ? -1 : 1), centre);
/**
 * How each cuttable material is cut at `loc` (null: not at all). Everything that can be cut is,
 * except what the text is building or changing now (and all inside it), so a piece on the near side,
 * such as the temple's stair, is not cut out of its own step. A step's `cuts` are cut all the same.
 */
export function cutsAt(m: Model3D, o: THREE.Object3D, cuts: [THREE.Material, CutHow][], loc: VerseLoc, stateId: string | null): Map<THREE.Material, CutHow | null> {
  const active = activeParts(m, loc, stateId), keep = new Set<THREE.Material>();
  for (const name of (active.parts ?? []).filter((n) => !active.step?.cuts?.includes(n))) { const p = o.getObjectByName(name); if (p) for (const mat of materialsOf(p)) keep.add(mat); }
  return new Map(cuts.map(([mat, how]) => [mat, keep.has(mat) || (how === 'step' && !active.step?.cutaway) ? null : how]));
}
