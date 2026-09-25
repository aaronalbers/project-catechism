// The size reference for a model tens of kilometres across or more: the coasts, rivers, lakes and
// cities round Jerusalem at the model's scale, laid flat on the ground. Built from public/data/map.json,
// which the viewer loads only for such a model.
import * as THREE from 'three';
import type { MapData } from '@/lib/types';

const EARTH_KM = 6371;

/**
 * Metres east (x) and south (z) of `centre` on an azimuthal equidistant projection: distance and
 * bearing from the centre are true, so a model set down on Jerusalem measures true against the map.
 */
export function project([lon0, lat0]: [number, number], lon: number, lat: number): [number, number] {
  const r = Math.PI / 180, p0 = lat0 * r, p = lat * r, dl = (lon - lon0) * r;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl), c = Math.acos(Math.min(1, Math.max(-1, cosc)));
  const k = c === 0 ? 1 : c / Math.sin(c), m = EARTH_KM * 1000 * k;
  return [m * Math.cos(p) * Math.sin(dl), -m * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl))];
}

/** A city's name, drawn at a fixed size on screen; null without a DOM (the tests). */
function label(name: string): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  if (!ctx) return null;
  const px = 44;
  ctx.font = `600 ${px}px system-ui, sans-serif`;
  c.width = Math.ceil(ctx.measureText(name).width) + 16; c.height = px + 16;
  ctx.font = `600 ${px}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,18,16,0.85)'; ctx.strokeText(name, 8, c.height / 2);
  ctx.fillStyle = '#efe7d6'; ctx.fillText(name, 8, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
  const h = 0.03; s.scale.set(h * c.width / c.height, h, 1); s.center.set(-0.08, 0.5);
  s.renderOrder = 10; // after the model's glass, which would otherwise tint the label's box
  return s;
}

/**
 * The map in model units (`u` metres each), Jerusalem at the origin, north towards −z, lying just
 * below y = 0 so it shows through a model standing on the ground rather than fighting its floor.
 */
export function mapReference(data: MapData, u: number): THREE.Group {
  const g = new THREE.Group(), y = -100 / u;
  const lines = (runs: number[][], color: number) => {
    const pts: number[] = [];
    for (const run of runs) for (let i = 0; i + 3 < run.length; i += 2) {
      const [ax, az] = project(data.centre, run[i], run[i + 1]), [bx, bz] = project(data.centre, run[i + 2], run[i + 3]);
      pts.push(ax / u, y, az / u, bx / u, y, bz / u);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
  };
  g.add(lines(data.coast, 0xd9c49a), lines([...data.rivers, ...data.lakes], 0x6fa8e8));
  const at = data.cities.map((c) => { const [x, z] = project(data.centre, c.lon, c.lat); return new THREE.Vector3(x / u, y, z / u); });
  const dots = new THREE.BufferGeometry().setFromPoints(at);
  g.add(new THREE.Points(dots, new THREE.PointsMaterial({ color: 0xefe7d6, size: 6, sizeAttenuation: false })));
  data.cities.forEach((c, i) => { const s = label(c.name); if (s) { s.position.copy(at[i]); g.add(s); } });
  g.userData.radius = data.km * 1000 / u;
  return g;
}
