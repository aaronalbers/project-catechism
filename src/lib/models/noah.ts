import * as THREE from 'three';
import { box, boxGeo, instances, namedPart, wood, type V3 } from './kit';

/**
 * Noah's ark (Gen 6:14–16), in cubits, long axis along x. The text gives 300 × 50 × 30, rooms,
 * pitch inside and out, a roof with the walls finished a cubit below it, a door in the side and
 * three decks; the shape, wall thickness, room layout, deck heights and door size are estimated,
 * each basis recorded in models.json. Hull, pitch, roof and door are flagged `cutaway`, so the
 * viewer can open the side to show the decks and rooms.
 */
export function noahsArk(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const shell = (name: string, ...children: THREE.Object3D[]) => { const p = part(name, ...children); p.userData.cutaway = true; return p; };
  // A tevah, "a box": drawn as a rectangular barge. Walls stop a cubit short of the full 30 (6:16).
  const L = 300, W = 50, H = 30, wallH = H - 1, t = 0.5;
  const hull = (grow: number, mat: THREE.Material) => [
    box(L + grow, t + grow, W + grow, 0, t / 2, 0, mat),
    ...[-1, 1].map((sz) => box(L + grow, wallH + grow, t + grow, 0, wallH / 2, sz * (W / 2 - t / 2), mat)),
    ...[-1, 1].map((sx) => box(t + grow, wallH + grow, W - 2 * t, sx * (L / 2 - t / 2), wallH / 2, 0, mat)),
  ];
  shell('hull', ...hull(0, wood()));
  // "Inside and out": a skin of pitch a little thicker than the wood on both faces.
  shell('pitch', ...hull(0.2, new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.45 })));

  // Rooms (qinnim, "nests"): number and size not given. Drawn as a 10-cubit aisle down the middle
  // with a room every 15 cubits either side of it, the partitions running through all three decks.
  const aisle = 5, bay = 15, rt = 0.25, inner = W / 2 - t;
  const rm = wood();
  const cross = Array.from({ length: L / bay - 1 }, (_, i) => -L / 2 + bay * (i + 1));
  part('rooms',
    ...[-1, 1].map((sz) => box(L - 2 * t, wallH - t, rt, 0, t + (wallH - t) / 2, sz * aisle, rm)),
    instances(boxGeo(rt, wallH - t, inner - aisle), rm,
      cross.flatMap((x) => [-1, 1].map((sz): V3 => [x, t + (wallH - t) / 2, sz * (aisle + inner) / 2]))));

  // Lower, middle and upper decks: the lower is the hull's floor; the other two are drawn at equal heights.
  const dm = wood();
  part('decks', ...[10, 20].map((y) => box(L - 2 * t, 0.4, W - 2 * t, 0, y, 0, dm)));

  // Roof at the full 30 cubits, a cubit above the walls, on posts that leave the gap open all round.
  const roofM = wood(), overhang = 1, postAt: V3[] = [];
  for (let x = -L / 2 + t / 2; x <= L / 2; x += 10) for (const sz of [-1, 1]) postAt.push([Math.min(x, L / 2 - t / 2), wallH + 0.5, sz * (W / 2 - t / 2)]);
  for (const sx of [-1, 1]) for (let z = -W / 2 + 10; z < W / 2; z += 10) postAt.push([sx * (L / 2 - t / 2), wallH + 0.5, z]);
  shell('roof', box(L + 2 * overhang, 0.5, W + 2 * overhang, 0, H + 0.25, 0, roofM), instances(boxGeo(t, 1, t), roofM, postAt));

  // A door in the side (6:16), on the lower deck; its size and place along the side are not given.
  shell('door', box(6, 8, 0.3, 0, 5, W / 2 + 0.35, new THREE.MeshStandardMaterial({ color: 0x5c3d20, roughness: 0.8 })));
  return g;
}
