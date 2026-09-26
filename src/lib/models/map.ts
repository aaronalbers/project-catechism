// The size reference for a model kilometres across or more: the coasts, rivers, lakes and cities round
// Jerusalem at the model's scale, laid flat on the ground, and closer in the places about the city itself.
// Built from public/data/map.json, which the viewer loads only for such a model.
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

/** Beyond this span of view (km) the cities are named, and within it the places round Jerusalem. */
const CITIES_FROM_KM = 40;

/**
 * The map in model units (`u` metres each), north towards −z, lying `below` metres under y = 0 so it
 * shows through a model standing on the ground rather than fighting its floor. Jerusalem is at the
 * origin, or the place named `on` if given (the camp of Israel sets the tabernacle on Mount Moriah).
 * `userData.fit(km)` names only the places meant for a view that many kilometres across.
 */
export function mapReference(data: MapData, u: number, { on, below = 100 }: { on?: string; below?: number } = {}): THREE.Group {
  const g = new THREE.Group(), y = -below / u;
  const places = [...data.cities.map((c) => ({ ...c, span: [CITIES_FROM_KM, Infinity] as [number, number] })), ...(data.near ?? [])];
  const origin = places.find((p) => p.name === on);
  const [ox, oz] = origin ? project(data.centre, origin.lon, origin.lat) : [0, 0];
  const at = (lon: number, lat: number): [number, number] => { const [x, z] = project(data.centre, lon, lat); return [(x - ox) / u, (z - oz) / u]; };
  const lines = (runs: number[][], color: number) => {
    const pts: number[] = [];
    for (const run of runs) for (let i = 0; i + 3 < run.length; i += 2) {
      const [ax, az] = at(run[i], run[i + 1]), [bx, bz] = at(run[i + 2], run[i + 3]);
      pts.push(ax, y, az, bx, y, bz);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
  };
  g.add(lines(data.coast, 0xd9c49a), lines([...data.rivers, ...data.lakes], 0x6fa8e8));
  const dot = new THREE.PointsMaterial({ color: 0xefe7d6, size: 6, sizeAttenuation: false });
  const named: { o: THREE.Object3D; span: [number, number] }[] = [];
  for (const p of places) {
    const [x, z] = at(p.lon, p.lat), o = new THREE.Group();
    o.position.set(x, y, z);
    o.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), dot));
    const s = label(p.name); if (s) o.add(s);
    g.add(o); named.push({ o, span: p.span });
  }
  g.userData.fit = (km: number) => { for (const { o, span } of named) o.visible = km >= span[0] && km <= span[1]; };
  g.userData.fit(Infinity);
  g.userData.radius = data.km * 1000 / u;
  return g;
}
