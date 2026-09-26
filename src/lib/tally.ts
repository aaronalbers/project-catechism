// A tally as the reader draws it: one bar per group on a shared scale, filled once its verse is read.
import { TALLIES } from './content';
import { book, compareLoc, contains, parseRef, type VerseLoc } from './refs';
import type { Tally, TallyGroup, TallyRow } from './types';

/** The number a quote gives ("46,500" → 46500), or NaN when it holds none. */
export const quotedCount = (quote: string) => Number(quote.replace(/[^\d]/g, '') || NaN);

/** The earlier tally `t` is compared with, if any. */
export const comparedWith = (t: Tally) => (t.compare ? TALLIES.find((x) => x.id === t.compare) : undefined);
/** The same group in the earlier tally. */
export const earlierRow = (t: Tally, row: TallyRow) => comparedWith(t)?.rows.find((r) => r.label === row.label);
/** A tally's short name for the reader: the book and chapter it opens in ("Numbers 1"). */
export function tallyPlace(t: Tally) {
  const r = parseRef(t.ref);
  return r ? `${book(r.start.book)?.name ?? r.start.book} ${r.start.chapter}` : t.ref;
}

/**
 * The longest bar, which every row is drawn against, so a bar never rescales as later rows appear;
 * with a comparison, the longest of either list, so the earlier figures fit behind.
 */
export const tallyMax = (t: Tally) => Math.max(...[...t.rows, ...(comparedWith(t)?.rows ?? [])].map((r) => r.count));
export const tallySum = (t: Tally) => t.rows.reduce((n, r) => n + r.count, 0);

/** A group's rows, in the tally's order. */
export const groupRows = (t: Tally, g: TallyGroup) => t.rows.filter((r) => g.members.includes(r.label));
/** The largest group, which every group's stacked bar is drawn against. */
export const groupMax = (t: Tally) => Math.max(...(t.groups ?? []).map((g) => g.count));
/** The group a row belongs to, if any. */
export const groupOf = (t: Tally, row: TallyRow) => t.groups?.find((g) => g.members.includes(row.label));

/** The rows in one verse. */
export const rowsAt = (t: Tally, loc: VerseLoc) => t.rows.filter((r) => contains(r.ref, loc));

/**
 * Whether a row is filled at `loc`: inside the passage once its verse is reached, and everywhere
 * outside it, where the tally is shown whole.
 */
export function rowReached(t: Tally, row: TallyRow, loc: VerseLoc): boolean {
  if (!contains(t.ref, loc)) return true;
  const r = parseRef(row.ref);
  return !!r && compareLoc(r.start, loc) <= 0;
}
