// Who each name names, from TIPNR (scripts/people.mjs, built into public/data/ by build-data.mjs).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { personShard } from '@/lib/data';
import { PEOPLE } from '@/lib/content';
import { contains, parseRef } from '@/lib/refs';
import type { BiblePerson, InterlinearVerse, PeopleInBook, SpeakersInBook } from '@/lib/types';

const data = new URL('../../public/data/', import.meta.url);
const files = new Map<string, unknown>();
const read = <T>(path: string): T => (files.get(path) ?? files.set(path, JSON.parse(readFileSync(new URL(path, data), 'utf8'))).get(path)) as T;
const person = (id: string) => read<Record<string, BiblePerson>>(`people/${personShard(id)}.json`)[id];
/** The words of a verse, as [gloss, person id]. */
const names = (book: string, ch: number, v: number) => read<InterlinearVerse[]>(`interlinear/${book}/${ch}.json`).find((x) => x.v === v)!.w.map((w) => [w[5], w[10]]);
const tagged = (book: string, ch: number, v: number, gloss: string) => names(book, ch, v).filter(([g]) => g === gloss).map(([, id]) => id);

describe.skipIf(!existsSync(new URL('people/', data)))('people', () => {
  it('tells namesakes in one verse apart by their order in the original', () => {
    // "In the second year of Jehoash son of Jehoahaz king of Israel, Amaziah son of Joash king of Judah began to reign."
    expect(tagged('2Kgs', 14, 1, 'of Jehoash')).toEqual(['H3101J']);
    expect(tagged('2Kgs', 14, 1, 'of Joash')).toEqual(['H3101I']);
    expect(person('H3101J').refs).toContain('2Kgs.14.1');
    expect(person('H3101I').refs).toContain('2Kgs.14.1');
  });
  it('links every name a person goes by to them', () => {
    expect(tagged('Gen', 32, 28, 'Jacob')).toEqual(['H3478']);
    expect(tagged('Gen', 32, 28, 'but Israel')).toEqual(['H3478']);
    expect(person('H3478').name).toBe('Jacob');
  });
  it('does not count a gentilic, or a tribe named for its ancestor, as the man', () => {
    expect(tagged('Num', 3, 41, 'the Levites')).toEqual([undefined]);
    expect(tagged('2Sam', 11, 3, 'the Hittite')).toEqual([undefined]);
    expect(tagged('Josh', 15, 12, 'of Judah')).toEqual([undefined]);
    expect(person('H3063G').refs).not.toContain('Josh.15.12');
    // In the genealogies he is the man.
    expect(tagged('Matt', 1, 2, 'Judah')).toEqual(['H3063G']);
  });
  it('keeps Cleopas apart from Alphaeus', () => {
    expect(tagged('Luke', 24, 18, 'Cleopas')).toEqual(['G2810']);
    expect(person('G2810').name).toBe('Cleopas');
    expect(person('G0256').refs).not.toContain('Luke.24.18');
  });
  it('gives TIPNR’s kin, less the links the text does not make', () => {
    expect(person('H0175').father).toEqual([{ id: 'H6019G', name: 'Amram' }]);
    // TIPNR makes Nahash Jesse's wife and mother of his sons; 2 Samuel 17:25 names only Abigail her daughter.
    expect(person('H1732').mother).toBeUndefined();
    expect(person('H1732').father).toEqual([{ id: 'H3448', name: 'Jesse' }]);
    expect(person('H5176I').children?.map((k) => k.id)).toEqual(['H0026H']);
    expect(person('H5176I').spouses).toBeUndefined();
    // Luke 3:23 makes Joseph "son of Heli", not Mary.
    expect(person('G3137G').father).toBeUndefined();
    expect(person('G3137G').title).toBe('wife of Joseph');
    // Daniel 9:1 makes Darius the Mede "son of Ahasuerus"; Ezra 4 does not make Artaxerxes one.
    expect(person('H1867I').father).toEqual([{ id: 'H0325', name: 'Ahasuerus' }]);
    expect(person('H0783A').father).toBeUndefined();
  });
  it('ties each curated family-tree entry to a person of that name', () => {
    const wrong: string[] = [];
    for (const p of PEOPLE) {
      if (!p.tipnr) continue;
      const q = person(p.tipnr);
      // The curated tree writes a second name in brackets ("Abijah (Abijam)"), and spells some otherwise (Jakin,
      // TIPNR's Jachin): a spelling apart, they must share a verse.
      const names = p.name.split(/[()]/).map((n) => n.trim().toLowerCase()).filter(Boolean);
      const named = q && [q.name, ...(q.also ?? [])].some((n) => names.includes(n.toLowerCase()));
      const shared = q && p.refs.some((r) => q.refs.some((ref) => contains(r, parseRef(ref)!.start)));
      if (!named && !shared) wrong.push(`${p.id} → ${p.tipnr} ${q?.name ?? 'missing'}`);
    }
    expect(wrong).toEqual([]);
  });
  it('agrees with itself: every tag is in the book’s list and the person’s verses, and every kin resolves', () => {
    const problems: string[] = [];
    for (const book of ['Gen', '1Chr', 'Matt', 'Acts']) {
      const byBook = read<PeopleInBook>(`people/by-book/${book}.json`);
      const chapters = Object.keys(byBook.verses).map((k) => +k.split('.')[0]);
      for (let ch = 1; ch <= Math.max(...chapters); ch++) {
        for (const v of read<InterlinearVerse[]>(`interlinear/${book}/${ch}.json`)) for (const w of v.w) {
          const id = w[10];
          if (!id) continue;
          if (!byBook.verses[`${ch}.${v.v}`]?.includes(id)) problems.push(`${book} ${ch}:${v.v} ${w[5]} → ${id} not listed`);
          const p = person(id);
          if (!p?.refs.includes(`${book}.${ch}.${v.v}`)) problems.push(`${book} ${ch}:${v.v} ${w[5]} → ${id} lacks the verse`);
          for (const k of [...(p?.father ?? []), ...(p?.mother ?? []), ...(p?.spouses ?? []), ...(p?.children ?? []), ...(p?.siblings ?? [])]) {
            if (k.id && !person(k.id)) problems.push(`${id} → kin ${k.id} missing`);
          }
        }
      }
    }
    expect([...new Set(problems)].slice(0, 20)).toEqual([]);
  });
});

