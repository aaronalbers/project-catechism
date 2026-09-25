import booksJson from '@content/books.json';
import type { Book, Ref } from './types';

export const BOOKS: Book[] = booksJson as Book[];
const byId = new Map(BOOKS.map((b) => [b.id, b]));
const indexOf = new Map(BOOKS.map((b, i) => [b.id, i]));
const byName = new Map(BOOKS.flatMap((b) => [[b.name.toLowerCase(), b], [(b.bsbName ?? b.name).toLowerCase(), b], [b.id.toLowerCase(), b]]));

// Common abbreviations accepted by the "Go to" box, in addition to full names, OSIS ids and unambiguous prefixes.
const ABBREV: Record<string, string> = {
  gn: 'Gen', ex: 'Exod', lv: 'Lev', nm: 'Num', nu: 'Num', dt: 'Deut', jos: 'Josh', jdg: 'Judg', jg: 'Judg', ru: 'Ruth', '1sa': '1Sam', '2sa': '2Sam', '1sm': '1Sam', '2sm': '2Sam',
  '1ki': '1Kgs', '2ki': '2Kgs', '1kg': '1Kgs', '2kg': '2Kgs', '1ch': '1Chr', '2ch': '2Chr', ezr: 'Ezra', ne: 'Neh', est: 'Esth', jb: 'Job', ps: 'Ps', psa: 'Ps', pss: 'Ps', pr: 'Prov', prv: 'Prov', ec: 'Eccl', qoh: 'Eccl',
  so: 'Song', ss: 'Song', sos: 'Song', cant: 'Song', is: 'Isa', je: 'Jer', jr: 'Jer', la: 'Lam', eze: 'Ezek', ezk: 'Ezek', da: 'Dan', dn: 'Dan', ho: 'Hos', joe: 'Joel', jl: 'Joel', am: 'Amos', ob: 'Obad', jon: 'Jonah', jnh: 'Jonah',
  mi: 'Mic', mc: 'Mic', na: 'Nah', hb: 'Hab', zep: 'Zeph', zp: 'Zeph', hg: 'Hag', zec: 'Zech', zc: 'Zech', ml: 'Mal',
  mt: 'Matt', mk: 'Mark', mr: 'Mark', lk: 'Luke', jn: 'John', jhn: 'John', ac: 'Acts', ro: 'Rom', rm: 'Rom', '1co': '1Cor', '2co': '2Cor', ga: 'Gal', ep: 'Eph', php: 'Phil', pp: 'Phil', co: 'Col', cl: 'Col',
  '1th': '1Thess', '2th': '2Thess', '1ti': '1Tim', '2ti': '2Tim', '1tm': '1Tim', '2tm': '2Tim', tit: 'Titus', ti: 'Titus', phm: 'Phlm', pm: 'Phlm', he: 'Heb', hb2: 'Heb', jas: 'Jas', jm: 'Jas',
  '1pe': '1Pet', '2pe': '2Pet', '1pt': '1Pet', '2pt': '2Pet', '1jn': '1John', '2jn': '2John', '3jn': '3John', '1jo': '1John', '2jo': '2John', '3jo': '3John', jud: 'Jude', jd: 'Jude', re: 'Rev', rv: 'Rev',
};

export function book(id: string): Book | undefined { return byId.get(id); }
/** A book's position in the canon, or -1 for an unknown id. */
export function bookIndex(id: string): number { return indexOf.get(id) ?? -1; }
export function bookByName(name: string): Book | undefined {
  const key = name.trim().toLowerCase().replace(/\.$/, '');
  return byName.get(key) ?? byName.get(key.replace(/^([1-3]) /, '$1')) ?? byId.get(ABBREV[key.replace(/\s+/g, '')] ?? '');
}

export interface VerseLoc { book: string; chapter: number; verse: number }

/** The most verses any chapter has (Psalm 119). */
export const LONGEST_CHAPTER = 176;
/**
 * The verse a whole-chapter ref ("Matt.1") ends at. Refs are parsed without the Bible's verse counts,
 * so this only has to be past the last verse of any chapter; it must stay below 1000, the verse's
 * share of `key`'s ordering.
 */
export const CHAPTER_END = 999;
export interface RefRange { start: VerseLoc; end: VerseLoc }

