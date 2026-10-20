// Routes the legs of the itineraries in content/journeys.json off the coastline, and checks every leg against it.
//
//   npm run journeys            recompute the points of every leg whose `via` has a `go` recipe, then check
//   npm run journeys -- check   only list the legs that cross the coast away from their ends
//   npm run journeys -- path 37.88,23.00 37.94,27.34 [sea|land]   print the waypoints of one leg
//
// A recipe is a list alternating modes and waypoints, ending with the mode into the station: ["sea"], or
// ["land", [36.49, 36.2], "land"] for a road through the Syrian Gates. A `sea` stretch is the shortest course that
// keeps about a kilometre off the Natural Earth coastline (1:10m, in .cache/ from `npm run data:fetch`); a `land`
// stretch is the shortest way that keeps as far inside it. A grid search finds the way and it is then pulled taut,
// so each stretch is a few straight lines. Mountains, roads and winds play no part: say so in the leg's `basis`.
// Needs public/data/places/index.json (`npm run data`) for the stations' positions.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const [LAT0, LAT1, LON0, LON1, STEP] = [30, 42.6, 12, 37, 0.03];
const MARGIN_KM = 1;
/** Open water in the middle of the Mediterranean, where the flood fill that tells sea from land starts. */
const SEA_SEED = [34, 20];
const B = 0.1;

const km = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) * 111.2;

function crosses(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (d === 0) return false;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointSegmentKm(p, a, b) {
  const c = Math.cos((p[0] * Math.PI) / 180);
  const [ax, ay, bx, by, px, py] = [a[1] * c, a[0], b[1] * c, b[0], p[1] * c, p[0]];
  const dx = bx - ax, dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy) * 111.2;
}

/** The coastline as [lat, lon] segments, bucketed by 0.1° cell. */
function loadCoast() {
  const geo = JSON.parse(readFileSync(new URL('.cache/ne-coastline.geojson', ROOT), 'utf8'));
  const segs = [], bucket = new Map();
  for (const f of geo.features) {
    const g = f.geometry;
    for (const line of g.type === 'LineString' ? [g.coordinates] : g.coordinates) {
      for (let i = 1; i < line.length; i++) {
        const [a, b] = [line[i - 1], line[i]];
        if (a[0] < LON0 - 1 || a[0] > LON1 + 1 || a[1] < LAT0 - 1 || a[1] > LAT1 + 1) continue;
        const s = [[a[1], a[0]], [b[1], b[0]]];
        const n = segs.push(s) - 1;
        for (let la = Math.floor(Math.min(s[0][0], s[1][0]) / B); la <= Math.floor(Math.max(s[0][0], s[1][0]) / B); la++)
          for (let lo = Math.floor(Math.min(s[0][1], s[1][1]) / B); lo <= Math.floor(Math.max(s[0][1], s[1][1]) / B); lo++) {
            const k = `${la},${lo}`;
            if (!bucket.has(k)) bucket.set(k, []);
            bucket.get(k).push(n);
          }
      }
    }
  }
  return { segs, bucket };
}

let coast;
function near(a, b, pad = 0) {
  coast ??= loadCoast();
  const out = new Set();
  for (let la = Math.floor((Math.min(a[0], b[0]) - pad) / B); la <= Math.floor((Math.max(a[0], b[0]) + pad) / B); la++)
    for (let lo = Math.floor((Math.min(a[1], b[1]) - pad) / B); lo <= Math.floor((Math.max(a[1], b[1]) + pad) / B); lo++)
      for (const i of coast.bucket.get(`${la},${lo}`) ?? []) out.add(i);
  return [...out].map((i) => coast.segs[i]);
}

/** The points where a straight line crosses the coast. */
const crossings = (a, b) => near(a, b).filter(([r, s]) => crosses(a, b, r, s));
const blocked = (a, b) => near(a, b).some(([r, s]) => crosses(a, b, r, s));
const PAD = (MARGIN_KM / 111) * 2;
const clearance = (p) => Math.min(99, ...near(p, p, PAD).flatMap(([r, s]) => [km(p, r), km(p, s)]));
/** No crossing, and the line keeps MARGIN_KM off the coast except within 8 km of the leg's ends. */
const clearView = (a, b, ends) => !blocked(a, b) && near(a, b, PAD).every((s) => s.every((v) => ends.some((e) => km(v, e) < 8) || pointSegmentKm(v, a, b) >= MARGIN_KM));