// Who speaks each verse, from Glyssen (scripts/speakers.mjs), with the TIPNR person each single speaker is.
describe.skipIf(!existsSync(new URL('speakers/', data)))('speakers', () => {
  const at = (book: string, ch: number, v: number) => read<SpeakersInBook>(`speakers/${book}.json`)[`${ch}.${v}`] ?? [];
  const who = (book: string, ch: number, v: number) => at(book, ch, v).map((s) => s.p ?? s.n);
  it('names both sides of a dialogue, and links them', () => {
    expect(who('Gen', 22, 7)).toEqual(['H0085', 'H3327']); // Isaac asks, Abraham answers
    expect(who('Matt', 26, 25)).toEqual(['G2424G', 'G2455H']); // "Surely not I, Rabbi?"
    expect(who('Job', 4, 2)).toEqual(['H0464H']);
    expect(who('Luke', 1, 46)).toEqual(['G3137G']);
  });
  it('carries a speaker through chapters that do not name them, and past a namesake', () => {
    expect(who('Jer', 20, 7)).toEqual(['H3414L']);
    expect(who('Neh', 4, 4)).toEqual(['H5166H']); // not Nehemiah son of Azbuk, named in 3:16
  });
  it('links no one the text does not name as the speaker', () => {
    expect(at('Num', 21, 17).some((s) => s.p)).toBe(false); // Israel singing, not Jacob
    expect(at('Mark', 6, 37).find((s) => s.n.startsWith('disciples'))?.p).toBeUndefined(); // not Herod's brother Philip
    expect(at('John', 21, 7).some((s) => s.p)).toBe(false); // the disciple whom Jesus loved, never named
    expect(at('Josh', 5, 14).map((s) => s.p).filter(Boolean)).toEqual(['H3091G']); // Joshua; not the commander
    expect(at('Exod', 2, 19).some((s) => s.p)).toBe(false); // Jethro's daughters, cast as Zipporah
    expect(at('Josh', 17, 14).some((s) => s.p)).toBe(false); // "the people of Joseph"
  });
  it('leaves the psalmist to the heading, and gives the Song of Songs its voices', () => {
    expect(who('Ps', 23, 1)).toEqual([]); // David's own voice, credited by the heading
    expect(who('Ps', 3, 2)).toEqual(["David's foes, many"]); // "Many say of me…"
    expect(who('Ps', 82, 2)).toEqual(['God']);
    expect(who('Song', 1, 9)).toEqual(['H8010']);
  });
  it('links only to people the people data has', () => {
    const missing = new Set<string>();
    for (const book of ['Gen', 'Judg', '2Sam', 'Jer', 'Luke', 'John', 'Acts', 'Rev']) {
      for (const list of Object.values(read<SpeakersInBook>(`speakers/${book}.json`))) for (const s of list) if (s.p && !person(s.p)) missing.add(s.p);
    }
    expect([...missing]).toEqual([]);
  });
});
