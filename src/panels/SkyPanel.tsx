// The Sky tab: the sky a reading of the star of the Magi points to, drawn as astronomy-engine computes it for the
// place and hour. Each reading's moments stand at verses, so reading Matthew 2 moves the sky with the text.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { follow, useStore } from '@/app/store';
import { SKY_READINGS, skyEventsFor } from '@/lib/content';
import { loadPlaces, loadSky } from '@/lib/data';
import { formatRef } from '@/lib/refs';
import {
  altAz, bearing, bodyEqj, closest, deltaTHours, eqjOf, formatUt, horizonRotation, magnitude, moonLit, observer, occultation, PLANETS,
  starEqj, station, sunAltitude, toHorizon, utOf,
} from '@/lib/sky';
import type { Place, SkyData, SkyEvent, SkyReading } from '@/lib/types';
import { ConfidenceBadge, SourceList } from '@/components/SourceList';

const RAD = Math.PI / 180;
/** Stars and planets sit on a sphere this far out; the ground is a hemisphere inside it, so it hides what has set. */
const SKY_R = 9, GROUND_R = 5;
const DAY = 1, HOUR = 1 / 24;

/** Horizon coordinates (x north, y west, z up) to the scene's (x east, y up, z south), on the sky sphere. */
const scenePos = (h: [number, number, number], r = SKY_R) => new THREE.Vector3(-h[1] * r, h[2] * r, -h[0] * r);
const dirOf = (az: number, alt: number) => new THREE.Vector3(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD));

