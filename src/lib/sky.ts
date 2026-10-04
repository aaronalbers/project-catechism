// The sky as astronomy-engine computes it, for the Sky tab and the tests that check what a reading says of it.
// Times are astronomy-engine's: UT days since noon, 1 January 2000. Dates are the Julian calendar's, as
// historians give them, with astronomical years (0 is 1 BC, −1 is 2 BC); nothing here goes through a JS Date,
// whose calendar is the Gregorian.
import * as A from 'astronomy-engine';
import type { Place, SkyBody, SkyData, SkyFigure } from './types';

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const SOLAR = new Set<string>(['Sun', 'Moon', ...PLANETS]);
export const isSolar = (b: SkyBody) => SOLAR.has(b);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RAD = Math.PI / 180;

/** The Julian Day of a Julian-calendar date (Meeus, Astronomical Algorithms, ch. 7, with B = 0). */
function jdJulian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d - 1524.5;
}
/** The Julian-calendar date of a Julian Day (Meeus ch. 7, without the Gregorian correction). */
function julianDate(jd: number) {
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  const b = z + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const m = e < 14 ? e - 1 : e - 13;
  return { y: m > 2 ? c - 4716 : c - 4715, m, d: Math.floor(day), h: (day % 1) * 24 };
}

/** "-0001-12-25T05:15" (local mean time at longitude `lon`) as UT days since J2000. A date alone is midnight. */
export function utOf(when: string, lon = 0): number {
  const m = /^(-?\d+)-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?$/.exec(when);
  if (!m) throw new Error(`sky: bad date ${when}`);
  const h = m[4] ? Number(m[4]) + Number(m[5]) / 60 : 0;
  return jdJulian(Number(m[1]), Number(m[2]), Number(m[3])) + (h - lon / 15) / 24 - 2451545.0;
}

