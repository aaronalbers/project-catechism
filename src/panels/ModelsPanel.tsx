import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '@/app/store';
import { modelBuildAt, modelsFor, modelsInChapter } from '@/lib/content';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Model3D } from '@/lib/types';
import { buildProcedural } from '@/lib/procedural';
import { formatRef, type VerseLoc } from '@/lib/refs';

/** A part fading and dropping into place after its verse is reached; `mats` holds each material's own opacity to return to. */
interface Arrival { part: THREE.Object3D; t0: number; y0: number; drop: number; mats: { mat: THREE.Material; transparent: boolean; opacity: number }[] }
const ARRIVE_MS = 700;
/** The camera easing to frame the parts shown so far, keeping the angle the viewer chose. */
interface Framing { from: THREE.Vector3; to: THREE.Vector3; fromDist: number; toDist: number; t0: number }
const FRAME_MS = 900;

/**
 * Shows the parts of `object` the text has described by `loc` (every part outside a build). A
 * part is any named node, and parts nest: naming a part in a step shows everything inside it,
 * and a part stays visible while anything inside it is shown. Newly shown parts are queued in
 * `arrivals` to animate in — only the outermost, so nested pieces don't drop twice. Returns
 * whether anything was shown or hidden.
 */
function syncParts(m: Model3D, object: THREE.Object3D, loc: VerseLoc, arrivals: Arrival[] | null): boolean {
  const at = modelBuildAt(m, loc);
  const want = new Map<THREE.Object3D, boolean>();
  const decide = (node: THREE.Object3D, inherited: boolean): boolean => {
    const self = inherited || (!!node.name && at!.parts.has(node.name));
    let any = self;
    for (const c of node.children) if (decide(c, self)) any = true;
    if (node.name) want.set(node, any);
    return any;
  };
  for (const c of object.children) decide(c, !at);
  const drop = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y * 0.25;
  let changed = false;
  const apply = (node: THREE.Object3D, parentArriving: boolean) => {
    let arriving = parentArriving;
    const show = want.get(node);
    if (show !== undefined) {
      const appearing = show && !node.visible;
      if (appearing && arrivals && !parentArriving && !arrivals.some((a) => a.part === node)) {
        const mats = new Set(materialsOf(node));
        arrivals.push({ part: node, t0: performance.now(), y0: node.position.y, drop, mats: [...mats].map((mat) => ({ mat, transparent: mat.transparent, opacity: mat.opacity })) });
      }
      arriving ||= appearing;
      if (node.visible !== show) changed = true;
      node.visible = show;
    }
    for (const c of node.children) apply(c, arriving);
  };
  for (const c of object.children) apply(c, false);
  return changed;
}

/**
 * What the camera should frame at `loc`: during a build, the objects the latest step is working
 * on — each named part's nearest ancestor flagged `userData.focus`, or the whole model if it has
 * none — so a new piece of furniture fills the view rather than the whole site. Otherwise, all
 * that is shown.
 */
