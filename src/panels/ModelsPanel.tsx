import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '@/app/store';
import { modelBuildAt, modelHiddenIn, modelStateAt, modelViewAt, modelsFor, modelsInChapter } from '@/lib/content';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Model3D, ModelAngle, ModelChange, ModelStep } from '@/lib/types';
import { buildProcedural } from '@/lib/models';
import { CUBIT_M, FIGURE_M, formatMetres, scaleReference, type ScaleReference } from '@/lib/models/scale';
import { formatRef, type VerseLoc } from '@/lib/refs';

/**
 * A part fading and dropping into place after its verse is reached, or, when `leaving`, fading and
 * sinking out of sight when a later change removes it.
 */
interface Arrival { part: THREE.Object3D; t0: number; y0: number; drop: number; mats: THREE.Material[]; leaving?: boolean }
const ARRIVE_MS = 700, LEAVE_MS = 1100;
/**
 * The camera easing to frame the parts shown so far. While a passage is building or changing the
 * model it also turns to that passage's angle (`modelViewAt`); elsewhere it keeps the angle it has.
 */
interface Framing { from: THREE.Vector3; to: THREE.Vector3; fromDist: number; toDist: number; turn: { from: THREE.Spherical; to: THREE.Spherical } | null; t0: number }
const FRAME_MS = 900;
/** The unit direction from a model to a camera at `view`, as a spherical angle (phi from +y, theta from +z towards +x). */
const viewDir = ([azimuth, elevation]: ModelAngle) => new THREE.Spherical(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
/** The size reference fading out where it stood and back in beside what the camera now frames. */
interface Move { t0: number; p: THREE.Vector3; box: THREE.Box3; toward?: THREE.Vector3; placed: boolean }
const MOVE_OUT_MS = 300, MOVE_IN_MS = 450;

/**
 * Shows the parts of `object` the text has described by `loc`; outside a build, every part the
 * state `stateId` (null: as built) has not hidden, as far as the reading has got through it. A
 * part is any named node, and parts nest: naming a part in a step shows everything inside it,
 * hiding one hides everything inside it, and during a build a part stays visible while anything
 * inside it is shown. Parts shown or removed are queued in `arrivals` to animate in or out — only
 * the outermost, so nested pieces don't move twice. Returns whether anything was shown or hidden.
 */
function syncParts(m: Model3D, object: THREE.Object3D, loc: VerseLoc, stateId: string | null, arrivals: Arrival[] | null): boolean {
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
  const drop = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y * 0.25;
  let changed = false;
  const apply = (node: THREE.Object3D, parentMoving: boolean) => {
    let moving = parentMoving;
    const show = want.get(node);
    if (show !== undefined) {
      const queued = arrivals?.findIndex((a) => a.part === node) ?? -1, leaving = queued >= 0 && !!arrivals![queued].leaving;
      if (show) {
        if (leaving) { settle(arrivals!.splice(queued, 1)[0]); changed = true; } // shown again before it had gone
        const appearing = !node.visible;
        if (appearing && arrivals && !parentMoving && queued < 0) {
          arrivals.push({ part: node, t0: performance.now(), y0: node.position.y, drop, mats: [...new Set(materialsOf(node))] });
        }
        moving ||= appearing;
        if (appearing) changed = true;
        node.visible = true;
      } else if (leaving) {
        return; // fading out; what is inside goes with it
      } else if (node.visible) {
        changed = true;
        if (arrivals && !parentMoving) {
          if (queued >= 0) settle(arrivals.splice(queued, 1)[0]);
          arrivals.push({ part: node, t0: performance.now(), y0: node.position.y, drop, mats: [...new Set(materialsOf(node))], leaving: true });
          return;
        }
        node.visible = false;
      }
    }
    for (const c of node.children) apply(c, moving);
  };
  for (const c of object.children) apply(c, false);
  return changed;
}

/**
 * The parts the text is working on at `loc`: during a build, those the latest step adds; while
 * reading the state `stateId` in one of its accounts, those its latest change removes or adds
 * (`change` is then set). Undefined elsewhere.
 */
function activeParts(m: Model3D, loc: VerseLoc, stateId: string | null): { parts?: string[]; change?: ModelChange; step?: ModelStep } {
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
function focusBox(m: Model3D, object: THREE.Object3D, loc: VerseLoc, stateId: string | null): { box: THREE.Box3; whole: boolean } {
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

/** Fades every material of the size reference; its materials are its own, so nothing else fades. */
function setOpacity(o: THREE.Object3D, opacity: number) {
  for (const mat of materialsOf(o)) { mat.transparent = opacity < 1; mat.opacity = opacity; }
}

/** Bounds of what is actually drawn — `Box3.setFromObject` counts hidden meshes too. */
function visibleBox(root: THREE.Object3D) {
  const b = new THREE.Box3();
  root.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) b.expandByObject(o); });
  return b;
}

