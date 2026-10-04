// The Sky tab's readings: every claim an event makes about the sky (a conjunction, a station) is checked against
// astronomy-engine, every place and body it names resolves, and the calendar and horizon maths agree with known
// values and with astronomy-engine's own routines.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as A from 'astronomy-engine';
import { SKY_NAMES, SKY_READINGS } from '@/lib/content';
import { parseRef } from '@/lib/refs';
import { altAz, bodyEqj, closest, elongationTime, eveningWhenHigh, figureCentre, figureStars, formatUt, horizonRotation, isSolar, observer, occultation, PLANETS, station, toHorizon, utOf, whenOf } from '@/lib/sky';
import type { Place, SkyData } from '@/lib/types';

const data = (p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), 'utf8'));
const sky: SkyData = data('sky.json');
const places: Place[] = data('places/index.json');
const place = (slug: string) => places.find((p) => p.slug === slug);
const named = new Set(Object.values(sky.names));
const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);

describe('sky maths', () => {
  it('counts Julian-calendar dates and astronomical years', () => {
    // J2000 is noon on 1 January 2000 in the Gregorian calendar, 19 December 1999 in the Julian.
    expect(utOf('1999-12-19T12:00')).toBeCloseTo(0, 9);
    expect(formatUt(utOf('-0001-12-25T05:15', 35.23417), 35.23417)).toBe('25 Dec 2 BC, 05:15');
    expect(formatUt(utOf('0000-01-10'), 0, false)).toBe('10 Jan 1 BC');
  });
  it('puts a body where astronomy-engine’s horizon routine does', () => {
    const obs = observer({ lat: 31.77667, lon: 35.23417 });
    for (const [body, when] of [['Jupiter', '-0001-12-25T05:15'], ['Moon', '-0002-09-11T18:30'], ['Venus', '-0001-06-17T20:00']] as const) {
      const ut = utOf(when, obs.longitude);
      const mine = altAz(toHorizon(horizonRotation(ut, obs), bodyEqj(body, ut, obs)));
      const eq = A.Equator(body as A.Body, ut, obs, true, true);
      const theirs = A.Horizon(ut, obs, eq.ra, eq.dec);
      expect(Math.abs(mine.alt - theirs.altitude), body).toBeLessThan(0.02);
      expect(Math.abs(((mine.az - theirs.azimuth + 540) % 360) - 180), body).toBeLessThan(0.05);
    }
  });
});

describe('sky readings', () => {
  it('are interpretations that name their holders and cite the text', () => {
    for (const r of SKY_READINGS) {
      expect(r.confidence, r.id).toBe('interpretation');
      expect(r.traditions.length, r.id).toBeGreaterThan(0);
      expect(r.sources.some((s) => evidential.has(s.kind)), `${r.id} cites no evidence`).toBe(true);
      expect(new Set(r.events.map((e) => e.id)).size, `${r.id}: duplicate event id`).toBe(r.events.length);
      // Listed in the order they happen, which is the order the card lists them.
      const times = r.events.map((e) => utOf(e.when));
      expect(times, `${r.id}: events out of order`).toEqual([...times].sort((x, y) => x - y));
    }
  });
  it('name verses, places, times and bodies that exist', () => {
    for (const r of SKY_READINGS) for (const e of r.events) {
      const at = `${r.id}/${e.id}`;
      expect(parseRef(e.ref), at).toBeTruthy();
      expect(place(e.place), `${at}: no place ${e.place}`).toBeTruthy();
      if (e.toward) expect(place(e.toward), `${at}: no place ${e.toward}`).toBeTruthy();
      expect(() => utOf(e.when), at).not.toThrow();
      for (const b of [...(typeof e.look === 'string' ? [e.look] : []), ...(e.label ?? []), ...(e.track ? [e.track.body] : [])]) {
        expect(isSolar(b) || named.has(b), `${at}: unknown body ${b}`).toBe(true);
      }
      if (e.estimated) expect(e.basis, `${at} is estimated but gives no basis`).toBeTruthy();
      if (e.track) {
        const [from, to] = [utOf(e.track.from), utOf(e.track.to)];
        expect(from, at).toBeLessThan(to);
        for (const m of e.track.marks ?? []) expect(utOf(m.on) >= from && utOf(m.on) <= to, `${at}: mark ${m.on} off the track`).toBe(true);
      }
    }
  });
  it('make claims about the sky that astronomy-engine bears out', () => {
    for (const r of SKY_READINGS) for (const e of r.events) for (const c of e.checks ?? []) {
      const at = `${r.id}/${e.id}: ${c.kind} on ${c.on}`;
      if (c.kind === 'conjunction') {
        const hit = closest(c.a, c.b, utOf(c.on), c.within, sky);
        // A minimum inside the window, not at its edge.
        expect(Math.abs(hit.ut - utOf(c.on)), at).toBeLessThan(c.within - 0.5);
      } else if (c.kind === 'station') {
        expect(station(c.body, utOf(c.on), c.within), at).toBeTruthy();
      } else {
        const p = place(e.place)!;
        expect(occultation(c.body, utOf(c.on, p.lon), observer(p)), at).toBeTruthy();
      }
    }
  });
});

describe('star names', () => {
  it('stand in their verses as the Strong\'s number they claim', () => {
    for (const n of SKY_NAMES) for (const ref of n.refs) {
      const r = parseRef(ref)!;
      expect(r, `${n.id}: ${ref}`).toBeTruthy();
      const chapter: { v: number; w: unknown[][] }[] = data(`interlinear/${r.start.book}/${r.start.chapter}.json`);
      const words = chapter.find((x) => x.v === r.start.verse)!.w;
      expect(words.some((w) => w[4] === n.strongs), `${n.id}: ${n.strongs} not in ${ref}`).toBe(true);
    }
  });
  it('give each identification its holders, a source of evidence, and a figure the sky has', () => {
    for (const n of SKY_NAMES) for (const r of n.readings) {
      const at = `${n.id}/${r.id}`;
      expect(r.confidence, at).toBe('interpretation');
      expect(r.traditions.length, at).toBeGreaterThan(0);
      expect(r.sources.some((s) => evidential.has(s.kind)), `${at} cites no evidence`).toBe(true);
      const f = r.figure;
      for (const c of f.constellations ?? []) expect(sky.lines[c], `${at}: no lines for ${c}`).toBeTruthy();
      for (const s of f.stars ?? []) expect(named.has(s), `${at}: no star ${s}`).toBe(true);
      if (f.cluster) expect(sky.clusters[f.cluster]?.length, `${at}: no cluster ${f.cluster}`).toBeGreaterThan(0);
      if (f.planet) expect((PLANETS as readonly string[]).includes(f.planet.body), at).toBe(true);
      else expect(figureStars(f, sky).length + (f.centre ? 1 : 0), `${at} lights nothing`).toBeGreaterThan(0);
    }
  });
  it('find an evening for every figure, and Venus at its elongations', () => {
    const jer = place('jerusalem')!;
    for (const n of SKY_NAMES) for (const r of n.readings) {
      const ut = r.figure.planet ? elongationTime(r.figure.planet.body, r.figure.planet.as, -759, jer) : eveningWhenHigh(figureCentre(r.figure, sky), -759, jer);
      expect(Number.isFinite(ut), `${n.id}/${r.id}`).toBe(true);
      expect(utOf(whenOf(ut, jer.lon), jer.lon)).toBeCloseTo(ut, 3);
    }
  });
});
