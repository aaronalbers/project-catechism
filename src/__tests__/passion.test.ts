// The three days: every dated verse quotes the BSB and falls inside its account in order, in every reading,
// and the counts each reading gives are the ones its own text claims.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PASSION } from '@/lib/content';
import { compareLoc, contains, parseRef } from '@/lib/refs';
import { READINGS, buriedAt, clock, countsOf, eventHour, hourOf, jewishDayAt, jewishDays, readingOf, roseFrom, roseTo } from '@/lib/passion';
import type { BibleBook } from '@/lib/types';

const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);
const bibleDir = new URL('../../public/data/bible/', import.meta.url);
const byId = (id: string) => READINGS.find((r) => r.id === id)!;

describe('the three days', () => {
  it('dates each verse inside its account, in reading order and in time order, in every reading', () => {
    for (const a of PASSION.accounts) {
      expect(parseRef(a.ref), a.ref).not.toBeNull();
      for (const e of a.events) {
        const at = parseRef(e.ref)!;
        expect(at.start, `${e.ref} is one verse`).toEqual(at.end);
        expect(contains(a.ref, at.start), `${e.ref} is outside ${a.ref}`).toBe(true);
        expect(e.basis.length, `${e.ref}: no basis`).toBeGreaterThan(10);
        if (e.until !== undefined) expect(e.until, e.ref).toBeGreaterThan(e.at.hour);
      }
      for (let i = 1; i < a.events.length; i++) {
        expect(compareLoc(parseRef(a.events[i - 1].ref)!.start, parseRef(a.events[i].ref)!.start), `${a.id}: ${a.events[i].ref} out of order`).toBeLessThan(0);
        for (const r of READINGS) expect(eventHour(a.events[i], r), `${a.id} (${r.id}): ${a.events[i].ref} is earlier than the verse before it`).toBeGreaterThanOrEqual(eventHour(a.events[i - 1], r));
      }
    }
  });
  it('gives every reading its evidence, who holds it, and a rising after the burial', () => {
    const refs = new Set(PASSION.accounts.flatMap((a) => a.events.map((e) => e.ref)));
    expect(PASSION.sources.some((s) => evidential.has(s.kind))).toBe(true);
    for (const r of READINGS) {
      expect(r.sources.some((s) => evidential.has(s.kind)), `${r.id} has no evidential source`).toBe(true);
      expect(r.traditions.length, `${r.id} names no tradition`).toBeGreaterThan(0);
      expect(roseFrom(r), r.id).toBeGreaterThan(buriedAt(r));
      expect(roseTo(r), r.id).toBeGreaterThanOrEqual(roseFrom(r));
      for (const ref of Object.keys(r.moves ?? {})) expect(refs.has(ref), `${r.id} moves unknown ${ref}`).toBe(true);
      for (const s of r.sources) if (s.ref) expect(parseRef(s.ref), `${r.id}: ${s.ref}`).not.toBeNull();
    }
    for (const s of PASSION.sayings) expect(parseRef(s.ref), s.ref).not.toBeNull();
    expect(hourOf(PASSION.buried, READINGS[0])).toBeGreaterThan(hourOf(PASSION.died, READINGS[0]));
  });
  it.skipIf(!existsSync(bibleDir))('quotes the BSB wording', () => {
    for (const { ref, quote } of [...PASSION.accounts.flatMap((a) => a.events), ...PASSION.sayings]) {
      const loc = parseRef(ref)!.start;
      const book = JSON.parse(readFileSync(new URL(`${loc.book}.json`, bibleDir), 'utf8')) as BibleBook;
      expect(book.chapters[loc.chapter - 1].find((v) => v.v === loc.verse)!.t, ref).toContain(quote);
    }
  });

  // What each reading's own text says it counts.
  it('counts Friday as three days and two nights', () => {
    expect(countsOf(byId('friday'))).toMatchObject({ days: 3, nights: 2 });
    expect(jewishDays(byId('friday')).map((d) => d.name)).toEqual(['Preparation', 'Sabbath (High)', 'First day']);
  });
  it('counts Thursday as three nights, and Wednesday as three nights and exactly 72 hours', () => {
    expect(countsOf(byId('thursday')).nights).toBe(3);
    expect(countsOf(byId('wednesday'))).toMatchObject({ nights: 3, hours: [72, 72] });
    expect(jewishDays(byId('wednesday')).map((d) => d.name)).toEqual(['Preparation', 'High Sabbath', 'Friday', 'Sabbath', 'First day']);
  });
  it('puts the women’s spices after the Sabbath in the third Jewish day, before Sunday’s dawn', () => {
    const r = byId('friday'), e = PASSION.accounts.find((a) => a.id === 'mark')!.events.find((x) => x.ref === 'Mark.16.1')!;
    expect(jewishDayAt(eventHour(e, r), r)).toMatchObject({ name: 'First day', count: 3 });
    expect(clock(eventHour(e, r))).toBe('Saturday ≈7 p.m.');
  });
  it('falls back to Friday for an unknown reading', () => {
    expect(readingOf('nope').id).toBe('friday');
  });
});
