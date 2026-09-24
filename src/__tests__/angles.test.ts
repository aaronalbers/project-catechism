// Finds camera angles that show what a model's step adds. Not a check: it runs only when asked,
//
//   MODEL=tabernacle STEP=Exod.40.18 npm run models:angles
//
// and prints, for the step's current angle and a grid of others, the share of rays from the viewer's
// camera that reach each part the step adds (see rays.ts), best first: by the least-seen part, then
// by the average (SORT=mean puts the average first, for a step that adds many parts). MIN_ELEVATION=0
// leaves out views from below the ground. Put the angle you pick in the step's `view`. STEP may be a
// build step's ref or a state change's. Leave it out to list every step of the model with a part less
// than half seen, with how tall its largest piece looks, as a share of the view's height: the share of
// rays says nothing about size, and a part can be in plain sight and a speck. Small repeated pieces
// (rings, pomegranates) are small by design, since the camera frames what they hang on.
import { it } from 'vitest';
import * as THREE from 'three';
import { MODELS } from '@/lib/content';
import { buildProcedural } from '@/lib/models';
import { scaleReference } from '@/lib/models/scale';
import { cutCentre, cutParts, cutPlane, cutsAt, framingAt, partsShown } from '@/lib/models/view';
import type { ModelAngle, ModelChange, ModelStep } from '@/lib/types';
import { moments, seen } from './rays';

const { MODEL, STEP, SORT, MIN_ELEVATION } = process.env;
/** The viewer's vertical field of view (ModelsPanel). */
const FOV = 35;
const GRID: ModelAngle[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].flatMap((az) => [-15, 0, 10, 30, 50, 70].map((el): ModelAngle => [az, el])).filter(([, el]) => el >= Number(MIN_ELEVATION ?? -90));

it.skipIf(!MODEL)('camera angles for a model step', () => {
  const m = structuredClone(MODELS.find((x) => x.id === MODEL));
  if (!m) throw new Error(`no model '${MODEL}'; ids: ${MODELS.map((x) => x.id).join(', ')}`);
  const model = buildProcedural(m.procedural!), ref = m.scale ? scaleReference(m.scale, new THREE.Box3().setFromObject(model)) : null;
  const cuts = cutParts(model), centre = cutCentre(model);
  // The step or change being read, so its `view` can be tried in place.
  const holder = (ref: string): ModelStep | ModelChange | undefined =>
    m.builds?.flatMap((b) => b.steps).find((s) => s.ref === ref) ?? m.states?.flatMap((s) => s.accounts.flatMap((a) => a.changes)).find((c) => c.ref === ref);
  const shares = (mo: ReturnType<typeof moments>[number]) => {
    for (const [n, show] of partsShown(m, model, mo.loc, mo.stateId)) n.visible = show;
    model.updateMatrixWorld(true);
    const f = framingAt(m, model, mo.loc, mo.stateId, ref, new THREE.Spherical(1, 1, 0))!;
    const camera = f.target.clone().addScaledVector(new THREE.Vector3().setFromSpherical(f.dir), f.dist);
    const plane = centre && cutPlane(centre, camera), clips = new Map<THREE.Material, THREE.Plane>();
    if (plane) for (const [mat, how] of cutsAt(m, model, cuts, mo.loc, mo.stateId)) if (how) clips.set(mat, plane);
    // How tall the part looks: its largest piece (a mesh, or one copy of an instanced one, such as a
    // single wheel), as its bounding sphere's diameter over the height of the view at its distance.
    const size = (o: THREE.Object3D) => {
      let best = 0;
      const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), m4 = new THREE.Matrix4();
      const piece = (sphere: THREE.Sphere, world: THREE.Matrix4) => {
        const s = sphere.clone().applyMatrix4(world);
        best = Math.max(best, s.radius / (s.center.distanceTo(camera) * tan));
      };
      o.traverseVisible((x) => {
        const mesh = x as THREE.Mesh, inst = x as THREE.InstancedMesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingSphere();
        if (!inst.isInstancedMesh) { piece(mesh.geometry.boundingSphere!, mesh.matrixWorld); return; }
        for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m4); piece(inst.geometry.boundingSphere!, m4.premultiply(inst.matrixWorld)); }
      });
      return best;
    };
    return mo.parts.map((p) => { const o = model.getObjectByName(p)!, { rays, hits } = seen(model, o, camera, clips); return { p, share: rays ? hits / rays : 0, size: size(o) }; });
  };
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
  const all = moments(m), refOf = (label: string) => label.split(' ').at(-1)!;

  if (!STEP) {
    for (const mo of all) {
      const low = shares(mo).filter((s) => s.share < 0.5);
      if (low.length) console.log(`${mo.label}: ${low.map((s) => `${s.p} ${pct(s.share).trim()} seen, piece ${pct(s.size).trim()} of the view`).join('; ')}`);
    }
    return;
  }
  const mo = all.find((x) => refOf(x.label) === STEP);
  const at = holder(STEP);
  if (!mo || !at) throw new Error(`${MODEL} has no step or change '${STEP}'`);
  const current = at.view;
  const rows = [undefined, ...GRID].map((view) => {
    at.view = view ?? current;
    const s = shares(mo);
    return { view: view ? `[${view.join(', ')}]` : `current ${JSON.stringify(current ?? m.view ?? 'default')}`, s, worst: Math.min(...s.map((x) => x.share)), mean: s.reduce((a, x) => a + x.share, 0) / s.length };
  });
  const [first, ...rest] = rows;
  rest.sort((a, b) => SORT === 'mean' ? b.mean - a.mean || b.worst - a.worst : b.worst - a.worst || b.mean - a.mean);
  console.log(`${MODEL} ${mo.label}\n${'view'.padEnd(22)}${mo.parts.map((p) => p.slice(0, 14).padStart(15)).join('')}${'mean'.padStart(8)}`);
  for (const r of [first, ...rest.slice(0, 15)]) console.log(r.view.padEnd(22) + r.s.map((x) => pct(x.share).padStart(15)).join('') + pct(r.mean).padStart(8));
}, 300_000);