const NLA = Math.floor((LAT1 - LAT0) / STEP) + 1, NLO = Math.floor((LON1 - LON0) / STEP) + 1;
const node = (i, j) => [LAT0 + i * STEP, LON0 + j * STEP];
let sea;
/** Which grid points are at sea: those the open sea reaches without crossing the coast. */
function seaGrid() {
  if (sea) return sea;
  sea = new Uint8Array(NLA * NLO);
  const si = Math.round((SEA_SEED[0] - LAT0) / STEP), sj = Math.round((SEA_SEED[1] - LON0) / STEP);
  sea[si * NLO + sj] = 1;
  const stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = i + di, l = j + dj;
      if (k < 0 || k >= NLA || l < 0 || l >= NLO || sea[k * NLO + l] || blocked(node(i, j), node(k, l))) continue;
      sea[k * NLO + l] = 1;
      stack.push([k, l]);
    }
  }
  return sea;
}

const clearNode = new Map();
function usable(i, j, mode) {
  if (i < 0 || i >= NLA || j < 0 || j >= NLO || !!seaGrid()[i * NLO + j] !== (mode === 'sea')) return false;
  const k = i * NLO + j;
  if (!clearNode.has(k)) clearNode.set(k, clearance(node(i, j)) > MARGIN_KM);
  return clearNode.get(k);
}

/** A small binary heap on [priority, ...]. */
class Heap {
  a = [];
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
}

/** The waypoints (not including a and b) of the shortest way from a to b at sea or on land, pulled taut. */
export function path(a, b, mode = 'sea') {
  const entries = (p) => {
    const i0 = Math.round((p[0] - LAT0) / STEP), j0 = Math.round((p[1] - LON0) / STEP), c = [];
    for (let di = -12; di <= 12; di++) for (let dj = -12; dj <= 12; dj++) {
      const i = i0 + di, j = j0 + dj;
      if (usable(i, j, mode) && km(p, node(i, j)) < 35) c.push([km(p, node(i, j)), i, j]);
    }
    return c.sort((x, y) => x[0] - y[0]).slice(0, 6).map(([, i, j]) => i * NLO + j);
  };
  const starts = entries(a), goals = new Set(entries(b));
  if (!starts.length || !goals.size) throw new Error(`no ${mode} near ${JSON.stringify(starts.length ? b : a)}`);
  const at = (k) => node(Math.floor(k / NLO), k % NLO);
  const heap = new Heap(), prev = new Map();
  for (const s of starts) heap.push([km(a, at(s)) + km(at(s), b), km(a, at(s)), s, -1]);
  let end = -1;
  while (heap.size) {
    const [, g, n, p] = heap.pop();
    if (prev.has(n)) continue;
    prev.set(n, p);
    if (goals.has(n)) { end = n; break; }
    const i = Math.floor(n / NLO), j = n % NLO;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const m = (i + di) * NLO + j + dj;
      if ((!di && !dj) || prev.has(m) || !usable(i + di, j + dj, mode) || blocked(at(n), at(m))) continue;
      const g2 = g + km(at(n), at(m));
      heap.push([g2 + km(at(m), b), g2, m, n]);
    }
  }
  if (end < 0) throw new Error(`no ${mode} way from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);
  const chain = [];
  for (let n = end; n >= 0; n = prev.get(n)) chain.push(at(n));
  chain.reverse().unshift(a);
  chain.push(b);
  // Pull taut: from each kept point, jump to the farthest point still in clear view.
  const out = [];
  for (let i = 0; i < chain.length - 1;) {
    let k = chain.length - 1;
    while (k > i + 1 && !clearView(chain[i], chain[k], [a, b])) k--;
    if (k < chain.length - 1) out.push(chain[k]);
    i = k;
  }
  return out.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
}

/** Every station's position, as `resolveRoute` in src/lib/journey.ts places it. */
function positions(journey, places) {
  const fixed = journey.stations.map((s) => {
    if (s.estimate) return s.estimate.at ?? null;
    const p = places.get(s.place);
    if (!p) throw new Error(`${journey.id}: ${s.name} has no place ${s.place}`);
    return [p.lat, p.lon];
  });
  return fixed.map((pt, i) => {
    if (pt) return pt;
    let a = i, b = i;
    while (a >= 0 && !fixed[a]) a--;
    while (b < fixed.length && !fixed[b]) b++;
    const from = fixed[a] ?? fixed[b], to = fixed[b] ?? fixed[a], t = (i - a) / (b - a);
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  });
}

/** The waypoints a `go` recipe gives for the leg from `from` to `to`. */
export function follow(go, from, to) {
  const pts = [];
  let here = from;
  for (let k = 0; k < go.length; k += 2) {
    const next = go[k + 1] ?? to;
    pts.push(...path(here, next, go[k]));
    if (k + 1 < go.length) pts.push(next);
    here = next;
  }
  return pts;
}

/** Writes the journeys in the file's layout: one station per line. */
function format(journeys) {
  const one = (x) => Array.isArray(x) ? `[${x.map(one).join(', ')}]`
    : x && typeof x === 'object' ? `{ ${Object.entries(x).map(([k, v]) => `${JSON.stringify(k)}: ${one(v)}`).join(', ')} }`
    : JSON.stringify(x);
  const body = journeys.map((j) => {
    const keys = Object.keys(j).filter((k) => k !== 'sources' && k !== 'stations');
    return [
      ' {',
      ...keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(j[k])},`),
      '  "sources": [', j.sources.map((s) => `   ${one(s)}`).join(',\n'), '  ],',
      '  "stations": [', j.stations.map((s) => `   ${one(s)}`).join(',\n'), '  ]',
      ' }',
    ].join('\n');
  });
  return `[\n${body.join(',\n')}\n]\n`;
}

