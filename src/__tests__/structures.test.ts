// A book's shape is a set of readings built on words it repeats. The words are facts: each must be the BSB's in its
// verse, and the original's in that verse and in no other of the book, so the list is complete. The readings are
// outlines: each must cover its book in order, once, and name who proposed it.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { STRUCTURES } from '@/lib/content';
import { hebrewOrder } from '@/lib/acrostic';
import { pairBase } from '@/lib/structure';
import { book as bookOf, compareLoc, parseRef, CHAPTER_END, type VerseLoc } from '@/lib/refs';
import type { BibleBook, InterlinearVerse } from '@/lib/types';

const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);
const bibleDir = new URL('../../public/data/bible/', import.meta.url);
const interlinearDir = new URL('../../public/data/interlinear/', import.meta.url);
const bible = (id: string) => JSON.parse(readFileSync(new URL(`${id}.json`, bibleDir), 'utf8')) as BibleBook;
const counts = (id: string) => bible(id).chapters.map((c) => Math.max(...c.map((v) => v.v)));
/** The verse after `loc` in its book, or null after the last. */
const next = (c: number[], loc: VerseLoc): VerseLoc | null =>
  loc.verse < c[loc.chapter - 1] ? { ...loc, verse: loc.verse + 1 } : loc.chapter < c.length ? { ...loc, chapter: loc.chapter + 1, verse: 1 } : null;
const ends = (c: number[], ref: string) => { const e = parseRef(ref)!.end; return e.verse === CHAPTER_END ? { ...e, verse: c[e.chapter - 1] } : e; };
const same = (a: VerseLoc | null, b: VerseLoc) => !!a && compareLoc(a, b) === 0;