function focusBox(m: Model3D, object: THREE.Object3D, loc: VerseLoc) {
  const at = modelBuildAt(m, loc);
  const step = at?.build.steps[at.step - 1];
  if (!step) return visibleBox(object);
  const b = new THREE.Box3();
  for (const name of step.parts) {
    let n: THREE.Object3D | null | undefined = object.getObjectByName(name);
    while (n && n !== object && !n.userData.focus) n = n.parent;
    b.union(visibleBox(n ?? object));
  }
  return b;
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

const materialsOf = (o: THREE.Object3D) => {
  const out: THREE.Material[] = [];
  o.traverse((x) => { const mt = (x as THREE.Mesh).material; if (mt) out.push(...(Array.isArray(mt) ? mt : [mt])); });
  return out;
};

function animateArrivals(arrivals: Arrival[]) {
  const now = performance.now();
  for (let i = arrivals.length - 1; i >= 0; i--) {
    const { part, t0, y0, drop, mats } = arrivals[i];
    const k = Math.min(1, (now - t0) / ARRIVE_MS), ease = 1 - (1 - k) ** 3;
    part.position.y = y0 + (1 - ease) * drop;
    for (const x of mats) { x.mat.transparent = k < 1 || x.transparent; x.mat.opacity = x.opacity * ease; }
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
  // Models whose parts are flagged `cutaway` (the tabernacle's tent) can be opened to show what is inside.
  const [hasCutaway, setHasCutaway] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const cutawayRef = useRef(cutaway);
  cutawayRef.current = cutaway;
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
    frameRef.current = (animate) => {
      const o = objectRef.current;
      const b = o && focusBox(m, o, locRef.current);
      if (!b || b.isEmpty()) return;
      const toDist = Math.max(b.getSize(new THREE.Vector3()).length() * 1.5, 0.3);
      framing = { from: controls.target.clone(), to: b.getCenter(new THREE.Vector3()), fromDist: camera.position.distanceTo(controls.target), toDist, t0: animate ? performance.now() : -Infinity };
    };
    const stepFraming = () => {
      if (!framing) return;
      const k = Math.min(1, (performance.now() - framing.t0) / FRAME_MS), ease = 1 - (1 - k) ** 3;
      const dir = camera.position.clone().sub(controls.target).normalize();
      controls.target.lerpVectors(framing.from, framing.to, ease);
      const d = framing.fromDist + (framing.toDist - framing.fromDist) * ease;
      camera.position.copy(controls.target).addScaledVector(dir, d);
      camera.near = d / 500; camera.far = d * 10; camera.updateProjectionMatrix();
      if (k >= 1) framing = null;
    };
    // The cutaway is a lengthwise section: a vertical plane down the tent's long (x) axis that drops
    // whichever long side faces the camera, so the inside stays open from any angle.
    const cut = new THREE.Plane();
    let cutCenter: THREE.Vector3 | null = null;
    const stepCutaway = () => {
      if (!cutCenter) return;
      if (!cutawayRef.current) { cut.set(new THREE.Vector3(0, 1, 0), 1e9); return; }
      cut.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, camera.position.z > cutCenter.z ? -1 : 1), cutCenter);
    };
    const place = (o: THREE.Object3D) => {
      scene.add(o); fit(o); objectRef.current = o;
      const tent = o.children.filter((p) => p.userData.cutaway);
      if (tent.length) {
        cutCenter = boxOf(tent).getCenter(new THREE.Vector3());
        for (const p of tent) for (const mat of materialsOf(p)) mat.clippingPlanes = [cut];
        setHasCutaway(true);
      }
      syncParts(m, o, locRef.current, null);
      frameRef.current(false);
    };
    if (m.kind === 'procedural' && m.procedural) place(buildProcedural(m.procedural));
    else if (m.kind === 'gltf' && m.src) new GLTFLoader().load(`${import.meta.env.BASE_URL}${m.src}`, (g) => place(g.scene));
    let raf = 0;
    const loop = () => { animateArrivals(arrivals.current); stepFraming(); controls.update(); stepCutaway(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); });
    ro.observe(host);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); objectRef.current = null; arrivals.current = []; };
  }, [m]);
  useEffect(() => {
    if (objectRef.current && syncParts(m, objectRef.current, loc, arrivals.current)) frameRef.current(true);
  }, [m, loc]);
  return (
    <div className="model-view" ref={el}>
      {hasCutaway && <button type="button" className="cutaway-toggle" onClick={() => setCutaway((c) => !c)}>{cutaway ? 'Show outside' : 'Show inside'}</button>}
      <span className="hint">drag to rotate · scroll to zoom</span>
    </div>
  );
}

/** Where the reader is in a build: the passage, how many steps are done, and the latest step's basis if it is estimated. */
function BuildProgress({ m, loc }: { m: Model3D; loc: VerseLoc }) {
  const at = modelBuildAt(m, loc);
  if (!at) return m.builds?.length ? <p className="build-progress">Builds as you read {m.builds.map((b) => formatRef(b.ref)).join(' or ')}.</p> : null;
  const step = at.build.steps[at.step - 1];
  return (
    <p className="build-progress">
      Building from {formatRef(at.build.ref)}: step {at.step} of {at.build.steps.length}
      {step && <> ({step.parts.join(', ').replace(/-/g, ' ')})</>}
      {step?.basis && <small>≈ {step.basis}</small>}
    </p>
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
          <MediaList media={m.media} />
          <SourceList sources={m.sources} />
        </div>
      ))}
    </div>
  );
}
