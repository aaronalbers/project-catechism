import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useFeatureInView, useStore } from '@/app/store';
import { modelBuildAt, modelEstimates, modelLeadAt, modelStateAt, modelViewAt, modelsFor, modelsInChapter } from '@/lib/content';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Model3D } from '@/lib/types';
import { buildProcedural } from '@/lib/models';
import { CUBIT_M, FIGURE_M, formatMetres, MAP_FROM_M, scaleReference, type ScaleKind, type ScaleReference } from '@/lib/models/scale';
import { loadMap } from '@/lib/data';
import { formatRef, type VerseLoc } from '@/lib/refs';
import { cardId } from '@/lib/catalog';
import { IndexLink } from '@/components/IndexView';
import { activeParts, cutCentre, cutParts, cutPlane, cutsAt, framingAt, materialsOf, MODEL_FOV, partsShown, type CutHow } from '@/lib/models/view';

/**
 * A part fading and dropping into place after its verse is reached, or, when `leaving`, fading and
 * sinking out of sight when a later change removes it.
 */
interface Arrival { part: THREE.Object3D; t0: number; y0: number; drop: number; mats: THREE.Material[]; leaving?: boolean }
const ARRIVE_MS = 700, LEAVE_MS = 1100;
/** Parts drop a quarter of the model's height as they arrive, but no more than this (metres): the New Jerusalem is 2,220 km high. */
const DROP_MAX_M = 50;
/**
 * The camera easing to frame the parts shown so far. While a passage is building or changing the
 * model it also turns to that passage's angle (`modelViewAt`); elsewhere it keeps the angle it has.
 */
interface Framing { from: THREE.Vector3; to: THREE.Vector3; fromDist: number; toDist: number; turn: { from: THREE.Spherical; to: THREE.Spherical } | null; t0: number }
const FRAME_MS = 900;
/** The size reference fading out where it stood and back in beside what the camera now frames. */
interface Move { t0: number; p: THREE.Vector3; box: THREE.Box3; toward?: THREE.Vector3; placed: boolean }
const MOVE_OUT_MS = 300, MOVE_IN_MS = 450;

/**
 * Shows the parts of `object` drawn at `loc` (see `partsShown`) and hides the rest. Parts shown or
 * removed are queued in `arrivals` to animate in or out — only the outermost, so nested pieces
 * don't move twice. Returns whether anything was shown or hidden.
 */
