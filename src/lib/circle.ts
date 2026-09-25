// Geometry for the whole-Bible link circle: every verse has a place on the circumference, in
// canonical order clockwise from the top, with a small gap between books and a wider one
// between the testaments.
import { book, parseRef, type VerseLoc } from './refs';
import type { Ref } from './types';

/** public/data/circle.json: chapters = [bookId, verse count per chapter][], xrefs = flat [a, b, votes] running verse indices. */
export interface CircleData { minVotes: number; chapters: [string, number[]][]; xrefs: number[] }

const BOOK_GAP = 40; // in verse-widths
const TESTAMENT_GAP = 400;

export interface Canon {
  total: number;
  books: { id: string; start: number; end: number; nt: boolean }[];
  /** Running index of a verse, clamped into its chapter; undefined for an unknown book. */
  indexOf(loc: VerseLoc): number | undefined;
  locAt(i: number): VerseLoc;
  /** Angle in radians, 0 = 12 o'clock, increasing clockwise. */
  angle(i: number): number;
  /** Running index of the verse nearest an angle, or undefined inside a gap. */
  atAngle(a: number): number | undefined;
  chapterRange(book: string, chapter: number): [number, number] | undefined;
}

export function buildCanon(chapters: CircleData['chapters']): Canon {
  const books: Canon['books'] = [];
  const chStart = new Map<string, number[]>(); // book -> running index of each chapter's first verse, plus one past the end
  let n = 0;
  for (const [id, counts] of chapters) {
    const starts = [n];
    for (const c of counts) starts.push((n += c ?? 0));
    chStart.set(id, starts);
    books.push({ id, start: starts[0], end: n, nt: book(id)?.testament === 'NT' });
  }
  // Positions along the circle in verse-widths, gaps included; half the testament gap sits at the top.
  const offset = books.map((b, i) => TESTAMENT_GAP / 2 + i * BOOK_GAP + (b.nt ? TESTAMENT_GAP : 0));
  const span = n + (books.length - 1) * BOOK_GAP + 2 * TESTAMENT_GAP;
  const bookAt = (i: number) => { let lo = 0, hi = books.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (books[m].start <= i) lo = m; else hi = m - 1; } return lo; };

  return {
    total: n,
    books,
    indexOf(loc) {
      const s = chStart.get(loc.book);
      if (!s) return undefined;
      const c = Math.min(Math.max(loc.chapter, 1), s.length - 1);
      return Math.min(s[c - 1] + Math.max(loc.verse, 1) - 1, s[c] - 1);
    },
    locAt(i) {
      const b = books[bookAt(i)], s = chStart.get(b.id)!;
      let c = 0;
      while (s[c + 1] <= i) c++;
      return { book: b.id, chapter: c + 1, verse: i - s[c] + 1 };
    },
    angle(i) { return (2 * Math.PI * (i + 0.5 + offset[bookAt(i)])) / span; },
    atAngle(a) {
      const p = (((a / (2 * Math.PI)) % 1 + 1) % 1) * span;
      for (let k = 0; k < books.length; k++) {
        const i = p - offset[k];
        if (i >= books[k].start && i < books[k].end) return Math.floor(i);
      }
      return undefined;
    },
    chapterRange(book, chapter) { const s = chStart.get(book); return s && chapter >= 1 && chapter < s.length ? [s[chapter - 1], s[chapter]] : undefined; },
  };
}

/** Where a ref sits on the circle: the start of its range. */
export function refIndex(canon: Canon, ref: Ref): number | undefined {
  const r = parseRef(ref);
  return r ? canon.indexOf(r.start) : undefined;
}
