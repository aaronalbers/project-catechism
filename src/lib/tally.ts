// A tally as the reader draws it: one bar per group on a shared scale, filled once its verse is read.
import { compareLoc, contains, parseRef, type VerseLoc } from './refs';
import type { Tally, TallyRow } from './types';

/** The number a quote gives ("46,500" → 46500), or NaN when it holds none. */
export const quotedCount = (quote: string) => Number(quote.replace(/[^\d]/g, '') || NaN);

/** The longest bar, which every row is drawn against, so a bar never rescales as later rows appear. */
export const tallyMax = (t: Tally) => Math.max(...t.rows.map((r) => r.count));
export const tallySum = (t: Tally) => t.rows.reduce((n, r) => n + r.count, 0);

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
