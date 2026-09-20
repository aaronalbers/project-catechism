import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '@/app/store';
import { modelsFor, modelsInChapter } from '@/lib/content';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Model3D } from '@/lib/types';
import { buildProcedural } from '@/lib/procedural';

function ModelView({ m }: { m: Model3D }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    let object: THREE.Object3D | null = null;
    const fit = (o: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      o.position.sub(center);
      camera.position.set(0, size * 0.5, size * 1.6);
      controls.target.set(0, 0, 0);
    };
    if (m.kind === 'procedural' && m.procedural) { object = buildProcedural(m.procedural); scene.add(object); fit(object); }
    else if (m.kind === 'gltf' && m.src) {
      new GLTFLoader().load(`${import.meta.env.BASE_URL}${m.src}`, (g) => { object = g.scene; scene.add(object); fit(object); });
    }
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); });
    ro.observe(host);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, [m]);
  return <div className="model-view" ref={el}><span className="hint">drag to rotate · scroll to zoom</span></div>;
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
          <ModelView m={m} />
          <p className="summary">{m.summary}</p>
          <MediaList media={m.media} />
          <SourceList sources={m.sources} />
        </div>
      ))}
    </div>
  );
}
