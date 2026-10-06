// The shape of a book as its outlines read it: where each section lies along the book's verses, which one a verse
// is in, and which of the book's repeated words stand in a verse. Positions are verse counts from the book's start,
// so a strip drawn from them gives every verse the same width.
import { CHAPTER_END, contains, parseRef, type VerseLoc } from './refs';
import type { BookStructure, Ref, StructureMarker, StructureReading, StructureSection } from './types';

/** Verses before `loc` in its book, given the verses in each chapter. */
export function offset(counts: number[], loc: VerseLoc): number {
  let n = 0;
  for (let c = 1; c < loc.chapter; c++) n += counts[c - 1] ?? 0;
  return n + Math.min(loc.verse, counts[loc.chapter - 1] ?? loc.verse) - 1;
}

/** Where a passage lies: from the offset of its first verse to just past its last. */
export function extent(counts: number[], ref: Ref): { start: number; end: number } {
  const r = parseRef(ref)!;
  const end = r.end.verse === CHAPTER_END ? { ...r.end, verse: counts[r.end.chapter - 1] ?? 1 } : r.end;
  return { start: offset(counts, r.start), end: offset(counts, end) + 1 };
}

export const sectionAt = (r: StructureReading, loc: VerseLoc): StructureSection | undefined => r.sections.find((s) => contains(s.ref, loc));
export const groupAt = (r: StructureReading, loc: VerseLoc) => r.groups?.find((g) => contains(g.ref, loc));

/** The repeated words standing in a verse, and which of their verses it is ("the third of five"). */
export function markersAt(s: BookStructure, loc: VerseLoc): { m: StructureMarker; n: number }[] {
  return s.markers.flatMap((m) => {
    const n = m.quotes.findIndex((q) => contains(q.ref, loc));
    return n < 0 ? [] : [{ m, n }];
  });
}

/** A mirrored section's letter without its prime, so A and A' share a depth. */
export const pairBase = (p: string) => p.replace(/'+$/, '');

/** How deep a mirrored section stands: 0 for the outermost pair, rising to the centre. */
export function pairDepth(r: StructureReading, s: StructureSection): number {
  const bases = [...new Set(r.sections.flatMap((x) => (x.pair ? [pairBase(x.pair)] : [])))].sort();
  return s.pair ? bases.indexOf(pairBase(s.pair)) : -1;
}
