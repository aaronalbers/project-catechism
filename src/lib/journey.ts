// Resolves an itinerary's stations to map positions: OpenBible's identification where it
// gives a real site, the curated estimate where it doesn't, and even spacing along the line
// of travel for camps nobody has located.
import { parseRef } from './refs';
import type { Journey, Place, Station } from './types';

export type LatLon = [number, number];
export interface RouteStop {
  station: Station; verse: number; at: LatLon; place?: Place;
  /** The named stretch this stop belongs to, carried forward from the last station that set one. */
  segment?: string;
  /** Why the position is approximate, or undefined when it is OpenBible's proposed site. */
  estimate?: string;
  /** Path from the previous stop, ending at `at`; waypoints in between when the leg has `via`. */
  leg: LatLon[];
  /** The leg's path is our own reconstruction rather than a straight line between known points. */
  legEstimated: boolean;
}

export function resolveRoute(j: Journey, places: Map<string, Place>): RouteStop[] {
  const fixed: (LatLon | null)[] = j.stations.map((s) => {
    if (s.estimate) return s.estimate.at ?? null;
    const p = s.place ? places.get(s.place) : undefined;
    return p ? [p.lat, p.lon] : null;
  });
  // Unplaced runs are spaced evenly between the fixed stops either side of them.
  const at = fixed.map((pt, i) => {
    if (pt) return pt;
    let a = i, b = i;
    while (a >= 0 && !fixed[a]) a--;
    while (b < fixed.length && !fixed[b]) b++;
    const from = fixed[a] ?? fixed[b], to = fixed[b] ?? fixed[a];
    if (!from || !to) return null;
    const t = (i - a) / (b - a);
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as LatLon;
  });
  const stops: RouteStop[] = [];
  j.stations.forEach((s, i) => {
    const pt = at[i];
    if (!pt) return;
    const place = s.place ? places.get(s.place) : undefined;
    const estimate = s.estimate?.basis ?? (place?.approx ? `OpenBible only places it ${place.approx}.` : undefined);
    const prev = stops[stops.length - 1];
    stops.push({
      station: s, verse: parseRef(s.verse)?.start.verse ?? 0, at: pt, place, estimate, segment: s.segment ?? prev?.segment,
      leg: prev ? [prev.at, ...(s.via?.points ?? []), pt] : [pt],
      legEstimated: !!prev && (!!s.via || !!estimate || !!prev.estimate),
    });
  });
  return stops;
}

/** Index of the stop the reader has reached at `verse`: the last one named at or before it, or -1. */
export function stopAt(stops: RouteStop[], verse: number) {
  let cur = -1;
  stops.forEach((s, i) => { if (s.verse <= verse) cur = i; });
  return cur;
}

/** The first `t` (0–1) of a polyline, measured by length, so a leg can be drawn growing. */
export function partialPath(path: LatLon[], t: number): LatLon[] {
  if (t >= 1 || path.length < 2) return path;
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let left = seg.reduce((a, b) => a + b, 0) * Math.max(0, t);
  const out: LatLon[] = [path[0]];
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i]) { out.push(path[i + 1]); left -= seg[i]; continue; }
    const f = seg[i] ? left / seg[i] : 0;
    out.push([path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]);
    break;
  }
  return out;
}
