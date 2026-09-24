import * as THREE from 'three';
import { bronze, meshAt, namedPart, wood } from './kit';
import { figure } from './scale';

/** Bronze scales in offset rows (qasqassim, 1 Sam 17:5; the word is a fish's scales in Lev 11:9), as a grey map on bronze. */
function scales(repeatX: number, repeatY: number): THREE.DataTexture {
  const n = 16, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // Two rows of scales per tile, the upper row offset by half a scale; each is lit at its middle and
    // darker towards its rounded lower edge, where the row below shows from under it.
    const row = y < n / 2 ? 0 : 1, u = ((x + (row ? n / 4 : 0)) % (n / 2)) / (n / 2) - 0.5, v = (y % (n / 2)) / (n / 2);
    const edge = Math.hypot(u * 2, (1 - v) * 1.1);
    const k = edge > 1 ? 90 : Math.round(235 - 110 * edge ** 3);
    data.set([k, k, k, 255], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
  t.repeat.set(repeatX, repeatY); t.needsUpdate = true;
  return t;
}

/** A leaf-shaped blade `len` long and `w` wide, pointing up from y = 0, flattened to `flat` of its width. */
function blade(len: number, w: number, flat: number, mat: THREE.Material) {
  const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return new THREE.Vector2((w / 2) * Math.sin(Math.PI * t) ** 0.8 * (1 - 0.35 * t), t * len); });
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat); m.scale.z = flat; return m;
}

/**
 * Goliath armed as 1 Sam 17:4-7 describes him, in cubits, standing at the origin facing +z. He is
 * drawn at the Masoretic text's height, six cubits and a span, which the BSB follows; the Qumran
 * scroll, the Greek and Josephus have four cubits and a span (see models.json). His body is the size
 * figure's (scale.ts), scaled to his height, so the figure the viewer draws beside him, standing
 * where his shield-bearer went before him (v. 7), compares like with like. The text gives the
 * materials, two weights and the spear's shaft; every shape and size is reconstructed, each basis
 * recorded in models.json.
 */