function boxOf(parts: THREE.Object3D[]) {
  const b = new THREE.Box3();
  for (const p of parts) b.union(new THREE.Box3().setFromObject(p));
  return b;
}

/**
 * A material's own opacity and transparency, recorded the first time it fades in. Kept on the
 * material rather than the arrival, so an arrival that starts while another is mid-fade returns
 * to the true value, not a half-faded one.
 */
const restingLook = (mat: THREE.Material): { transparent: boolean; opacity: number } =>
  mat.userData.resting ??= { transparent: mat.transparent, opacity: mat.opacity };

const materialsOf = (o: THREE.Object3D) => {
  const out: THREE.Material[] = [];
  o.traverse((x) => { const mt = (x as THREE.Mesh).material; if (mt) out.push(...(Array.isArray(mt) ? mt : [mt])); });
  return out;
};

/** Frees what a model holds on the GPU: its geometries, materials and their textures. */
function disposeObject(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose();
    if ((x as THREE.InstancedMesh).isInstancedMesh) (x as THREE.InstancedMesh).dispose();
  });
  for (const mat of new Set(materialsOf(o))) {
    for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
    mat.dispose();
  }
}

/** Ends an animation where it would finish: in place and at the part's own look, gone if it was leaving. */
function settle({ part, y0, mats, leaving }: Arrival) {
  part.position.y = y0;
  for (const mat of mats) { const r = restingLook(mat); mat.transparent = r.transparent; mat.opacity = r.opacity; }
  if (leaving) part.visible = false;
}

function animateArrivals(arrivals: Arrival[]) {
  const now = performance.now();
  for (let i = arrivals.length - 1; i >= 0; i--) {
    const { part, t0, y0, drop, mats, leaving } = arrivals[i];
    if (leaving) {
      const k = Math.min(1, (now - t0) / LEAVE_MS), ease = k * k;
      part.position.y = y0 - ease * drop * 0.4;
      for (const mat of mats) { const r = restingLook(mat); mat.transparent = true; mat.opacity = r.opacity * (1 - ease); }
      if (k >= 1) { settle(arrivals[i]); arrivals.splice(i, 1); }
      continue;
    }
    const k = Math.min(1, (now - t0) / ARRIVE_MS), ease = 1 - (1 - k) ** 3;
    part.position.y = y0 + (1 - ease) * drop;
    for (const mat of mats) { const r = restingLook(mat); mat.transparent = k < 1 || r.transparent; mat.opacity = r.opacity * ease; }
    if (k >= 1) arrivals.splice(i, 1);
  }
}