describe('book structures', () => {
  it('every reference parses, inside its book', () => {
    for (const s of STRUCTURES) {
      expect(bookOf(s.book), s.id).toBeTruthy();
      const refs = [...s.markers.flatMap((m) => m.quotes.map((q) => q.ref)), ...s.readings.flatMap((r) => [...r.sections.map((x) => x.ref), ...(r.groups ?? []).map((g) => g.ref)])];
      for (const ref of refs) {
        const r = parseRef(ref);
        expect(r, `${s.id}: ${ref}`).not.toBeNull();
        expect([r!.start.book, r!.end.book], `${s.id}: ${ref} leaves ${s.book}`).toEqual([s.book, s.book]);
      }
    }
  });
  it('ids are unique, and a reading names the markers it rests on', () => {
    expect(new Set(STRUCTURES.map((s) => s.book)).size, 'one structure per book').toBe(STRUCTURES.length);
    for (const s of STRUCTURES) {
      const ids = [...s.markers.map((m) => m.id), ...s.readings.map((r) => r.id)];
      expect(new Set(ids).size, `${s.id}: duplicate id`).toBe(ids.length);
      for (const r of s.readings) for (const m of r.markers ?? []) expect(s.markers.some((x) => x.id === m), `${s.id}/${r.id}: unknown marker ${m}`).toBe(true);
    }
  });
  it('markers are evidence, cited to the text; readings are interpretations naming who holds them', () => {
    for (const s of STRUCTURES) {
      for (const m of s.markers) {
        expect(m.confidence, `${s.id}/${m.id}`).toBe('evidence');
        expect(m.sources.some((x) => evidential.has(x.kind)), `${s.id}/${m.id} has no evidential source`).toBe(true);
        expect(m.quotes.length, `${s.id}/${m.id}`).toBeGreaterThan(1);
      }
      for (const r of s.readings) {
        expect(r.confidence, `${s.id}/${r.id}`).toBe('interpretation');
        expect(r.traditions?.length, `${s.id}/${r.id} names no holder`).toBeGreaterThan(0);
        expect(r.sources.some((x) => evidential.has(x.kind)), `${s.id}/${r.id} has no evidential source`).toBe(true);
        expect(r.sources.some((x) => x.kind === 'scholarship' && x.url), `${s.id}/${r.id} cites no proposal of it to read`).toBe(true);
      }
    }
  });
  it('a reading\'s kinds, pairs and centre are its own', () => {
    for (const s of STRUCTURES) for (const r of s.readings) {
      for (const x of r.sections) if (x.kind) expect(r.kinds?.[x.kind], `${s.id}/${r.id}: kind ${x.kind} is not named`).toBeTruthy();
      const pairs = r.sections.flatMap((x) => (x.pair ? [x.pair] : []));
      expect(new Set(pairs).size, `${s.id}/${r.id}: a pair letter used twice`).toBe(pairs.length);
      for (const p of pairs) {
        const partner = p.endsWith("'") ? pairBase(p) : `${p}'`;
        if (p !== r.centre) expect(pairs, `${s.id}/${r.id}: ${p} has no ${partner}`).toContain(partner);
      }
      if (r.centre) {
        expect(pairs, `${s.id}/${r.id}: centre ${r.centre} is not a section`).toContain(r.centre);
        expect(pairs, `${s.id}/${r.id}: the centre is mirrored`).not.toContain(`${r.centre}'`);
      }
    }
  });
  it.skipIf(!existsSync(bibleDir))('a reading\'s sections cover its book in order, without gaps or overlaps, and its groups whole sections', () => {
    for (const s of STRUCTURES) {
      const c = counts(s.book);
      for (const r of s.readings) {
        const at = `${s.id}/${r.id}`;
        expect(same(parseRef(r.sections[0].ref)!.start, { book: s.book, chapter: 1, verse: 1 }), `${at}: does not start at ${s.book} 1:1`).toBe(true);
        for (let i = 1; i < r.sections.length; i++) {
          const prev = r.sections[i - 1].ref, here = parseRef(r.sections[i].ref)!.start;
          expect(same(next(c, ends(c, prev)), here), `${at}: ${r.sections[i].ref} does not follow ${prev}`).toBe(true);
        }
        expect(next(c, ends(c, r.sections.at(-1)!.ref)), `${at}: does not reach the end of ${s.book}`).toBeNull();
        for (const g of r.groups ?? []) {
          const first = parseRef(g.ref)!.start, last = ends(c, g.ref);
          expect(r.sections.some((x) => same(parseRef(x.ref)!.start, first)), `${at}: group ${g.label} starts inside a section`).toBe(true);
          expect(r.sections.some((x) => same(ends(c, x.ref), last)), `${at}: group ${g.label} ends inside a section`).toBe(true);
        }
      }
    }
  });
  it.skipIf(!existsSync(bibleDir))('marker quotes are the BSB wording', () => {
    for (const s of STRUCTURES) {
      const b = bible(s.book);
      for (const m of s.markers) for (const q of m.quotes) {
        const loc = parseRef(q.ref)!.start;
        const text = b.chapters[loc.chapter - 1].find((v) => v.v === loc.verse)?.t ?? '';
        expect(text, `${s.id}/${m.id} at ${q.ref}`).toContain(q.quote);
      }
    }
  });
  it.skipIf(!existsSync(interlinearDir))('a marker\'s words stand together in each of its verses, and in no other verse of the book', () => {
    for (const s of STRUCTURES) {
      const found = new Map<string, string[]>();
      for (let ch = 1; ch <= bookOf(s.book)!.chapters; ch++) {
        const verses = JSON.parse(readFileSync(new URL(`${s.book}/${ch}.json`, interlinearDir), 'utf8')) as InterlinearVerse[];
        for (const v of verses) {
          const strongs = hebrewOrder(v.w).map((w) => w[4]);
          for (const m of s.markers) {
            if (!m.words) continue;
            const run = strongs.some((_, i) => m.words!.every((n, k) => strongs[i + k] === n));
            if (run) (found.get(m.id) ?? found.set(m.id, []).get(m.id)!).push(`${s.book}.${ch}.${v.v}`);
          }
        }
      }
      for (const m of s.markers.filter((x) => x.words)) {
        const quoted = m.quotes.map((q) => q.ref);
        expect(found.get(m.id) ?? [], `${s.id}/${m.id}`).toEqual(quoted);
      }
    }
  });
});
