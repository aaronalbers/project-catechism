// Chiastic structure as the reader draws it. A chiasm is "phrase-level" when every level quotes
// its words (laid out as a ladder inside the verse) and "passage-level" when its levels are verse
// ranges (drawn as a rail in the margin).
import { contains, parseRef, touchesChapter, type VerseLoc } from './refs';
import type { Chiasm, ChiasmLevel } from './types';

export const isPhrase = (c: Chiasm) => c.levels.every((l) => l.quote);

/** Nesting depth of level i: 0 for the outermost pair, rising to the centre. */
export const depth = (c: Chiasm, i: number) => Math.min(i, c.levels.length - 1 - i);
export const maxDepth = (c: Chiasm) => Math.floor((c.levels.length - 1) / 2);
/** The level that mirrors level i (itself for a lone centre). */
export const partner = (c: Chiasm, i: number) => c.levels.length - 1 - i;
/** Colour-mix percentage for a depth: outer levels faint, the centre full strength. */
export const tone = (c: Chiasm, i: number) => `${Math.round(35 + (65 * depth(c, i)) / Math.max(1, maxDepth(c)))}%`;

export interface Rung { level: ChiasmLevel; index: number }
export type Piece = { text: string; rung?: Rung };

/**
 * Splits a verse into the quoted levels of `c` that fall in it and the prose around them,
 * in order. Returns null when a quote cannot be found where expected, so the verse falls back to
 * plain prose rather than a wrong layout.
 */
export function ladder(c: Chiasm, loc: VerseLoc, text: string): Piece[] | null {
  const rungs = c.levels.map((level, index) => ({ level, index })).filter(({ level }) => level.quote && contains(level.ref, loc));
  if (!rungs.length) return null;
  const pieces: Piece[] = [];
  let at = 0;
  for (const rung of rungs) {
    const start = text.indexOf(rung.level.quote!, at);
    if (start < 0) return null;
    if (text.slice(at, start).trim()) pieces.push({ text: text.slice(at, start).trim() });
    pieces.push({ text: rung.level.quote!, rung });
    at = start + rung.level.quote!.length;
  }
  if (text.slice(at).trim()) pieces.push({ text: text.slice(at).trim() });
  return pieces;
}

/** Index of the passage-level chiasm level containing a verse, or -1. */
export const levelAt = (c: Chiasm, loc: VerseLoc) => c.levels.findIndex((l) => contains(l.ref, loc));
export const levelTouches = (l: ChiasmLevel, book: string, chapter: number) => touchesChapter(l.ref, book, chapter);
export const levelStart = (l: ChiasmLevel) => parseRef(l.ref)?.start;