function ModelView({ m, loc }: { m: Model3D; loc: VerseLoc }) {
  const el = useRef<HTMLDivElement>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const arrivals = useRef<Arrival[]>([]);
  const locRef = useRef(loc);
  locRef.current = loc;
  const frameRef = useRef<(animate: boolean) => void>(() => {});
  // The angle last framed at, so a move between steps that shows nothing new still turns the camera.
  const viewRef = useRef<string>('');
  // The later state shown: the one the text is describing here, unless the reader picked another.
  // A pick lasts until the reading moves into or out of a state's passage.
  const reading = modelStateAt(m, loc);
  const auto = reading?.state.id ?? null;
  const [picked, setPicked] = useState<{ auto: string | null; id: string | null } | null>(null);
  const stateId = picked && picked.auto === auto ? picked.id : auto;
  const stateRef = useRef(stateId);
  stateRef.current = stateId;
  // Models whose parts are flagged `cutaway` (the tabernacle's tent) can be opened to show what is inside.
  const [hasCutaway, setHasCutaway] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const cutawayRef = useRef(cutaway);
  cutawayRef.current = cutaway;
  // A figure or hand beside the model, and a bar, for its size; see ScaleNote for what they rest on.
  const [scaleInfo, setScaleInfo] = useState<{ kind: ScaleReference['kind']; bar: string } | null>(null);
  const [showScale, setShowScale] = useState(true);
  const showScaleRef = useRef(showScale);
  showScaleRef.current = showScale;
  const referenceRef = useRef<ScaleReference | null>(null);
  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // Metals only read as metal with something to reflect; a neutral room environment is cheap and asset-free.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.1;
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.01, 100);
    camera.position.set(0, 1.2, 3.2);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x403020, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe0b0, 0.8); rim.position.set(-3, 2, -2); scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.2; controls.enablePan = false;
    const fit = (o: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      o.position.sub(center);
      camera.position.set(0, size * 0.7, size * 1.5);
      controls.target.set(0, 0, 0);
    };
    // During a build the camera frames the object the latest step is building (see focusBox).
    let framing: Framing | null = null;
    // The size reference stands beside what the camera frames: at the model's chosen spot when that is
    // the whole model, otherwise off the corner of the framed piece nearest the camera. It is framed too.
    let move: Move | null = null;
    const moveReference = (ref: ScaleReference, p: THREE.Vector3, box: THREE.Box3, toward: THREE.Vector3 | undefined, animate: boolean) => {
      const settled = move ? move.p : ref.group.userData.at as THREE.Vector3 | undefined;
      if (settled?.equals(p) && (move ? move.box : ref.group.userData.box as THREE.Box3 | undefined)?.equals(box)) return;
      ref.group.userData.at = p; ref.group.userData.box = box;
      if (animate && settled) { move = { t0: performance.now(), p, box, toward, placed: false }; return; }
      move = null;
      setScaleInfo({ kind: ref.kind, bar: ref.place(p, box, toward) });
    };
    const stepReference = () => {
      const ref = referenceRef.current;
      if (!move || !ref) return;
      const now = performance.now();
      if (!move.placed) {
        const k = Math.min(1, (now - move.t0) / MOVE_OUT_MS);
        setOpacity(ref.group, 1 - k);
        if (k < 1) return;
        setScaleInfo({ kind: ref.kind, bar: ref.place(move.p, move.box, move.toward) });
        move.placed = true; move.t0 = now;
      }
      const k = Math.min(1, (now - move.t0) / MOVE_IN_MS);
      setOpacity(ref.group, k);
      if (k >= 1) move = null;
    };
    frameRef.current = (animate) => {
      const o = objectRef.current;
      // Held at the passage's angle while one is being read, turning freely otherwise.
      const view = modelViewAt(m, locRef.current, stateRef.current);
      viewRef.current = JSON.stringify(view);
      controls.autoRotate = !view;
      const active = activeParts(m, locRef.current, stateRef.current);
      cutAround(new Set(active.parts ?? []), !!active.step?.cutaway);
      const f = o && focusBox(m, o, locRef.current, stateRef.current);
      if (!f || f.box.isEmpty()) return;
      const fromDir = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      fromDir.radius = 1;
      const toDir = view ? viewDir(view) : fromDir.clone();
      // Turn the short way round (in spherical angles, so front to back goes round the model, not through it).
      toDir.theta = fromDir.theta + THREE.MathUtils.euclideanModulo(toDir.theta - fromDir.theta + Math.PI, Math.PI * 2) - Math.PI;
      const b = f.box.clone(), ref = referenceRef.current;
      if (ref?.group.visible) {
        // The reference group sits at the model's offset, so work in the model's own coordinates.
        const off = ref.group.position, local = f.box.clone().translate(off.clone().negate());
        const worn = !!m.scale?.worn, authored = f.whole || worn ? m.scale?.at : undefined;
        const toward = f.whole ? undefined : local.getCenter(new THREE.Vector3()).addScaledVector(new THREE.Vector3().setFromSpherical(toDir), 1e4);
        const p = ref.spot(local, authored, toward);
        // A figure wearing the model stays where it is and is not framed, so the camera can close in on a small part.
        if (!worn || f.whole) b.union(ref.boundsAt(p).translate(off));
        moveReference(ref, p, local, toward, animate);
      }
      // Never closer than about 70 cm to a piece, so a ring or a cord is seen with what it hangs on.
      const toDist = Math.max(b.getSize(new THREE.Vector3()).length() * 1.5, f.whole ? 0.3 : 0.7 / (m.scale?.metres ?? 1));
      framing = { from: controls.target.clone(), to: b.getCenter(new THREE.Vector3()), fromDist: camera.position.distanceTo(controls.target), toDist, turn: view ? { from: fromDir, to: toDir } : null, t0: animate ? performance.now() : -Infinity };
    };
    const stepFraming = () => {
      if (!framing) return;
      const k = Math.min(1, (performance.now() - framing.t0) / FRAME_MS), ease = 1 - (1 - k) ** 3;
      const { turn } = framing;
      const dir = turn
        ? new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, turn.from.phi + (turn.to.phi - turn.from.phi) * ease, turn.from.theta + (turn.to.theta - turn.from.theta) * ease))
        : camera.position.clone().sub(controls.target).normalize();
      controls.target.lerpVectors(framing.from, framing.to, ease);
      const d = framing.fromDist + (framing.toDist - framing.fromDist) * ease;
      camera.position.copy(controls.target).addScaledVector(dir, d);
      camera.near = d / 500; camera.far = d * 10; camera.updateProjectionMatrix();
      if (k >= 1) framing = null;
    };
    // The cutaway is a lengthwise section: a vertical plane down the tent's long (x) axis that drops
    // whichever long side faces the camera, so the inside stays open from any angle. Parts flagged
    // `cutaway: true` are cut by `cut`, which the Show outside / Show inside button moves out of the way;
    // parts flagged `cutaway: 'step'` (the high priest's garments) are cut by `stepCut`, and only at a
    // step marked `cutaway`, one that puts something on under them.
    const cut = new THREE.Plane(), stepCut = new THREE.Plane();
    let cutCenter: THREE.Vector3 | null = null;
    // The materials of the parts that can be cut away, and how; a material belongs to one part (see kit.ts).
    let cutMats: [THREE.Material, boolean | 'step'][] = [];
    // Everything that can be cut away is, except what the text is building or changing now (and all
    // inside it), so a piece on the near side, such as the temple's stair, is not cut out of its own step.
    const cutAround = (active: Set<string>, stepCuts: boolean) => {
      const o = objectRef.current;
      if (!o || !cutMats.length) return;
      const keep = new Set<THREE.Material>();
      for (const name of active) { const p = o.getObjectByName(name); if (p) for (const mat of materialsOf(p)) keep.add(mat); }
      for (const [mat, how] of cutMats) {
        const want = keep.has(mat) ? null : how === 'step' ? (stepCuts ? [stepCut] : null) : [cut];
        if (mat.clippingPlanes?.[0] !== want?.[0]) { mat.clippingPlanes = want; mat.needsUpdate = true; }
      }
    };
    const stepCutaway = () => {
      if (!cutCenter) return;
      stepCut.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, camera.position.z > cutCenter.z ? -1 : 1), cutCenter);
      if (cutawayRef.current) cut.copy(stepCut); else cut.set(new THREE.Vector3(0, 1, 0), 1e9);
    };
    let disposed = false;
    const place = (o: THREE.Object3D) => {
      if (disposed) { disposeObject(o); return; } // a glTF that finished loading after the view closed
      const reference = m.scale && scaleReference(m.scale, new THREE.Box3().setFromObject(o));
      scene.add(o); fit(o); objectRef.current = o;
      if (reference) {
        // A sibling of the model, not a part of it, moved by the same offset `fit` gave the model.
        reference.group.position.copy(o.position); reference.group.visible = showScaleRef.current;
        scene.add(reference.group); referenceRef.current = reference;
      }
      const tent = o.children.filter((p) => p.userData.cutaway);
      if (tent.length) {
        cutCenter = boxOf(tent).getCenter(new THREE.Vector3());
        cutMats = tent.flatMap((p) => [...new Set(materialsOf(p))].map((mat): [THREE.Material, boolean | 'step'] => [mat, p.userData.cutaway]));
        for (const [mat, how] of cutMats) if (how === true) mat.clippingPlanes = [cut];
        // Only parts cut at the reader's choice get the button; step cuts follow the text.
        setHasCutaway(tent.some((p) => p.userData.cutaway === true));
      }
      syncParts(m, o, locRef.current, stateRef.current, null);
      frameRef.current(false);
    };
    if (m.kind === 'procedural' && m.procedural) place(buildProcedural(m.procedural));
    else if (m.kind === 'gltf' && m.src) new GLTFLoader().load(`${import.meta.env.BASE_URL}${m.src}`, (g) => place(g.scene));
    let raf = 0;
    const loop = () => { animateArrivals(arrivals.current); stepFraming(); stepReference(); controls.update(); stepCutaway(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); });
    ro.observe(host);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      if (objectRef.current) disposeObject(objectRef.current);
      if (referenceRef.current) disposeObject(referenceRef.current.group);
      scene.environment?.dispose(); pmrem.dispose();
      // Browsers cap live WebGL contexts, and a chapter can show several viewers; release this one now.
      renderer.dispose(); renderer.forceContextLoss(); host.removeChild(renderer.domElement);
      objectRef.current = null; referenceRef.current = null; arrivals.current = [];
    };
  }, [m]);
  useEffect(() => {
    if (!objectRef.current) return;
    const shown = syncParts(m, objectRef.current, loc, stateId, arrivals.current);
    if (shown || JSON.stringify(modelViewAt(m, loc, stateId)) !== viewRef.current) frameRef.current(true);
  }, [m, loc, stateId]);
  useEffect(() => {
    if (!referenceRef.current) return;
    referenceRef.current.group.visible = showScale;
    frameRef.current(true);
  }, [showScale]);
  return (
    <>
      <div className="model-view" ref={el}>
        <div className="model-tools">
          {hasCutaway && <button type="button" onClick={() => setCutaway((c) => !c)}>{cutaway ? 'Show outside' : 'Show inside'}</button>}
          {scaleInfo && <button type="button" aria-pressed={showScale} onClick={() => setShowScale((v) => !v)}>{showScale ? 'Hide scale' : 'Show scale'}</button>}
        </div>
        <span className="hint">drag to rotate · scroll to zoom</span>
      </div>
      {scaleInfo && showScale && <ScaleNote m={m} kind={scaleInfo.kind} bar={scaleInfo.bar} />}
      {!!m.states?.length && !modelBuildAt(m, loc) && <ModelStates m={m} current={stateId} reading={reading?.state.id === stateId ? reading : null} onPick={(id) => setPicked({ auto, id })} />}
    </>
  );
}

