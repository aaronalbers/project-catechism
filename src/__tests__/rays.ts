// Ray casting for the model visibility tests: where each part a step adds can be seen from.
import * as THREE from 'three';
import { parseRef, type VerseLoc } from '@/lib/refs';
import type { Model3D } from '@/lib/types';

/** Points on a mesh's surface in world space: the centres of up to `n` of its triangles, spread through it. */
function surface(geo: THREE.BufferGeometry, n: number, world: THREE.Matrix4): THREE.Vector3[] {
  const pos = geo.getAttribute('position'), index = geo.getIndex(), tris = (index ? index.count : pos.count) / 3;
  const vertex = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
  const out: THREE.Vector3[] = [], step = Math.max(1, Math.floor(tris / n));
  for (let t = 0; t < tris; t += step) out.push(vertex(3 * t).add(vertex(3 * t + 1)).add(vertex(3 * t + 2)).divideScalar(3).applyMatrix4(world));
  return out;
}

/**
 * Where a part can be seen from the camera, found by casting rays from where the viewer puts the
 * camera (see lib/models/view.ts) at points on the part's surface: triangle centres of each mesh,
 * and of up to 20 copies of an instanced one. A ray sees the part if nothing drawn lies in front of
 * its point, skipping what is not drawn: hidden parts, lattices drawn as wireframe, and whatever the
 * cutaway clips. Faces turned away from the camera are culled, as the renderer culls them.
 */
export function seen(model: THREE.Object3D, part: THREE.Object3D, camera: THREE.Vector3, clips: Map<THREE.Material, THREE.Plane>): { rays: number; hits: number } {
  const targets: THREE.Vector3[] = [], m4 = new THREE.Matrix4();
  part.traverseVisible((o) => {
    const mesh = o as THREE.Mesh, inst = o as THREE.InstancedMesh;
    if (!mesh.isMesh) return;
    if (!inst.isInstancedMesh) { targets.push(...surface(mesh.geometry, 24, mesh.matrixWorld)); return; }
    for (let i = 0; i < inst.count; i += Math.max(1, Math.floor(inst.count / 20))) {
      inst.getMatrixAt(i, m4);
      targets.push(...surface(inst.geometry, 6, m4.clone().premultiply(inst.matrixWorld)));
    }
  });
  const drawn = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false; return true; };
  const inPart = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === part) return true; return false; };
  const ray = new THREE.Raycaster();
  let hits = 0;
  for (const t of targets) {
    const d = t.distanceTo(camera);
    ray.set(camera, t.clone().sub(camera).normalize());
    const first = ray.intersectObject(model, true).find((h) => {
      const mat = (h.object as THREE.Mesh).material as THREE.Material & { wireframe?: boolean };
      if (!drawn(h.object) || mat.wireframe) return false;
      const plane = clips.get(mat);
      return !(plane && plane.distanceToPoint(h.point) < 0);
    });
    if (!first || inPart(first.object) || first.distance >= d * (1 - 1e-4)) hits++;
  }
  return { rays: targets.length, hits };
}

/** Every step of every build, and every change of every state's account that adds an alternate. */
export function moments(m: Model3D): { label: string; loc: VerseLoc; stateId: string | null; parts: string[] }[] {
  const at = (ref: string) => parseRef(ref)!.start;
  return [
    ...(m.builds ?? []).flatMap((b) => b.steps.map((st) => ({ label: `${b.ref} step ${st.ref}`, loc: at(st.ref), stateId: null, parts: st.parts }))),
    ...(m.states ?? []).flatMap((s) => s.accounts.flatMap((a) => a.changes.filter((ch) => ch.shows?.length)
      .map((ch) => ({ label: `${s.id} ${a.ref} change ${ch.ref}`, loc: at(ch.ref), stateId: s.id, parts: ch.shows! })))),
  ];
}
