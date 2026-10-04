// Where the English books sit in the Hebrew Bible's twenty-four: which ones were one book (Samuel) or shared one
// scroll (the Twelve), so the reader can mark a break the Hebrew does not have, and the Scrolls tab can lay the
// Hebrew, Greek and English divisions over the same stretch of text.
import { SCROLLS } from './content';
import { book, contains, parseRef, type VerseLoc } from './refs';
import type { HebrewBook, Ref, ScrollOverlap } from './types';

export const HEBREW = SCROLLS.hebrew;
const byBook = new Map(HEBREW.flatMap((h) => h.books.map((b) => [b, h] as const)));

/** The Hebrew book (or scroll) an English book is part of; none for the New Testament and the books beyond the 66. */
export const hebrewOf = (id: string): HebrewBook | undefined => byBook.get(id);

/** A break between two English books that fall in one Hebrew book or scroll. */
export interface Seam { h: HebrewBook; from: string; to: string }
/** The seam an English book opens with (2 Samuel, after 1 Samuel), if the Hebrew runs on into it. */
export function seamBefore(id: string): Seam | null {
  const h = hebrewOf(id), i = h?.books.indexOf(id) ?? -1;
  return h && i > 0 ? { h, from: h.books[i - 1], to: id } : null;
}
/** The seam an English book closes on (1 Samuel, before 2 Samuel), if the Hebrew runs on past it. */
export function seamAfter(id: string): Seam | null {
  const h = hebrewOf(id), i = h?.books.indexOf(id) ?? -1;
  return h && i >= 0 && i < h.books.length - 1 ? { h, from: id, to: h.books[i + 1] } : null;
}
/** The seams in a chapter: before its first verse (in chapter 1), after its last (in the book's last chapter). */
export function seamsInChapter(id: string, chapter: number): { before: Seam | null; after: Seam | null } {
  return { before: chapter === 1 ? seamBefore(id) : null, after: chapter === book(id)?.chapters ? seamAfter(id) : null };
}

/** How many seams and overlaps a chapter holds, for the tab's count. */
export function scrollMarksInChapter(id: string, chapter: number): number {
  const { before, after } = seamsInChapter(id, chapter);
  return +!!before + +!!after + overlapsInChapter(id, chapter).length;
}

/** An overlap seen from one of its ends: `here` is the passage at `loc`, `there` the same words in the other book. */
export interface OverlapEnd { o: ScrollOverlap; here: Ref; there: Ref }
export function overlapsAt(loc: VerseLoc): OverlapEnd[] {
  return SCROLLS.overlaps.flatMap((o) => contains(o.a, loc) ? [{ o, here: o.a, there: o.b }] : contains(o.b, loc) ? [{ o, here: o.b, there: o.a }] : []);
}
/** The overlaps a chapter holds either end of. */
export function overlapsInChapter(id: string, chapter: number): OverlapEnd[] {
  return SCROLLS.overlaps.flatMap((o) => [{ o, here: o.a, there: o.b }, { o, here: o.b, there: o.a }]).filter((e) => {
    const r = parseRef(e.here);
    return r?.start.book === id && r.start.chapter === chapter;
  });
}
/** The overlaps touching a Hebrew book, from its side. */
export const overlapsOf = (h: HebrewBook): OverlapEnd[] =>
  SCROLLS.overlaps.flatMap((o) => [{ o, here: o.a, there: o.b }, { o, here: o.b, there: o.a }]).filter((e) => h.books.includes(parseRef(e.here)!.start.book));

/** The name the Greek gives a book, where it differs from the English one. */
export const greekName = (id: string): string | undefined => SCROLLS.greek[id];

/** A run of verses in a strip row: [start, end) in verses from the start of the Hebrew book. `books` are the English
 *  books a Greek span covers when it covers more than one (Esdras B: Ezra and Nehemiah). */
export interface Span { label: string; start: number; end: number; book: string; chapter?: number; books?: string[] }
export interface Strip {
  total: number;
  hebrew: Span; greek: Span[] | null; english: Span[]; chapters: Span[];
  /** Verses from the start of the Hebrew book to `loc`, or null when `loc` is outside it. */
  at: number | null;
}

/**
 * The strip for a Hebrew book: one span for the Hebrew, the English books, the Greek ones where the Greek
 * named them otherwise (Kingdoms, Paraleipomena; English books the Greek keeps as one share a span), and the
 * chapters, sized by `verses` (per chapter, by book).
 */
export function strip(h: HebrewBook, verses: Map<string, number[]>, loc: VerseLoc): Strip {
  const english: Span[] = [], chapters: Span[] = [];
  let n = 0, at: number | null = null;
  for (const id of h.books) {
    const counts = verses.get(id) ?? [];
    const start = n;
    counts.forEach((c, k) => {
      if (loc.book === id && loc.chapter === k + 1) at = n + Math.min(Math.max(loc.verse, 1), c) - 1;
      chapters.push({ label: `${book(id)?.name ?? id} ${k + 1}`, start: n, end: (n += c), book: id, chapter: k + 1 });
    });
    english.push({ label: book(id)?.name ?? id, start, end: n, book: id });
  }
  const greek = h.books.some((id) => greekName(id)) ? english.reduce<Span[]>((out, s) => {
    const label = greekName(s.book) ?? s.label, last = out.at(-1);
    if (last?.label === label) { last.end = s.end; last.books = [...(last.books ?? [last.book]), s.book]; } else out.push({ ...s, label });
    return out;
  }, []) : null;
  return { total: n, hebrew: { label: h.name, start: 0, end: n, book: h.books[0] }, greek, english, chapters, at };
}