/**
 * Buttons for the model as built and each later state, how far the reading has got through the
 * state it is in, and what the state shown rests on.
 */
function ModelStates({ m, current, reading, onPick }: { m: Model3D; current: string | null; reading: ReturnType<typeof modelStateAt>; onPick: (id: string | null) => void }) {
  const states = m.states ?? [], state = states.find((s) => s.id === current);
  const change = reading?.account.changes[reading.step - 1];
  return (
    <div className="model-states">
      <div role="group" aria-label="Show the model as it was">
        <button type="button" aria-pressed={current === null} onClick={() => onPick(null)}>As built</button>
        {states.map((s) => <button type="button" key={s.id} aria-pressed={current === s.id} onClick={() => onPick(s.id)}>{s.label}</button>)}
      </div>
      {reading && (
        <p className="build-progress">
          Changing as {formatRef(reading.account.ref)} tells it: change {reading.step} of {reading.account.changes.length}
          {change && <> ({[...(change.hides ?? []).map((p) => `${partLabel(p)} removed`), ...(change.shows ?? []).map((p) => `${partLabel(p)} added`)].join(', ')})</>}
        </p>
      )}
      {state && <p>{state.accounts.map((a) => formatRef(a.ref)).join('; ')}: {state.basis}</p>}
    </div>
  );
}