function parseLoc(s: string, fallback?: VerseLoc): VerseLoc | null {
  const parts = s.split('.');
  const b = byId.get(parts[0]);
  if (!b) {
    // "5" or "1.5" relative to fallback (used in ranges like Gen.1.1-3).
    if (!fallback) return null;
    if (parts.length === 1) return { ...fallback, verse: +parts[0] };
    return { book: fallback.book, chapter: +parts[0], verse: +parts[1] };
  }
  return { book: b.id, chapter: +(parts[1] ?? 1), verse: +(parts[2] ?? 1) };
}

const isWholeChapter = (ref: Ref) => ref.split('-')[0].split('.').length === 2;

/** Parses "Matt.1.1", "Matt.1.1-Matt.1.5", "Matt.1.1-5", "Matt.1" (whole chapter) and "Gen.1-2" (whole chapters). */
export function parseRef(ref: Ref): RefRange | null {
  const [a, b] = ref.split('-');
  const start = parseLoc(a);
  if (!start) return null;
  if (!isWholeChapter(ref)) return { start, end: b ? parseLoc(b, start) ?? start : start };
  if (!b) return { start, end: { ...start, verse: CHAPTER_END } };
  // After a whole chapter, a bare number is the last chapter, not a verse ("Gen.1-2"), and so is "Gen.3".
  const parts = b.split('.');
  const end = parts.length === 1 ? { ...start, chapter: +b } : parseLoc(b, start) ?? start;
  const toChapterEnd = parts.length === 1 || (parts.length === 2 && byId.has(parts[0]));
  return { start, end: toChapterEnd ? { ...end, verse: CHAPTER_END } : end };
}

export function formatRef(ref: Ref): string {
  const r = parseRef(ref);
  if (!r) return ref;
  const b = byId.get(r.start.book)?.name ?? r.start.book;
  if (isWholeChapter(ref) && r.end.verse === CHAPTER_END && r.end.book === r.start.book) return r.end.chapter === r.start.chapter ? `${b} ${r.start.chapter}` : `${b} ${r.start.chapter}-${r.end.chapter}`;
  const s = `${b} ${r.start.chapter}:${r.start.verse}`;
  if (r.start.book === r.end.book && r.start.chapter === r.end.chapter && r.start.verse === r.end.verse) return s;
  if (r.start.book === r.end.book && r.start.chapter === r.end.chapter) return `${s}-${r.end.verse}`;
  if (r.start.book === r.end.book) return `${s}-${r.end.chapter}:${r.end.verse}`;
  return `${s} - ${byId.get(r.end.book)?.name} ${r.end.chapter}:${r.end.verse}`;
}

export function toRef(loc: VerseLoc): Ref { return `${loc.book}.${loc.chapter}.${loc.verse}`; }

function key(loc: VerseLoc): number {
  return bookIndex(loc.book) * 1_000_000 + loc.chapter * 1000 + loc.verse;
}

/** Orders two verses by canonical position: negative if `a` comes first. */
export function compareLoc(a: VerseLoc, b: VerseLoc): number { return key(a) - key(b); }

export function contains(ref: Ref, loc: VerseLoc): boolean {
  const r = parseRef(ref);
  if (!r) return false;
  const k = key(loc);
  return k >= key(r.start) && k <= key(r.end);
}

/** True if any verse of `ref` falls within the given chapter. */
export function touchesChapter(ref: Ref, bookId: string, chapter: number): boolean {
  const r = parseRef(ref);
  if (!r) return false;
  const a = key({ book: bookId, chapter, verse: 0 });
  const b = key({ book: bookId, chapter, verse: CHAPTER_END });
  return key(r.start) <= b && key(r.end) >= a;
}

export function sameLoc(a: VerseLoc, b: VerseLoc): boolean {
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

/** Route hash: #/Matt/1/1 */
export function locFromHash(hash: string): VerseLoc | null {
  const m = /^#\/([1-3]?[A-Za-z]+)(?:\/(\d+))?(?:\/(\d+))?/.exec(hash);
  if (!m || !byId.has(m[1])) return null;
  return { book: m[1], chapter: +(m[2] ?? 1), verse: +(m[3] ?? 1) };
}
export function hashFromLoc(loc: VerseLoc): string { return `#/${loc.book}/${loc.chapter}/${loc.verse}`; }