/** A year as historians write it: 0 is 1 BC. */
export const yearLabel = (y: number) => (y <= 0 ? `${1 - y} BC` : `AD ${y}`);
/** "25 Dec 2 BC, 05:15" in local mean time at `lon`, or the date alone. */
export function formatUt(ut: number, lon = 0, time = true): string {
  const j = julianDate(ut + 2451545.0 + lon / 15 / 24);
  let hh = Math.floor(j.h), mm = Math.round((j.h - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  const date = `${j.d} ${MONTHS[j.m - 1]} ${yearLabel(j.y)}`;
  return time ? `${date}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : date;
}

export const observer = (p: Pick<Place, 'lat' | 'lon'>) => new A.Observer(p.lat, p.lon, 0);

/** Where a body is, as a J2000 equatorial unit vector seen from `obs` (the Moon's parallax is near a degree). */
export function bodyEqj(body: SkyBody, ut: number, obs: A.Observer): [number, number, number] {
  const v = A.Equator(body as A.Body, ut, obs, false, true).vec;
  const r = Math.hypot(v.x, v.y, v.z);
  return [v.x / r, v.y / r, v.z / r];
}

/** A star's J2000 equatorial unit vector at `ut`, carried by its proper motion from the catalogue's epoch (2000). */
export function starEqj(row: SkyData['stars'][number], ut: number): [number, number, number] {
  const [ra0, dec0, , , pmRa, pmDec] = row;
  const years = ut / 365.25;
  const dec = dec0 + (pmDec / 3.6e6) * years;
  const ra = ra0 + (pmRa / 3.6e6) * years / Math.cos(dec0 * RAD);
  return [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
}

/** The index of a named star in the sky data. */
export function starIndex(sky: SkyData, name: string): number {
  const hit = Object.entries(sky.names).find(([, n]) => n === name);
  if (!hit) throw new Error(`sky: no star named ${name}`);
  return Number(hit[0]);
}

/** Any body or named star as a J2000 unit vector. */
export function eqjOf(body: SkyBody, ut: number, obs: A.Observer, sky: SkyData): [number, number, number] {
  return isSolar(body) ? bodyEqj(body, ut, obs) : starEqj(sky.stars[starIndex(sky, body)], ut);
}

/**
 * The rotation from J2000 equatorial to the observer's horizon at `ut`: precession and nutation to the date, then
 * the Earth's turn. Its output is x north, y west, z up.
 */
export const horizonRotation = (ut: number, obs: A.Observer) => A.Rotation_EQJ_HOR(ut, obs);
export function toHorizon(rot: A.RotationMatrix, v: [number, number, number]): [number, number, number] {
  const r = rot.rot;
  return [r[0][0] * v[0] + r[1][0] * v[1] + r[2][0] * v[2], r[0][1] * v[0] + r[1][1] * v[1] + r[2][1] * v[2], r[0][2] * v[0] + r[1][2] * v[1] + r[2][2] * v[2]];
}
/** Altitude and azimuth (from north, through east) in degrees, without refraction. */
export function altAz(h: [number, number, number]) {
  return { alt: Math.asin(Math.max(-1, Math.min(1, h[2]))) / RAD, az: ((Math.atan2(-h[1], h[0]) / RAD) + 360) % 360 };
}

export const separation = (a: [number, number, number], b: [number, number, number]) =>
  Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;

/** The Sun's altitude at `ut`, for how dark the sky is. */
export function sunAltitude(ut: number, obs: A.Observer) {
  return altAz(toHorizon(horizonRotation(ut, obs), bodyEqj('Sun', ut, obs))).alt;
}

/** How lit the Moon is (0–1), and a planet's or the Moon's magnitude. */
export const moonLit = (ut: number) => A.Illumination(A.Body.Moon, ut).phase_fraction;
export const magnitude = (body: SkyBody, ut: number) => A.Illumination(body as A.Body, ut).mag;

/**
 * When two bodies came closest within `within` days of `ut`, seen from the Earth's centre for a planet and a star
 * (a planet's parallax is seconds of arc), searched hour by hour.
 */
export function closest(a: SkyBody, b: SkyBody, ut: number, within: number, sky: SkyData) {
  const geo = new A.Observer(0, 0, 0);
  let best = { ut, deg: Infinity };
  for (let t = ut - within; t <= ut + within; t += 1 / 24) {
    const deg = separation(eqjOf(a, t, geo, sky), eqjOf(b, t, geo, sky));
    if (deg < best.deg) best = { ut: t, deg };
  }
  return best;
}

const eclipticLon = (body: SkyBody, ut: number) => A.Ecliptic(A.GeoVector(body as A.Body, ut, true)).elon;
/** Where a planet turns between direct and retrograde in ecliptic longitude, within `within` days of `ut`, to the quarter day. */
export function station(body: SkyBody, ut: number, within: number): { ut: number; to: 'retrograde' | 'direct' } | null {
  let prev: number | null = null, step = 0.25;
  for (let t = ut - within - step; t <= ut + within; t += step) {
    let d = eclipticLon(body, t + step) - eclipticLon(body, t);
    if (d > 180) d -= 360; if (d < -180) d += 360;
    if (prev !== null && Math.sign(d) !== Math.sign(prev)) return { ut: t, to: d < 0 ? 'retrograde' : 'direct' };
    prev = d;
  }
  return null;
}

/**
 * When the Moon covers a body, seen from `obs`, during the local day starting at `ut` (local midnight), searched
 * minute by minute: the first and last minute its centre is behind the Moon's disc, or null.
 */
export function occultation(body: SkyBody, ut: number, obs: A.Observer): { from: number; to: number } | null {
  let from: number | null = null, to = 0;
  for (let t = ut; t < ut + 1; t += 1 / 1440) {
    const moon = A.Equator(A.Body.Moon, t, obs, false, true);
    const radius = Math.asin(1737.4 / (moon.dist * A.KM_PER_AU)) / RAD;
    const covered = separation(unit(moon.vec), bodyEqj(body, t, obs)) < radius;
    if (covered) { from ??= t; to = t; }
  }
  return from === null ? null : { from, to };
}
const unit = (v: A.Vector): [number, number, number] => { const r = Math.hypot(v.x, v.y, v.z); return [v.x / r, v.y / r, v.z / r]; };

/** The direction (azimuth from north, degrees) from one place to another, on the sphere. */
export function bearing(from: Pick<Place, 'lat' | 'lon'>, to: Pick<Place, 'lat' | 'lon'>) {
  const [la1, lo1, la2, lo2] = [from.lat, from.lon, to.lat, to.lon].map((x) => x * RAD);
  const y = Math.sin(lo2 - lo1) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** ΔT, the clock correction for the Earth's slowing spin, in hours at `ut`: astronomy-engine's model (Espenak and Meeus). */
export const deltaTHours = (ut: number) => (A.MakeTime(ut).tt - ut) * 24;

/** UT days as a `when` string, local mean time at `lon`, Julian calendar, astronomical year: the inverse of `utOf`. */
export function whenOf(ut: number, lon = 0): string {
  const j = julianDate(ut + 2451545.0 + lon / 15 / 24);
  let hh = Math.floor(j.h), mm = Math.round((j.h - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  const y = j.y < 0 ? `-${String(-j.y).padStart(4, '0')}` : String(j.y).padStart(4, '0');
  return `${y}-${String(j.m).padStart(2, '0')}-${String(j.d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const raDecOf = (v: [number, number, number]): [number, number] => [((Math.atan2(v[1], v[0]) / RAD) + 360) % 360, Math.asin(v[2]) / RAD];
const meanOf = (vs: [number, number, number][]): [number, number, number] => {
  const s = vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
  const r = Math.hypot(...s);
  return [s[0] / r, s[1] / r, s[2] / r];
};

/** The stars a figure lights: its constellations' line stars, its named stars and its cluster's members. */
export function figureStars(fig: SkyFigure, sky: SkyData): number[] {
  return [...new Set([
    ...(fig.constellations ?? []).flatMap((c) => (sky.lines[c] ?? []).flat()),
    ...(fig.stars ?? []).map((n) => starIndex(sky, n)),
    ...(fig.cluster ? sky.clusters?.[fig.cluster] ?? [] : []),
  ])];
}

/** Where a fixed figure stands, [ra, dec] in degrees (J2000): its `centre`, or the middle of its stars. */
export function figureCentre(fig: SkyFigure, sky: SkyData): [number, number] {
  if (fig.centre) return fig.centre;
  return raDecOf(meanOf(figureStars(fig, sky).map((i) => starEqj(sky.stars[i], 0))));
}

/**
 * The evening in astronomical year `year` when a point (J2000 [ra, dec]) stands highest at `hour` local mean time,
 * searched day by day: when a fixed figure is best seen. Altitude is taken through the rotation to the date, so
 * precession is allowed for.
 */
export function eveningWhenHigh([ra, dec]: [number, number], year: number, place: Pick<Place, 'lat' | 'lon'>, hour = 21): number {
  const start = utOf(`${year < 0 ? `-${String(-year).padStart(4, '0')}` : String(year).padStart(4, '0')}-01-01T${String(hour).padStart(2, '0')}:00`, place.lon);
  const obs = observer(place);
  const v: [number, number, number] = [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
  let best = start, bestAlt = -Infinity;
  for (let d = 0; d < 366; d++) {
    const alt = altAz(toHorizon(horizonRotation(start + d, obs), v)).alt;
    if (alt > bestAlt) { bestAlt = alt; best = start + d; }
  }
  return best;
}

/**
 * When a planet stands farthest from the Sun as the evening or morning star nearest the middle of `year` (Venus does
 * so every 584 days, so a year may have none), at dusk or dawn: fifty minutes after sunset or before sunrise at `place`.
 */
export function elongationTime(body: SkyBody, as: 'evening' | 'morning', year: number, place: Pick<Place, 'lat' | 'lon'>): number {
  const mid = utOf(`${year < 0 ? `-${String(-year).padStart(4, '0')}` : String(year).padStart(4, '0')}-07-01`, place.lon);
  let t = mid - 700, best: A.ElongationEvent | null = null;
  for (let k = 0; k < 6; k++) {
    const e = A.SearchMaxElongation(body as A.Body, t);
    if (e.visibility === as && (!best || Math.abs(e.time.ut - mid) < Math.abs(best.time.ut - mid))) best = e;
    t = e.time.ut + 10;
  }
  if (!best) throw new Error(`sky: no ${as} elongation of ${body} near ${year}`);
  const day = Math.floor(best.time.ut + 0.5) - 0.5 - place.lon / 360;
  const edge = A.SearchRiseSet(A.Body.Sun, observer(place), as === 'evening' ? -1 : +1, day, 1)!;
  return edge.ut + (as === 'evening' ? 50 : -50) / 1440;
}