/** What the size references are and what they rest on. */
function ScaleNote({ m, kind, bar }: { m: Model3D; kind: ScaleReference['kind']; bar: string }) {
  const cubits = m.scale?.unit === 'cubit';
  return (
    <p className="scale-note">
      {kind === 'figure'
        ? <>Figure ≈ {formatMetres(FIGURE_M)}{cubits && <> (≈ {(FIGURE_M / CUBIT_M).toFixed(1)} cubits)</>}: the average height of a Judaean man in the first century, from skeletal remains (J. E. Taylor, <i>What Did Jesus Look Like?</i>, 2018).</>
        : <>Hand ≈ 18 cm long: its palm is one handbreadth across (⅙ cubit, ≈ {formatMetres(CUBIT_M / 6)}), its length drawn in proportion.</>}
      {' '}Bar: {bar}.
    </p>
  );
}

const partLabel = (name: string) => name.replace(/-/g, ' ');

/**
 * Where the reader is in a build: the passage, how many steps are done, and for the latest step
 * its own note and what each estimated part it adds rests on.
 */
function BuildProgress({ m, loc }: { m: Model3D; loc: VerseLoc }) {
  const at = modelBuildAt(m, loc);
  if (!at) return m.builds?.length ? <p className="build-progress">Builds as you read {m.builds.map((b) => formatRef(b.ref)).join(' or ')}.</p> : null;
  const step = at.build.steps[at.step - 1];
  const notes = step ? [step.basis, ...step.parts.map((p) => m.estimates?.[p] && `${partLabel(p)}: ${m.estimates[p]}`)].filter((n): n is string => !!n) : [];
  return (
    <p className="build-progress">
      Building from {formatRef(at.build.ref)}: step {at.step} of {at.build.steps.length}
      {step && <> ({step.parts.map(partLabel).join(', ')})</>}
      {notes.map((n) => <small key={n}>≈ {n}</small>)}
    </p>
  );
}

