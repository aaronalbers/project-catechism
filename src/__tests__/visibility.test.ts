import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MODELS } from '@/lib/content';
import { buildProcedural } from '@/lib/models';
import { scaleReference } from '@/lib/models/scale';
import { cutCentre, cutParts, cutPlane, cutsAt, framingAt, partsShown } from '@/lib/models/view';
import { moments, seen } from './rays';

/**
 * Parts a step adds that the text itself hides, so no camera could show them. Keyed `model step
 * part`; each says why. Add to this only when the text hides the part, not to excuse a bad angle.
 */
const HIDDEN_BY_THE_TEXT: Record<string, string> = {
  'noahs-ark Gen.6.14 hull': "'cover it with pitch inside and out' in the same verse: the pitch skin encloses the wood, and it is the pitch that is seen",
};

describe('model visibility', () => {
  // A step that adds a part the reader cannot see (inside a wall that is not cut away, behind
  // another piece, or facing away) shows nothing new. Each part a step adds, or a state's change
  // shows, must be hit by at least one ray from the camera the viewer uses for that step.
  for (const m of MODELS.filter((x) => x.kind === 'procedural' && x.procedural && (x.builds || x.states))) {
    for (const reading of m.readings?.map((r) => r.id) ?? [undefined]) it(`${m.id}${reading ? ` (${reading})` : ''}: every part is seen at the step that adds it`, () => {
      const model = buildProcedural(m.procedural!, reading);
      const ref = m.scale ? scaleReference(m.scale, new THREE.Box3().setFromObject(model)) : null;
      const cuts = cutParts(model), centre = cutCentre(model);
      const unseen: string[] = [], excused = new Set<string>();
      for (const { label, loc, stateId, parts } of moments(m)) {
        for (const [node, show] of partsShown(m, model, loc, stateId)) node.visible = show;
        model.updateMatrixWorld(true);
        const f = framingAt(m, model, loc, stateId, ref, new THREE.Spherical(1, Math.PI / 3, 0))!;
        const camera = f.target.clone().addScaledVector(new THREE.Vector3().setFromSpherical(f.dir), f.dist);
        // The viewer opens with Show inside on, so parts cut at the reader's choice are cut.
        const plane = centre && cutPlane(centre, camera), clips = new Map<THREE.Material, THREE.Plane>();
        if (plane) for (const [mat, how] of cutsAt(m, model, cuts, loc, stateId)) if (how) clips.set(mat, plane);
        for (const name of parts) {
          const { rays, hits } = seen(model, model.getObjectByName(name)!, camera, clips);
          const key = `${m.id} ${loc.book}.${loc.chapter}.${loc.verse} ${name}`;
          if (!hits && HIDDEN_BY_THE_TEXT[key]) excused.add(key);
          else if (!hits) unseen.push(`${label}: ${name} (0 of ${rays} rays)`);
        }
      }
      expect(unseen, `${m.id}: parts hidden at the step that adds them`).toEqual([]);
      // An exception whose part can now be seen, or whose step is gone, is stale.
      expect(Object.keys(HIDDEN_BY_THE_TEXT).filter((k) => k.startsWith(`${m.id} `) && !excused.has(k)), `${m.id}: stale entries in HIDDEN_BY_THE_TEXT`).toEqual([]);
    }, 60_000);
  }
});