export function goliath(): THREE.Group {
  const g = new THREE.Group();
  const part = namedPart(g);
  const h = 6.5, H = (f: number) => f * h;

  // v. 4: "six cubits and a span in height", the span taken as half a cubit.
  part('goliath', figure(h));

  // v. 5: a bronze helmet, drawn as a rounded cap with a rolled rim.
  const hm = bronze(), headY = H(0.93), cap = new THREE.Mesh(new THREE.SphereGeometry(H(0.071), 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hm);
  cap.position.y = headY;
  const rimY = headY + H(0.071) * Math.cos(Math.PI * 0.56), rim = meshAt(new THREE.TorusGeometry(H(0.071) * Math.sin(Math.PI * 0.56), H(0.005), 8, 40), hm, 0, rimY, 0);
  rim.rotation.x = Math.PI / 2;
  part('helmet', cap, rim, meshAt(new THREE.SphereGeometry(H(0.012), 12, 8), hm, 0, headY + H(0.071), 0));

  // v. 5: a coat of scales, 5,000 shekels of bronze, drawn from the neck to mid-thigh with sleeves to the
  // elbow. Its outline is [radius, height] in fractions of h, rising; its cross-section an ellipse `zs` deep.
  const zs = 0.65, coatP: [number, number][] = [[0.15, 0.36], [0.14, 0.42], [0.127, 0.5], [0.127, 0.62], [0.132, 0.72], [0.122, 0.79], [0.092, 0.835], [0.055, 0.855]];
  const cm = new THREE.MeshStandardMaterial({ color: 0xb07a42, map: scales(56, 34), metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.LatheGeometry(coatP.map(([r, y]) => new THREE.Vector2(H(r), H(y))), 64), cm);
  body.scale.z = zs;
  const sleeveGeo = new THREE.CylinderGeometry(H(0.048), H(0.052), H(0.16), 20, 1, true), shoulderGeo = new THREE.SphereGeometry(H(0.05), 20, 12);
  part('coat-of-mail', body, ...[-1, 1].map((sx) => {
    // As the figure's arm hangs: from its shoulder, turned a little out from the side (scale.ts `shoulder`).
    const s = new THREE.Group(); s.position.set(sx * H(0.13), H(0.8), 0); s.rotation.z = sx * 0.3;
    s.add(meshAt(sleeveGeo, cm, 0, -H(0.08), 0), meshAt(shoulderGeo, cm, 0, 0, 0));
    return s;
  }));

  // v. 6: bronze greaves, from the ankle to below the knee, wrapping the shin and open at the back of the calf.
  const gm = bronze(); gm.side = THREE.DoubleSide;
  const greaveGeo = new THREE.CylinderGeometry(H(0.057), H(0.052), H(0.2), 24, 1, true, -Math.PI * 0.8, Math.PI * 1.6);
  part('greaves', ...[-1, 1].map((sx) => meshAt(greaveGeo, gm, sx * H(0.06), H(0.155), 0)));

  // v. 6: a bronze javelin "between his shoulders", slung across his back, its head over his right shoulder.
  const jFrom = new THREE.Vector3(-H(0.2), H(0.45), -H(0.095)), jTo = new THREE.Vector3(H(0.18), H(1.0), -H(0.095));
  const jDir = jTo.clone().sub(jFrom), jLen = jDir.length(), up = new THREE.Vector3(0, 1, 0);
  const jav = new THREE.Group(); jav.position.copy(jFrom); jav.quaternion.setFromUnitVectors(up, jDir.clone().normalize());
  const jHead = blade(0.55, 0.12, 0.3, bronze()); jHead.position.y = jLen;
  jav.add(meshAt(new THREE.CylinderGeometry(0.034, 0.034, jLen, 10), wood(), 0, jLen / 2, 0), jHead);
  part('javelin', jav);

  // v. 7: the spear, held upright in his right hand (where the figure's hand hangs), its butt on the ground.
  // The shaft is "like a weaver's beam", drawn ≈6 cm thick and 7 cubits long; the iron point (600 shekels,
  // ≈6.8 kg) is a leaf blade ≈50 cm long and 14.5 cm wide on a socket, which holds about that much iron.
  const spear = part('spear'), inSpear = namedPart(spear), sx = H(0.255), sz = H(0.02), shaftL = 7, cmPer = 1 / 44.5;
  inSpear('spear-shaft', meshAt(new THREE.CylinderGeometry(3 * cmPer * 0.9, 3 * cmPer, shaftL, 16), wood(), sx, shaftL / 2, sz));
  const iron = new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.85, roughness: 0.5 });
  const socketL = 15 * cmPer, point = blade(50 * cmPer, 14.5 * cmPer, 0.25, iron);
  point.position.set(sx, shaftL + socketL, sz);
  inSpear('spear-point', meshAt(new THREE.CylinderGeometry(2.9 * cmPer, 3.3 * cmPer, socketL, 16), iron, sx, shaftL + socketL / 2, sz), point);

  // v. 7: the great shield (tsinnah), carried by the shield-bearer who went before him. The bearer is the
  // size figure, which the model's `scale.at` stands ahead of Goliath and to his left; the shield is held
  // before the bearer, clear of the ground. Drawn as a tall board of hide on a wooden frame.
  const bearer = [-2.8, 0, 3.2], sw = 1.6, sh = 2.7, st = 0.08;
  const hide = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }), frame = wood();
  const shield = part('shield', meshAt(new THREE.BoxGeometry(sw, sh, st), hide, bearer[0], 0.15 + sh / 2, bearer[2] + 0.5));
  for (const [w, hh, x, y] of [[sw + 0.1, 0.1, 0, sh / 2], [sw + 0.1, 0.1, 0, -sh / 2], [0.1, sh, sw / 2, 0], [0.1, sh, -sw / 2, 0]])
    shield.add(meshAt(new THREE.BoxGeometry(w, hh, st + 0.06), frame, bearer[0] + x, 0.15 + sh / 2 + y, bearer[2] + 0.5));

  // 17:51: the sword David drew "from its sheath"; not in vv. 4-7. Drawn sheathed at his left hip on a belt.
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.85 }), hilt = bronze();
  const belt = meshAt(new THREE.TorusGeometry(H(0.13), H(0.006), 8, 48), leather, 0, H(0.5), 0);
  belt.rotation.x = Math.PI / 2; belt.scale.y = zs;
  const sword = new THREE.Group(); sword.position.set(-H(0.145), H(0.5), H(0.02)); sword.rotation.set(-0.35, 0, -0.12);
  sword.add(meshAt(new THREE.BoxGeometry(0.16, 1.8, 0.07), leather, 0, -0.9, 0), meshAt(new THREE.BoxGeometry(0.4, 0.06, 0.1), hilt, 0, 0.03, 0), meshAt(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), hilt, 0, 0.21, 0));
  part('sword', belt, sword);

  return g;
}