/** Every estimated part of the model and what it rests on, so the whole model is labelled too, not only a build's latest step. */
function Estimates({ m }: { m: Model3D }) {
  const list = Object.entries(m.estimates ?? {});
  if (!list.length) return null;
  return (
    <details className="estimates">
      <summary>≈ What is reconstructed ({list.length})</summary>
      <ul>{list.map(([p, why]) => <li key={p}><b>{partLabel(p)}</b>: {why}</li>)}</ul>
    </details>
  );
}

export function ModelsPanel() {
  const loc = useStore((s) => s.loc);
  const here = modelsFor(loc);
  const chapter = modelsInChapter(loc.book, loc.chapter).filter((m) => !here.includes(m));
  const list = [...here, ...chapter];
  return (
    <div className="panel-body">
      {list.length === 0 && <div className="empty"><p>No models for this chapter yet.</p><small>Register one in <code>content/models.json</code> — procedural (code) or glTF with attribution.</small></div>}
      {list.map((m) => (
        <div className="card" key={m.id}>
          <h3><span style={{ flex: 1 }}>{m.title}</span><ConfidenceBadge c={m.confidence} /></h3>
          <div className="verses">{m.dimensions && <span className="badge kind">{m.dimensions}</span>}{m.verses.map((r) => <RefChip key={r} r={r} />)}</div>
          <ModelView m={m} loc={loc} />
          <BuildProgress m={m} loc={loc} />
          <p className="summary">{m.summary}</p>
          <Estimates m={m} />
          <MediaList media={m.media} />
          <SourceList sources={m.sources} />
        </div>
      ))}
    </div>
  );
}