function syncParts(m: Model3D, object: THREE.Object3D, loc: VerseLoc, stateId: string | null, arrivals: Arrival[] | null): boolean {
  const want = partsShown(m, object, loc, stateId);
  const drop = Math.min(new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y * 0.25, DROP_MAX_M / (m.scale?.metres ?? 1));
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

/** What the camera is aimed by besides the parts shown: the angle, and a step's `frame`. A change reframes. */
const aimKey = (m: Model3D, loc: VerseLoc, stateId: string | null) => JSON.stringify([modelViewAt(m, loc, stateId), activeParts(m, loc, stateId).step?.frame]);

/** Fades every material of the size reference; its materials are its own, so nothing else fades. */
function setOpacity(o: THREE.Object3D, opacity: number) {
  for (const mat of materialsOf(o)) { mat.transparent = opacity < 1; mat.opacity = opacity; }
}

/**
 * A material's own opacity and transparency, recorded the first time it fades in. Kept on the
 * material rather than the arrival, so an arrival that starts while another is mid-fade returns
 * to the true value, not a half-faded one.
 */
const restingLook = (mat: THREE.Material): { transparent: boolean; opacity: number } =>
  mat.userData.resting ??= { transparent: mat.transparent, opacity: mat.opacity };

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

function ModelView({ m, loc, readingId }: { m: Model3D; loc: VerseLoc; readingId?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const arrivals = useRef<Arrival[]>([]);
  const locRef = useRef(loc);
  locRef.current = loc;
  const frameRef = useRef<(animate: boolean) => void>(() => {});
  // The angle (and step `frame`) last framed at, so a move between steps that shows nothing new still moves the camera.
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
  const [scaleInfo, setScaleInfo] = useState<{ kind: ScaleKind; bar: string } | null>(null);
  const [showScale, setShowScale] = useState(true);
  const showScaleRef = useRef(showScale);
  showScaleRef.current = showScale;
  const referenceRef = useRef<ScaleReference | null>(null);
  useEffect(() => {
    const host = el.current;
    if (!host) return;
    // A logarithmic depth buffer, so a model thousands of kilometres across (the New Jerusalem) draws
    // cleanly while the camera stands a few metres from a figure at its gate.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
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
    const camera = new THREE.PerspectiveCamera(MODEL_FOV, host.clientWidth / host.clientHeight, 0.01, 100);
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
      const bar = ref.place(p, box, toward); setScaleInfo({ kind: ref.kind, bar }); // place first: it decides the kind
    };
    const stepReference = () => {
      const ref = referenceRef.current;
      if (!move || !ref) return;
      const now = performance.now();
      if (!move.placed) {
        const k = Math.min(1, (now - move.t0) / MOVE_OUT_MS);
        setOpacity(ref.group, 1 - k);
        if (k < 1) return;
        const bar = ref.place(move.p, move.box, move.toward); setScaleInfo({ kind: ref.kind, bar });
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
      viewRef.current = aimKey(m, locRef.current, stateRef.current);
      controls.autoRotate = !view;
      applyCuts();
      if (!o) return;
      const fromDir = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      fromDir.radius = 1;
      const ref = referenceRef.current, f = framingAt(m, o, locRef.current, stateRef.current, ref?.group.visible ? ref : null, fromDir);
      if (!f) return;
      if (ref && f.reference) moveReference(ref, f.reference.p, f.reference.local, f.reference.toward, animate);
      framing = { from: controls.target.clone(), to: f.target, fromDist: camera.position.distanceTo(controls.target), toDist: f.dist, turn: f.turning ? { from: fromDir, to: f.dir } : null, t0: animate ? performance.now() : -Infinity };
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
      // Far enough to take in the whole model from wherever the camera is, as close in as it frames.
      camera.near = d / 500; camera.far = Math.max(d * 10, (d + reach) * 2); camera.updateProjectionMatrix();
      if (k >= 1) framing = null;
    };
    // The cutaway (see `cutParts`): parts cut at the reader's choice use `cut`, which the Show outside /
    // Show inside button moves out of the way; parts cut at a step use `stepCut`.
    const cut = new THREE.Plane(), stepCut = new THREE.Plane();
    let centre: THREE.Vector3 | null = null, cuts: [THREE.Material, CutHow][] = [];
    let reach = 0; // the model's bounding radius
    const applyCuts = () => {
      const o = objectRef.current;
      if (!o || !cuts.length) return;
      for (const [mat, how] of cutsAt(m, o, cuts, locRef.current, stateRef.current)) {
        const want = how === null ? null : how === 'step' ? [stepCut] : [cut];
        if (mat.clippingPlanes?.[0] !== want?.[0]) { mat.clippingPlanes = want; mat.needsUpdate = true; }
      }
    };
    const stepCutaway = () => {
      if (!centre) return;
      stepCut.copy(cutPlane(centre, camera.position));
      if (cutawayRef.current) cut.copy(stepCut); else cut.set(new THREE.Vector3(0, 1, 0), 1e9);
    };
    let disposed = false;
    const place = (o: THREE.Object3D) => {
      if (disposed) { disposeObject(o); return; } // a glTF that finished loading after the view closed
      const reference = m.scale && scaleReference(m.scale, new THREE.Box3().setFromObject(o));
      scene.add(o); fit(o); objectRef.current = o;
      const box = new THREE.Box3().setFromObject(o);
      reach = box.getBoundingSphere(new THREE.Sphere()).radius;
      if (reference) {
        // A sibling of the model, not a part of it, moved by the same offset `fit` gave the model.
        reference.group.position.copy(o.position); reference.group.visible = showScaleRef.current;
        scene.add(reference.group); referenceRef.current = reference;
        // A model big enough for the map loads it, and the reference is placed afresh with it.
        if (Math.max(...box.getSize(new THREE.Vector3()).toArray()) * m.scale!.metres >= (m.scale!.map?.from ?? MAP_FROM_M)) {
          void Promise.all([loadMap(), import('@/lib/models/map')]).then(([data, { mapReference }]) => {
            if (disposed) return;
            // Close in (the camp of Israel), the map lies just under the ground, not 100 m down.
            reference.setMap(mapReference(data, m.scale!.metres, m.scale!.map ? { on: m.scale!.map.on, below: 1 } : {}));
            reference.group.userData.at = undefined;
            frameRef.current(false);
          }).catch(() => { /* no map data: the figure stays */ });
        }
      }
      cuts = cutParts(o); centre = cutCentre(o);
      // Only parts cut at the reader's choice get the button; step cuts follow the text.
      setHasCutaway(cuts.some(([, how]) => how === true));
      syncParts(m, o, locRef.current, stateRef.current, null);
      frameRef.current(false);
    };
    if (m.kind === 'procedural' && m.procedural) place(buildProcedural(m.procedural, readingId));
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
  }, [m, readingId]);
  useEffect(() => {
    if (!objectRef.current) return;
    const shown = syncParts(m, objectRef.current, loc, stateId, arrivals.current);
    if (shown || aimKey(m, loc, stateId) !== viewRef.current) frameRef.current(true);
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

/** One model's card. A model the text allows more than one reading of shows the first, with a button for each. */
function ModelCard({ m, loc }: { m: Model3D; loc: VerseLoc }) {
  const [readingId, setReadingId] = useState(m.readings?.[0]?.id);
  const estimates = modelEstimates(m, readingId);
  return (
    <div className="card" id={cardId({ kind: 'model', id: m.id })}>
      <h3><span style={{ flex: 1 }}>{m.title}</span><ConfidenceBadge c={m.confidence} /></h3>
      <div className="verses">{m.dimensions && <span className="badge kind">{m.dimensions}</span>}{m.verses.map((r) => <RefChip key={r} r={r} />)}</div>
      <ModelView m={m} loc={loc} readingId={readingId} />
      {!!m.readings?.length && <ModelReadings m={m} current={readingId} onPick={setReadingId} />}
      <BuildProgress m={m} loc={loc} estimates={estimates} />
      <p className="summary">{m.summary}</p>
      <Estimates estimates={estimates} />
      <MediaList media={m.media} />
      <SourceList sources={m.sources} traditions={m.traditions} />
    </div>
  );
}

/** Buttons for each reading of the text the model can be drawn as, and what the one shown rests on and who holds it. */
function ModelReadings({ m, current, onPick }: { m: Model3D; current?: string; onPick: (id: string) => void }) {
  const reading = m.readings?.find((r) => r.id === current);
  return (
    <div className="model-states">
      <div role="group" aria-label="Draw the model as one reading of the text">
        {m.readings!.map((r) => <button type="button" key={r.id} aria-pressed={r.id === current} onClick={() => onPick(r.id)}>{r.label}</button>)}
      </div>
      {reading && <p>{reading.basis}{!!reading.traditions?.length && <> Held by: {reading.traditions.join('; ')}.</>}</p>}
    </div>
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
function ScaleNote({ m, kind, bar }: { m: Model3D; kind: ScaleKind; bar: string }) {
  const unit = m.scale?.unit;
  return (
    <p className="scale-note">
      {kind === 'map' && m.scale?.map?.on
        ? <>Map: places round Jerusalem at the same scale, laid flat with {m.scale.map.on} at the model's centre, only to compare sizes; the model did not stand there. Distances and bearings are true (an azimuthal equidistant projection); nearer places are named as the camera closes in. Places from OpenBible.info. Where the text turns to a smaller part, the camera closes in and the figure stands there instead.</>
        : kind === 'map'
        ? <>Map: the coasts, rivers and cities round Jerusalem at the same scale, laid flat with Jerusalem under the middle of the model, only to compare sizes. Distances and bearings from Jerusalem are true (an azimuthal equidistant projection). Coasts, rivers and lakes from Natural Earth (public domain); cities from OpenBible.info. Where the text turns to a smaller part (the New Jerusalem's wall and gates), the camera closes in and the figure stands there instead.</>
        : kind === 'figure'
        ? <>Figure ≈ {formatMetres(FIGURE_M)}{unit && m.scale && <> (≈ {(FIGURE_M / m.scale.metres).toFixed(1)} {unit}s)</>}: the average height of a Judaean man in the first century, from skeletal remains (J. E. Taylor, <i>What Did Jesus Look Like?</i>, 2018).</>
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
function BuildProgress({ m, loc, estimates }: { m: Model3D; loc: VerseLoc; estimates: Record<string, string> }) {
  const at = modelBuildAt(m, loc);
  if (!at) return m.builds?.length ? <p className="build-progress">Builds as you read {m.builds.map((b) => formatRef(b.ref)).join(' or ')}.</p> : null;
  const step = at.build.steps[at.step - 1];
  const notes = step ? [step.basis, ...step.parts.map((p) => estimates[p] && `${partLabel(p)}: ${estimates[p]}`)].filter((n): n is string => !!n) : [];
  return (
    <p className="build-progress">
      Building from {formatRef(at.build.ref)}: step {at.step} of {at.build.steps.length}
      {!!step?.parts.length && <> ({step.parts.map(partLabel).join(', ')})</>}
      {notes.map((n) => <small key={n}>≈ {n}</small>)}
    </p>
  );
}

/** Every estimated part of the model and what it rests on, so the whole model is labelled too, not only a build's latest step. */
function Estimates({ estimates }: { estimates: Record<string, string> }) {
  const list = Object.entries(estimates);
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
  useFeatureInView();
  // When the text turns to another model (1 Kgs 7 moves from the temple to the House of the Forest of
  // Lebanon and back), bring its card into view. The cards keep their order, so nothing else moves; and
  // it jumps, as useFeatureInView does, since the reader's smooth scroll to the verse would cancel a glide.
  const lead = modelLeadAt(loc)?.id ?? null, shown = useRef(lead);
  useEffect(() => {
    if (lead && lead !== shown.current) document.getElementById(cardId({ kind: 'model', id: lead }))?.scrollIntoView({ block: 'start', behavior: 'instant' });
    shown.current = lead;
  }, [lead]);
  return (
    <div className="panel-body">
      {list.length === 0 && <div className="empty"><p>No models for this chapter yet.</p><IndexLink section="models" /><small>Register one in <code>content/models.json</code> — procedural (code) or glTF with attribution.</small></div>}
      {list.map((m) => <ModelCard key={m.id} m={m} loc={loc} />)}
    </div>
  );
}