const file = new URL('content/journeys.json', ROOT);
const load = () => {
  const journeys = JSON.parse(readFileSync(file, 'utf8'));
  const places = new Map(JSON.parse(readFileSync(new URL('public/data/places/index.json', ROOT), 'utf8')).map((p) => [p.id, p]));
  return { journeys, places };
};

function check({ journeys, places }) {
  let n = 0;
  for (const j of journeys) {
    const at = positions(j, places);
    j.stations.forEach((s, i) => {
      if (!i) return;
      const leg = [at[i - 1], ...(s.via?.points ?? []), at[i]];
      const hits = leg.slice(1).flatMap((b, k) => crossings(leg[k], b).map(([r, q]) => {
        const a = leg[k], d = (q[0] - r[0]) * (b[1] - a[1]) - (q[1] - r[1]) * (b[0] - a[0]);
        const t = ((r[0] - a[0]) * (b[1] - a[1]) - (r[1] - a[1]) * (b[0] - a[0])) / -d;
        return [r[0] + t * (q[0] - r[0]), r[1] + t * (q[1] - r[1])];
      })).filter((x) => km(x, leg[0]) > 4 && km(x, leg[leg.length - 1]) > 4);
      if (!hits.length) return;
      n++;
      console.log(`${j.id}: ${j.stations[i - 1].name} → ${s.name} crosses the coast ${hits.length}× at ${hits.slice(0, 4).map((h) => h.map((x) => x.toFixed(2)).join(',')).join(' ')}`);
    });
  }
  console.log(n ? `\n${n} legs cross the coast. Coming ashore at a site inland or on an island counts once; a leg drawn straight on purpose says so in its basis.` : 'No leg crosses the coast.');
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'path') {
  const p = (s) => s.split(',').map(Number);
  console.log(JSON.stringify(path(p(args[0]), p(args[1]), args[2] ?? 'sea')));
} else if (cmd === 'check') {
  check(load());
} else if (!cmd) {
  const data = load();
  for (const j of data.journeys) {
    const at = positions(j, data.places);
    j.stations.forEach((s, i) => { if (s.via?.go) s.via = { go: s.via.go, points: follow(s.via.go, at[i - 1], at[i]), basis: s.via.basis }; });
  }
  writeFileSync(file, format(data.journeys));
  console.log('Routed the legs with a recipe.');
  check(data);
} else {
  console.error('usage: npm run journeys [-- check | -- path lat,lon lat,lon [sea|land]]');
  process.exit(1);
}