/** A star's colour from its B−V index, from blue-white through white to orange. */
function starColour(bv: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [[-0.3, [0.66, 0.76, 1]], [0, [0.85, 0.9, 1]], [0.6, [1, 0.98, 0.9]], [1.0, [1, 0.88, 0.7]], [1.6, [1, 0.72, 0.5]]];
  if (bv <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (bv <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (bv - a) / (b - a);
    return [0, 1, 2].map((k) => ca[k] + (cb[k] - ca[k]) * t) as [number, number, number];
  }
  return stops[stops.length - 1][1];
}
const PLANET_COLOUR: Record<string, string> = { Mercury: '#c9c2b8', Venus: '#fffbe8', Mars: '#ff9a6a', Jupiter: '#ffe9c4', Saturn: '#f2d58c' };

/** The faintest magnitude seen with the Sun at `alt`: about 6.5 in full dark, fewer stars through twilight, only Venus by day. */
const limitMag = (sunAlt: number) => -4 + 10.5 * Math.min(1, Math.max(0, -sunAlt / 15));
function skyColour(sunAlt: number) {
  const night = new THREE.Color('#04060f'), dusk = new THREE.Color('#1d2f57'), day = new THREE.Color('#5d8fcf');
  if (sunAlt <= -18) return night;
  if (sunAlt <= -4) return night.clone().lerp(dusk, (sunAlt + 18) / 14);
  return dusk.clone().lerp(day, Math.min(1, (sunAlt + 4) / 8));
}
const dark = (sunAlt: number) => (sunAlt < -18 ? 'night' : sunAlt < -12 ? 'astronomical twilight' : sunAlt < -6 ? 'nautical twilight' : sunAlt < 0 ? 'civil twilight' : 'day');

const STAR_VERT = `
attribute float size; attribute vec3 colour; attribute float mag;
uniform float limit; uniform float scale;
varying vec3 vColour; varying float vAlpha;
void main() {
  vColour = colour;
  float over = limit - mag;
  vAlpha = clamp(over / 2.5, 0.0, 1.0);
  gl_PointSize = over > 0.0 ? size * scale : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const STAR_FRAG = `
varying vec3 vColour; varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColour, a);
}`;

/** A disc lit by fraction `lit` from its right-hand side, for the Moon (the sprite turns it toward the Sun). */
function moonTexture(lit: number) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, r = 60;
  g.translate(64, 64);
  g.fillStyle = 'rgba(70,76,96,0.85)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4f1e6'; g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); // the lit limb, on the right
  // The terminator as an ellipse whose half-width is r·(1 − 2·lit): bulging right when a crescent, left when gibbous.
  const k = 1 - 2 * lit;
  g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture(colour: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, colour); grad.addColorStop(0.25, colour); grad.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

interface Label { el: HTMLSpanElement; at: THREE.Vector3; kind: string; w?: number; h?: number; mag?: number }
/** Which labels win where two would overlap. */
const PRIORITY: Record<string, number> = { planet: 0, toward: 1, compass: 1, star: 2, mark: 3, constellation: 4 };

/** The moment's view: where the camera looks and when. */
interface ViewState { ut: number; az: number; alt: number; fov: number; daylight: boolean; ground: boolean }

function initialView(e: SkyEvent, place: Place, sky: SkyData): ViewState {
  const ut = utOf(e.when, place.lon), obs = observer(place);
  const look = typeof e.look === 'string' ? altAz(toHorizon(horizonRotation(ut, obs), eqjOf(e.look, ut, obs, sky))) : { az: e.look[0], alt: e.look[1] };
  return { ut, az: look.az, alt: Math.max(5, Math.min(80, look.alt)), fov: e.fov ?? 70, daylight: !e.dark, ground: true };
}

function SkyView({ sky, event, place, toward }: { sky: SkyData; event: SkyEvent; place: Place; toward?: Place }) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => initialView(event, place, sky));
  const [playing, setPlaying] = useState(false);
  const live = useRef(view);
  live.current = view;
  // A new moment resets the view.
  useEffect(() => { setView(initialView(event, place, sky)); setPlaying(false); }, [event, place, sky]);
  // Playing steps a day at a time at the same hour, so the sky stays put and the planets move through the stars.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setView((v) => ({ ...v, ut: v.ut + DAY })), 120);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 50);
    const labels = document.createElement('div'); labels.className = 'sky-labels'; el.appendChild(labels);
    const obs = observer(place);

    // Stars: positions are rewritten whenever the time changes.
    const n = sky.stars.length;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(n * 3), colours = new Float32Array(n * 3), sizes = new Float32Array(n), mags = new Float32Array(n);
    sky.stars.forEach((s, i) => {
      const c = starColour(s[3]); colours.set(c, i * 3);
      sizes[i] = Math.max(1.2, Math.min(9, 1.4 + (6.5 - s[2]) * 1.05)); mags[i] = s[2];
    });
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('colour', new THREE.BufferAttribute(colours, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('mag', new THREE.BufferAttribute(mags, 1));
    const starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { limit: { value: 6.5 }, scale: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(starGeo, starMat));

    // Constellation lines, as pairs of star positions.
    const pairs: [number, number][] = Object.values(sky.lines).flatMap((runs) => runs.flatMap((run) => run.slice(1).map((b, k) => [run[k], b] as [number, number])));
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(pairs.length * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: '#5a7bb5', transparent: true, opacity: 0.45, depthWrite: false });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    // Planets, with their sizes from their magnitudes; the Sun and the Moon as sprites.
    const planetGeo = new THREE.BufferGeometry();
    const planetPos = new Float32Array(PLANETS.length * 3), planetSize = new Float32Array(PLANETS.length), planetMag = new Float32Array(PLANETS.length);
    const planetCol = new Float32Array(PLANETS.flatMap((p) => new THREE.Color(PLANET_COLOUR[p]).toArray()));
    planetGeo.setAttribute('position', new THREE.BufferAttribute(planetPos, 3));
    planetGeo.setAttribute('colour', new THREE.BufferAttribute(planetCol, 3));
    planetGeo.setAttribute('size', new THREE.BufferAttribute(planetSize, 1));
    planetGeo.setAttribute('mag', new THREE.BufferAttribute(planetMag, 1));
    const planetMat = starMat.clone();
    const planets = new THREE.Points(planetGeo, planetMat);
    scene.add(planets);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#fff6d8'), depthWrite: false, transparent: true }));
    // The Moon writes depth (and drops the clear corners of its square), so it hides the stars and planets it passes in front of.
    const moonMat = new THREE.SpriteMaterial({ depthWrite: true, transparent: true, alphaTest: 0.5 });
    const moon = new THREE.Sprite(moonMat);
    scene.add(sun, moon);

    // The ground, a little lighter than the night sky, and the horizon line on it.
    const ground = new THREE.Mesh(new THREE.SphereGeometry(GROUND_R, 64, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#141a14', side: THREE.BackSide, transparent: true }));
    scene.add(ground);
    const ring = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 181 }, (_, i) => dirOf(i * 2, 0).multiplyScalar(GROUND_R * 0.999)));
    scene.add(new THREE.Line(ring, new THREE.LineBasicMaterial({ color: '#4d5a45' })));

    // The bearing of another place, as a line up from the horizon (Bethlehem from Jerusalem).
    let towardAz: number | null = null;
    if (toward) {
      towardAz = bearing(place, toward);
      const up = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 46 }, (_, i) => dirOf(towardAz!, i * 2).multiplyScalar(SKY_R * 0.99)));
      const dash = new THREE.Line(up, new THREE.LineDashedMaterial({ color: '#c99a4a', dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.7 }));
      dash.computeLineDistances();
      scene.add(dash);
    }

    // A body's path among the stars: its J2000 positions day by day, turned with the stars at the time shown.
    // The first body's path is the one the marks stand on; any `with` it are drawn beside it, fainter.
    const track = event.track;
    const paths = track ? [track.body, ...(track.with ?? [])].map((body, k) => {
      const pts: { ut: number; v: [number, number, number] }[] = [];
      for (let t = utOf(track.from, place.lon); t <= utOf(track.to, place.lon); t += track.every ?? 1) pts.push({ ut: t, v: bodyEqj(body, t, obs) });
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(pts.length * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const colour = k === 0 ? '#e6b85c' : '#9fb4d8', opacity = k === 0 ? 0.8 : 0.6;
      scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false })));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: colour, size: 3, sizeAttenuation: false, transparent: true, opacity, depthWrite: false })));
      return { pts, geo, pos };
    }) : [];
    const trackEqj = paths[0]?.pts ?? [];

    // Labels: planets and named stars, constellations, the compass points, the place a line points to, the track's marks.
    const all: Label[] = [];
    const label = (text: string, kind: string) => { const s = document.createElement('span'); s.className = `sky-label ${kind}`; s.textContent = text; labels.appendChild(s); const l: Label = { el: s, at: new THREE.Vector3(), kind }; all.push(l); return l; };
    const starLabels = Object.entries(sky.names).map(([i, name]) => { const l = label(name, 'star'); l.mag = sky.stars[Number(i)][2]; return { i: Number(i), l }; });
    const conLabels = sky.labels.map(([name, ra, dec]) => ({ v: [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)] as [number, number, number], l: label(name, 'constellation') }));
    const planetLabels = PLANETS.map((p) => label(p, 'planet'));
    const sunLabel = label('Sun', 'planet'), moonLabel = label('Moon', 'planet');
    for (const [text, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) label(text, 'compass').at.copy(dirOf(az, 0).multiplyScalar(GROUND_R));
    if (toward && towardAz !== null) label(`${toward.name} ↓`, 'toward').at.copy(dirOf(towardAz, 3).multiplyScalar(SKY_R));
    const markLabels = (track?.marks ?? []).map((m) => ({ ut: utOf(m.on, place.lon), l: label(m.text, 'mark') }));
    all.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);

    let lastUt = NaN, lastDaylight: boolean | null = null, lastGround: boolean | null = null, lastLit = -1, limit = 6.5;
    /** Puts everything where it stands at the view's time. */
    function place_(v: ViewState) {
      const rot = horizonRotation(v.ut, obs);
      const at = (e: [number, number, number], r = SKY_R) => scenePos(toHorizon(rot, e), r);
      sky.stars.forEach((s, i) => { const p = at(starEqj(s, v.ut)); starPos[i * 3] = p.x; starPos[i * 3 + 1] = p.y; starPos[i * 3 + 2] = p.z; });
      starGeo.attributes.position.needsUpdate = true;
      pairs.forEach(([a, b], k) => { linePos.set(starPos.subarray(a * 3, a * 3 + 3), k * 6); linePos.set(starPos.subarray(b * 3, b * 3 + 3), k * 6 + 3); });
      lineGeo.attributes.position.needsUpdate = true;
      for (const { i, l } of starLabels) l.at.set(starPos[i * 3], starPos[i * 3 + 1], starPos[i * 3 + 2]);
      for (const { v: e, l } of conLabels) l.at.copy(at(e));
      PLANETS.forEach((p, i) => {
        const pos = at(bodyEqj(p, v.ut, obs)); planetPos.set([pos.x, pos.y, pos.z], i * 3);
        const m = magnitude(p, v.ut); planetMag[i] = m; planetSize[i] = Math.max(3.5, Math.min(12, 5 + (1 - m) * 1.4));
        planetLabels[i].at.copy(pos); planetLabels[i].mag = m;
      });
      planetGeo.attributes.position.needsUpdate = true; planetGeo.attributes.size.needsUpdate = true; planetGeo.attributes.mag.needsUpdate = true;
      const sunV = bodyEqj('Sun', v.ut, obs), moonV = bodyEqj('Moon', v.ut, obs);
      sun.position.copy(at(sunV, SKY_R * 0.98)); sunLabel.at.copy(sun.position);
      moon.position.copy(at(moonV, SKY_R * 0.97)); moonLabel.at.copy(moon.position);
      const lit = Math.round(moonLit(v.ut) * 50) / 50;
      if (lit !== lastLit) { moonMat.map?.dispose(); moonMat.map = moonTexture(lit); moonMat.needsUpdate = true; lastLit = lit; }
      (moon.userData as { sunward: THREE.Vector3 }).sunward = at([moonV[0] + (sunV[0] - moonV[0]) * 0.01, moonV[1] + (sunV[1] - moonV[1]) * 0.01, moonV[2] + (sunV[2] - moonV[2]) * 0.01], SKY_R * 0.97);
      for (const path of paths) {
        path.pts.forEach((p, i) => { const q = at(p.v, SKY_R * 0.995); path.pos.set([q.x, q.y, q.z], i * 3); });
        path.geo.attributes.position.needsUpdate = true;
      }
      for (const m of markLabels) {
        const p = trackEqj.reduce((a, b) => (Math.abs(b.ut - m.ut) < Math.abs(a.ut - m.ut) ? b : a));
        m.l.at.copy(at(p.v));
      }
      const sunAlt = altAz(toHorizon(rot, sunV)).alt;
      const lim = v.daylight ? limitMag(sunAlt) : 6.5;
      starMat.uniforms.limit.value = lim; planetMat.uniforms.limit.value = Math.max(lim, -3.5);
      scene.background = v.daylight ? skyColour(sunAlt) : skyColour(-90);
      limit = lim;
      (ground.material as THREE.MeshBasicMaterial).opacity = v.ground ? 1 : 0.35;
      lastUt = v.ut; lastDaylight = v.daylight; lastGround = v.ground;
    }

    const size = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size();
    const ro = new ResizeObserver(size); ro.observe(el);

    const v3 = new THREE.Vector3();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const v = live.current;
      if (v.ut !== lastUt || v.daylight !== lastDaylight || v.ground !== lastGround) place_(v);
      camera.fov = v.fov; camera.updateProjectionMatrix();
      camera.position.set(0, 0, 0); camera.up.set(0, 1, 0); camera.lookAt(dirOf(v.az, v.alt));
      const h = el.clientHeight, w = el.clientWidth;
      starMat.uniforms.scale.value = planetMat.uniforms.scale.value = Math.min(1.6, Math.max(0.8, Math.sqrt(60 / v.fov))) * renderer.getPixelRatio();
      // Sun and Moon: their true size, but never smaller than a few pixels; the Moon's lit side toward the Sun.
      const perPx = (2 * SKY_R * Math.tan((v.fov * RAD) / 2)) / h;
      const disc = (deg: number, minPx: number) => Math.max(2 * SKY_R * Math.tan((deg * RAD) / 2), minPx * perPx);
      // The Moon is drawn at least 26 pixels across, so a crescent's shape shows.
      sun.scale.setScalar(disc(0.53, 18) * 2.2); moon.scale.setScalar(disc(0.52, 26));
      const sw = (moon.userData as { sunward?: THREE.Vector3 }).sunward;
      if (sw) {
        const a = moon.position.clone().project(camera), b = sw.clone().project(camera);
        moonMat.rotation = Math.atan2((b.y - a.y) / h, (b.x - a.x) / w);
      }
      renderer.render(scene, camera);
      // Labels in order of priority, each left out where it would overlap one already placed.
      const placed: [number, number, number, number][] = [];
      for (const l of all) {
        v3.copy(l.at).project(camera);
        // Below the horizon only while the ground is drawn see-through; a star's name only while the star itself shows.
        const below = l.kind !== 'compass' && l.kind !== 'toward' && l.at.y < 0 && v.ground;
        const faint = l.mag !== undefined && l.mag > Math.max(limit, l.kind === 'planet' ? -3.5 : -Infinity);
        let off = v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1 || below || faint || (l.kind === 'constellation' && v.fov > 100);
        const x = ((v3.x + 1) / 2) * w, y = ((1 - v3.y) / 2) * h;
        if (!off) {
          if (l.w === undefined) { l.el.style.display = ''; l.w = l.el.offsetWidth + 6; l.h = l.el.offsetHeight + 4; }
          const centred = l.kind === 'constellation' || l.kind === 'compass' || l.kind === 'toward';
          const box: [number, number, number, number] = centred ? [x - l.w / 2, y - l.h!, x + l.w / 2, y] : [x, y, x + l.w, y + l.h!];
          off = placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
          if (!off) placed.push(box);
        }
        l.el.style.display = off ? 'none' : '';
        if (!off) l.el.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    frame();

    // Drag to look round, wheel or pinch to zoom.
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const k = live.current.fov / el.clientHeight;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, az: (v.az - dx * k + 360) % 360, alt: Math.max(-20, Math.min(89.5, v.alt + dy * k)) }));
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); setView((v) => ({ ...v, fov: Math.max(4, Math.min(120, v.fov * Math.exp(e.deltaY * 0.0012))) })); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of [m.material].flat()) if (mat) { (mat as THREE.SpriteMaterial).map?.dispose(); mat.dispose(); }
      });
      renderer.dispose(); renderer.forceContextLoss();
      el.removeChild(renderer.domElement); el.removeChild(labels);
    };
  }, [sky, event, place, toward]);

  const obs = useMemo(() => observer(place), [place]);
  const sunAlt = sunAltitude(view.ut, obs);
  const step = (d: number) => setView((v) => ({ ...v, ut: v.ut + d }));
  return (
    <div className="sky-view" ref={host}>
      <div className="sky-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => step(-DAY)} title="A day earlier">−1 d</button>
        <button onClick={() => step(-HOUR)} title="An hour earlier">−1 h</button>
        <button onClick={() => step(HOUR)} title="An hour later">+1 h</button>
        <button onClick={() => step(DAY)} title="A day later">+1 d</button>
        <button onClick={() => setPlaying((p) => !p)} aria-pressed={playing} title="Step a day at a time at this hour, so the planets move through the stars">{playing ? 'Stop' : 'Days ▶'}</button>
        <button onClick={() => { setPlaying(false); setView(initialView(event, place, sky)); }} title="Back to the moment the reading names">Reset</button>
        <button onClick={() => setView((v) => ({ ...v, daylight: !v.daylight }))} aria-pressed={!view.daylight} title="Draw the stars as though the sky were dark, whatever the Sun">Stars by day</button>
        <button onClick={() => setView((v) => ({ ...v, ground: !v.ground }))} aria-pressed={!view.ground} title="See through the ground to what has set or not yet risen">Through the ground</button>
      </div>
      <div className="sky-readout">
        <span>{formatUt(view.ut, place.lon)} local mean time, {place.name} · Sun {sunAlt.toFixed(0)}°, {dark(sunAlt)}</span>
        <span className="hint">Drag to look round · scroll to zoom</span>
      </div>
    </div>
  );
}

/** What astronomy-engine computes for an event's claims, beside the reading's own dates. */
function Computed({ e, sky, place }: { e: SkyEvent; sky: SkyData; place: Place }) {
  const rows = useMemo(() => (e.checks ?? []).map((c) => {
    const on = utOf(c.on);
    if (c.kind === 'conjunction') {
      const hit = closest(c.a, c.b, on, c.within, sky);
      const sep = hit.deg < 1 ? `${(hit.deg * 60).toFixed(1)}′` : `${hit.deg.toFixed(2)}°`;
      return `${c.a} and ${c.b} closest on ${formatUt(hit.ut, place.lon, false)}, ${sep} apart.`;
    }
    if (c.kind === 'occultation') {
      const o = occultation(c.body, utOf(c.on, place.lon), observer(place));
      const hm = (ut: number) => formatUt(ut, place.lon).split(', ')[1];
      return o ? `Seen from ${place.name}, the Moon covers ${c.body} from ${hm(o.from)} to ${hm(o.to)} local mean time on ${formatUt(o.from, place.lon, false)}.` : `The Moon does not cover ${c.body} from ${place.name} that day.`;
    }
    const s = station(c.body, on, c.within);
    return s ? `${c.body} turns ${s.to} (in ecliptic longitude) on ${formatUt(s.ut, place.lon, false)}.` : `${c.body} does not turn within ${c.within} days.`;
  }), [e, sky, place]);
  if (!rows.length) return null;
  return (
    <div className="sky-computed">
      <h4>Computed</h4>
      <ul>{rows.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

function ReadingCard({ r, here, picked, onPick }: { r: SkyReading; here: SkyEvent | undefined; picked: SkyEvent | undefined; onPick: (e: SkyEvent) => void }) {
  return (
    <div className="card">
      <h3><span style={{ flex: 1 }}>{r.label}</span><ConfidenceBadge c={r.confidence} /></h3>
      <p className="summary">{r.summary}</p>
      {r.body && <div className="body">{r.body.map((p) => <p key={p}>{p}</p>)}</div>}
      {r.events.length > 0 && <div className="sky-moments" role="group" aria-label="Moments">
        {r.events.map((e) => (
          <button key={e.id} aria-pressed={e === picked} className={e === here ? 'here' : undefined} onClick={() => { onPick(e); follow(e.ref); }}>
            <b>{formatRef(e.ref)}</b> {e.title}
          </button>
        ))}
      </div>}
      <SourceList sources={r.sources} traditions={r.traditions} />
    </div>
  );
}

export function SkyPanel() {
  const loc = useStore((s) => s.loc);
  const [readingId, setReadingId] = useState(SKY_READINGS[0].id);
  const reading = SKY_READINGS.find((r) => r.id === readingId) ?? SKY_READINGS[0];
  const here = skyEventsFor(loc, reading)[0];
  const [pickedId, setPickedId] = useState<string | null>(here?.id ?? null);
  // Reading on to a moment's verse shows that moment.
  useEffect(() => { if (here) setPickedId(here.id); }, [here]);
  const event: SkyEvent | undefined = reading.events.find((e) => e.id === pickedId) ?? here ?? reading.events[0];

  const [sky, setSky] = useState<SkyData | null>(null);
  const [places, setPlaces] = useState<Map<string, Place> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadSky().then(setSky, () => setFailed(true));
    loadPlaces().then((ps) => setPlaces(new Map(ps.map((p) => [p.slug, p]))), () => setFailed(true));
  }, []);
  const place = event && places?.get(event.place), toward = event?.toward ? places?.get(event.toward) : undefined;

  return (
    <div className="panel-body">
      {SKY_READINGS.length > 1 && (
        <div className="reign-modes" role="group" aria-label="Reading">
          {SKY_READINGS.map((r) => <button key={r.id} aria-pressed={r === reading} onClick={() => { setReadingId(r.id); setPickedId(null); }}>{r.label}</button>)}
        </div>
      )}
      <ReadingCard r={reading} here={here} picked={event} onPick={(e) => setPickedId(e.id)} />
      {failed && <div className="empty"><p>The sky data has not been built. Run <code>npm run data</code>.</p></div>}
      {sky && place && event && (
        <div className="card">
          <h3><span style={{ flex: 1 }}>{event.title}</span></h3>
          <p className="muted">{event.estimated ? '≈ ' : ''}{formatUt(utOf(event.when, place.lon), place.lon)} local mean time, seen from {place.name} · {formatRef(event.ref)}</p>
          <SkyView sky={sky} event={event} place={place} toward={toward} />
          <p className="body">{event.text}</p>
          {event.basis && <p className="sky-basis">{event.estimated ? '≈ ' : ''}{event.basis}</p>}
          <Computed e={event} sky={sky} place={place} />
          <SourceList sources={event.sources} />
        </div>
      )}
      {event && <p className="sky-note">
        Positions are astronomy-engine’s, for the Julian-calendar date and local mean time shown, without refraction. The
        Earth’s spin has slowed unevenly, and the correction for it (ΔT, ≈{deltaTHours(utOf(event.when)).toFixed(1)} hours here, from
        Espenak and Meeus’s model) is itself uncertain, so an hour or an altitude is ≈; the dates of conjunctions and
        stations do not depend on it. Stars from the Yale Bright Star Catalogue, moved by their proper motions; constellation
        lines from d3-celestial (Olaf Frohn, BSD licence).
      </p>}
    </div>
  );
}
