// The alphabet poems are a claim about the Hebrew: each letter must be the first letter of the word named, in the
// verse named, and that word must begin its verse (or, in Psalms 111 and 112, its line).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ACROSTICS } from '@/lib/content';
import { ALPHABET, consonants, hebrewOrder, letterNumber } from '@/lib/acrostic';
import { compareLoc, contains, parseRef, type VerseLoc } from '@/lib/refs';
import type { Acrostic, InterlinearVerse, InterlinearWord } from '@/lib/types';

const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);
const interlinearDir = new URL('../../public/data/interlinear/', import.meta.url);
const chapters = new Map<string, InterlinearVerse[]>();
const verse = (loc: VerseLoc) => {
  const key = `${loc.book}/${loc.chapter}`;
  if (!chapters.has(key)) chapters.set(key, JSON.parse(readFileSync(new URL(`${key}.json`, interlinearDir), 'utf8')));
  return chapters.get(key)!.find((v) => v.v === loc.verse)!;
};
const words = (loc: VerseLoc) => hebrewOrder(verse(loc).w);
const at = (ref: string) => parseRef(ref)!.start;
const present = (a: Acrostic) => a.letters.filter((l) => l.ref);
/** Every verse of a poem, in order. */
const versesOf = (a: Acrostic): VerseLoc[] => {
  const r = parseRef(a.ref)!, out: VerseLoc[] = [];
  for (let ch = r.start.chapter; ch <= r.end.chapter; ch++) {
    const vs = JSON.parse(readFileSync(new URL(`${r.start.book}/${ch}.json`, interlinearDir), 'utf8')) as InterlinearVerse[];
    for (const v of vs) { const loc = { book: r.start.book, chapter: ch, verse: v.v }; if (contains(a.ref, loc)) out.push(loc); }
  }
  return out;
};
const ATNACH = '֑', REVIA = '֗';
const has = (w: InterlinearWord, accent: string) => w[0].normalize('NFD').includes(accent);

describe('alphabet poems', () => {
  it('cite evidence, and name who holds an interpretation', () => {
    for (const a of ACROSTICS) {
      expect(a.sources.some((s) => evidential.has(s.kind)), `${a.id} has no evidential source`).toBe(true);
      if (a.confidence === 'interpretation') expect(a.traditions?.length, `${a.id} lists no traditions`).toBeGreaterThan(0);
    }
  });
  it('have every letter once, in the alphabet\'s order unless marked swapped', () => {
    for (const a of ACROSTICS) {
      const main = a.letters.filter((l) => !l.extra);
      expect(main.map((l) => l.letter).sort(), a.id).toEqual(ALPHABET.map((x) => x.letter).sort());
      main.forEach((l, i) => expect(!!l.swapped, `${a.id} ${l.letter}: ${l.swapped ? 'marked swapped but in order' : 'out of order'}`).toBe(letterNumber(l.letter) !== i + 1));
      for (const l of a.letters) {
        expect(!l.missing === !!l.ref, `${a.id} ${l.letter}: a missing letter has no verse, and any other has one`).toBe(true);
        if (l.missing) expect(l.word, `${a.id} ${l.letter}`).toBeUndefined();
      }
    }
  });
  it('place each letter in one verse of the poem, in order', () => {
    for (const a of ACROSTICS) {
      const ls = present(a);
      for (const l of ls) {
        const r = parseRef(l.ref!)!;
        expect(r.start, `${a.id} ${l.letter}: one verse`).toEqual(r.end);
        expect(contains(a.ref, r.start), `${a.id} ${l.letter}: ${l.ref} is outside ${a.ref}`).toBe(true);
      }
      for (let i = 1; i < ls.length; i++) {
        const c = compareLoc(at(ls[i - 1].ref!), at(ls[i].ref!));
        if (a.by === 'line') expect(c < 0 || (c === 0 && (ls[i].at ?? 0) > (ls[i - 1].at ?? 0)), `${a.id} ${ls[i].letter}: out of order`).toBe(true);
        else expect(c, `${a.id} ${ls[i].letter}: shares or precedes ${ls[i - 1].letter}'s verse`).toBeLessThan(0);
      }
    }
  });

  it.skipIf(!existsSync(interlinearDir))('are the Hebrew: each word is where it is said to be and begins with its letter', () => {
    for (const a of ACROSTICS) for (const l of present(a)) {
      const loc = at(l.ref!), ws = words(loc), i = l.at ?? 0, w = ws[i];
      expect(w && consonants(w[0]), `${a.id} ${l.letter} at ${l.ref}: word ${i}`).toBe(consonants(l.word!));
      const c = consonants(w[0]);
      expect(l.and ? c.slice(0, 2) : c[0], `${a.id} ${l.ref}: ${l.word}`).toBe(l.and ? `ו${l.letter}` : l.letter);
      if (a.by === 'line') {
        // A line begins the verse, follows its main divider (atnach), or, in a three-line verse, a revia before it.
        const divider = ws.findIndex((x) => has(x, ATNACH));
        const opensLine = i === 0 || i === divider + 1 || (i < divider && has(ws[i - 1], REVIA));
        expect(opensLine || !!l.after, `${a.id} ${l.ref}: ${l.word} does not open a line`).toBe(true);
      } else expect(i === 0 || !!l.after, `${a.id} ${l.ref}: ${l.word} is not the verse's first word, and nothing says what comes before it`).toBe(true);
    }
  });
  it.skipIf(!existsSync(interlinearDir))('give every verse of a verse acrostic a letter, and every verse of a stanza its letter when it says so', () => {
    for (const a of ACROSTICS.filter((x) => x.by === 'verse')) {
      const lettered = new Set(present(a).map((l) => l.ref));
      for (const loc of versesOf(a)) expect(lettered.has(`${loc.book}.${loc.chapter}.${loc.verse}`), `${a.id}: ${loc.chapter}:${loc.verse} has no letter`).toBe(true);
    }
    for (const a of ACROSTICS.filter((x) => x.every)) {
      const ls = present(a);
      for (const loc of versesOf(a)) {
        const l = ls.filter((x) => compareLoc(at(x.ref!), loc) <= 0).at(-1)!;
        expect(consonants(words(loc)[0][0])[0], `${a.id} ${loc.chapter}:${loc.verse} should begin with ${l.letter}`).toBe(l.letter);
      }
    }
  });
  it.skipIf(!existsSync(interlinearDir))('mark a letter missing only where no verse between its neighbours begins with it', () => {
    for (const a of ACROSTICS.filter((x) => x.by !== 'line')) {
      const all = versesOf(a);
      a.letters.forEach((l, i) => {
        if (!l.missing) return;
        const before = a.letters.slice(0, i).filter((x) => x.ref).at(-1), after = a.letters.slice(i).find((x) => x.ref);
        const between = all.filter((loc) => (!before || compareLoc(loc, at(before.ref!)) > 0) && (!after || compareLoc(loc, at(after.ref!)) < 0));
        for (const loc of between) expect(consonants(words(loc)[0][0])[0], `${a.id}: ${loc.chapter}:${loc.verse} begins with ${l.letter}`).not.toBe(l.letter);
      });
    }
  });
  it.skipIf(!existsSync(interlinearDir))('quote the BSB\'s footnotes word for word', () => {
    for (const a of ACROSTICS) for (const s of a.sources) {
      const quoted = /^BSB footnote: “(.*)”$/.exec(s.note ?? '')?.[1];
      if (!quoted) continue;
      expect(verse(at(s.ref!)).f ?? [], `${a.id}: ${s.ref}`).toContain(quoted);
    }
  });
});
