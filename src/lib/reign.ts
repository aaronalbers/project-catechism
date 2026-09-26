// The divided kingdoms as the reader charts them: a lane of reigns for each kingdom on one time axis, in
// Thiele's reconstruction or with every reign laid end to end at the length Kings states.
import type { ReignDates } from '@/app/store';
import { KINGS, MONARCHY } from './content';
import { compareLoc, contains, parseRef, type VerseLoc } from './refs';
import type { Kingdom, MonarchyAnchor, ReadingDates, Verdict } from './types';

export type King = (typeof KINGS)[number];
/** A reading's id (Thiele's, or another reconstruction), or 'stated' for the stated lengths laid end to end. */
export type DateMode = ReignDates;
/** Which account is being read: Kings, or Chronicles, which tells Judah's kings with verdicts of its own. */
export type Account = 'kings' | 'chronicles';

export const KINGDOMS: Kingdom[] = ['israel', 'judah'];
export const KINGDOM_NAME: Record<Kingdom, string> = { israel: 'Israel', judah: 'Judah' };
export const kingById = new Map(KINGS.map((k) => [k.id, k]));
export const laneOf = (kingdom: Kingdom) => KINGS.filter((k) => k.reign.kingdom === kingdom);

const start = (ref: string) => parseRef(ref)!.start;
/** Where the chart for a king stands in an account, if that account tells his reign. */
export const chartRef = (k: King, account: Account) => (account === 'kings' ? k.reign.ref : k.reign.chronicles?.ref);

/** Where each reign starts with each kingdom's stated lengths laid end to end from the division. */
const STATED = new Map<string, number>();
for (const kingdom of KINGDOMS) {
  let y = MONARCHY.from;
  for (const k of laneOf(kingdom)) { STATED.set(k.id, y); y += k.reign.length.years; }
}
/** The stated years of a kingdom's reigns before a king's, from the division. */
export const statedBefore = (k: King) => STATED.get(k.id)! - MONARCHY.from;

export const READINGS = MONARCHY.readings;
/** The reading a mode names, or Thiele's for a mode no longer known (a stored choice, say); null for the stated lengths. */
export const readingOf = (mode: DateMode) => (mode === 'stated' ? null : READINGS.find((r) => r.id === mode) ?? READINGS[0]);
/** The label of a view, for the text: "Thiele’s dates", "the stated lengths". */
export const modeLabel = (mode: DateMode) => { const r = readingOf(mode); return r ? `${r.label}’s dates` : 'the stated lengths'; };

/** A king's years in a reading: Thiele's are the ruler's own, with his reign's overlap; the others carry their own. */
export function datesIn(k: King, mode: DateMode): ReadingDates | null {
  const r = readingOf(mode);
  if (!r) return null;
  return r.dates ? r.dates[k.id] : { from: k.from, to: k.to, overlap: k.reign.overlap };
}

/**
 * A reign's years on the axis (negative for BC). The reconstructions give whole years, so a reign that
 * begins and ends in the same one is drawn at its stated length, up to half a year.
 */
export function span(k: King, mode: DateMode): [number, number] {
  const d = datesIn(k, mode);
  if (!d) { const s = STATED.get(k.id)!; return [s, s + k.reign.length.years]; }
  return [d.from, d.to > d.from ? d.to : d.from + Math.min(k.reign.length.years, 0.5)];
}
/** The years a reign shares with another king's (a coregency or a rival reign): only the reconstructions have them. */
export const overlapSpan = (k: King, mode: DateMode): [number, number] | null => {
  const d = datesIn(k, mode);
  return d?.overlap ? [d.from, d.overlap.until] : null;
};

/** Every year either view can reach, so the overview keeps one scale as the view changes. */
export const DOMAIN: [number, number] = [MONARCHY.from, Math.max(-586, ...KINGS.map((k) => span(k, 'stated')[1]))];

/** Within this many years a reading meets a synchronism: its dates are whole years for half-year pairs, and a year may be counted two ways. */
const SYNC_SLACK = 2;
/**
 * A synchronism as the chart draws it: `at`, where the named year of the other king falls (year N is N − 1
 * years after his reign begins), and `to`, where this reign begins. As stated the two drift apart. A
 * reconstruction may count either king from his coregency or from his reign alone, so the closest pairing
 * is taken; if it meets the synchronism the line is drawn straight at `to`, and if not (`off`) it shows how
 * far out the reading is.
 */
export function synchronism(k: King, mode: DateMode): { other: King; at: number; to: number; off: boolean } | null {
  const s = k.reign.synchronism;
  const other = s && kingById.get(s.king);
  if (!s || !other) return null;
  const mine = datesIn(k, mode), theirs = datesIn(other, mode);
  if (!mine || !theirs) {
    const at = span(other, mode)[0] + s.year - 1, to = span(k, mode)[0];
    return { other, at, to, off: Math.abs(at - to) > SYNC_SLACK };
  }
  const starts = (d: ReadingDates) => [d.from, ...(d.overlap ? [d.overlap.until] : [])];
  let best = { at: 0, to: 0, gap: Infinity };
  for (const o of starts(theirs)) for (const t of starts(mine)) {
    const at = o + s.year - 1;
    if (Math.abs(at - t) < best.gap) best = { at, to: t, gap: Math.abs(at - t) };
  }
  return best.gap <= SYNC_SLACK ? { other, at: best.to, to: best.to, off: false } : { other, at: best.at, to: best.to, off: true };
}

/** The years shown round a king: his reign (and the synchronism) with room either side, at least 80 years. */
export function windowFor(k: King, mode: DateMode): [number, number] {
  let [lo, hi] = span(k, mode);
  const s = synchronism(k, mode);
  if (s) { lo = Math.min(lo, s.at); hi = Math.max(hi, s.at); }
  const mid = (lo + hi) / 2, half = Math.max((hi - lo) / 2 + 12, 40);
  let from = mid - half, to = mid + half;
  const [d0, d1] = [DOMAIN[0] - 4, DOMAIN[1] + 4];
  if (from < d0) { to += d0 - from; from = d0; }
  if (to > d1) { from -= to - d1; to = d1; }
  return [from, to];
}

/** The account being read at `loc`, if it is one the chart is drawn in. */
export function accountAt(loc: VerseLoc): Account | null {
  return contains(MONARCHY.kings, loc) ? 'kings' : contains(MONARCHY.chronicles, loc) ? 'chronicles' : null;
}

/**
 * Whether a king's bar is filled at `loc`: in an account, once the reader has reached his reign there
 * (Chronicles leaves Israel's kings out, so they are drawn throughout); elsewhere every bar is filled.
 */
export function reached(k: King, loc: VerseLoc): boolean {
  const account = accountAt(loc);
  const ref = account && chartRef(k, account);
  return !ref || compareLoc(start(ref), loc) <= 0;
}

/** The verdict an account gives a king; null where it does not tell his reign (Israel's kings in Chronicles). */
export const verdictIn = (k: King, account: Account): Verdict | null =>
  account === 'kings' ? k.reign.verdict : k.reign.chronicles?.verdict ?? null;

export type VerdictClass = 'right' | 'right-but' | 'evil' | 'evil-but' | 'none' | 'untold';
export const verdictClass = (v: Verdict | null): VerdictClass => (!v ? 'untold' : v.kind === 'none' ? 'none' : v.but ? `${v.kind}-but` : v.kind);
export const VERDICT_LABEL: Record<VerdictClass, string> = {
  right: 'Did right', 'right-but': 'Did right, but…', evil: 'Did evil', 'evil-but': 'Did evil, but…', none: 'No verdict', untold: 'Not told here',
};

/**
 * The reign being read at `loc`: in an account, the king whose chart the reader last passed there, and the
 * king of the other kingdom on the throne at his accession in the reconstruction; null outside both accounts.
 */
export function reignAt(loc: VerseLoc): { k: King; account: Account; beside: King | null } | null {
  const account = accountAt(loc);
  if (!account) return null;
  let k: King | null = null;
  for (const o of KINGS) {
    const ref = chartRef(o, account);
    if (ref && compareLoc(start(ref), loc) <= 0 && (!k || compareLoc(start(chartRef(k, account)!), start(ref)) < 0)) k = o;
  }
  if (!k) return null;
  const other = laneOf(k.reign.kingdom === 'israel' ? 'judah' : 'israel');
  const beside = [...other].reverse().find((o) => o.from <= k!.from && k!.from <= span(o, 'thiele')[1]) ?? null;
  return { k, account, beside };
}

/** The kings whose chart stands at a verse of this chapter, by verse. */
export function reignsInChapter(book: string, chapter: number): Map<number, { k: King; account: Account }> {
  const out = new Map<number, { k: King; account: Account }>();
  for (const k of KINGS) {
    for (const account of ['kings', 'chronicles'] as const) {
      const ref = chartRef(k, account);
      const at = ref && start(ref);
      if (at && at.book === book && at.chapter === chapter) out.set(at.verse, { k, account });
    }
  }
  return out;
}

/** How a kingdom counted its kings' years in a given year, in the reconstruction. */
export const reckoningAt = (kingdom: Kingdom, year: number) => MONARCHY.reckoning.find((r) => r.kingdom === kingdom && r.from <= year && year < r.to);

/** Whether each king a pin names reigns in its year in this view, give or take the year the reconstruction rounds. */
export const anchorFits = (a: MonarchyAnchor, mode: DateMode) =>
  a.kings.every((id) => { const k = kingById.get(id); if (!k) return false; const [s, e] = span(k, mode); return a.year >= s - 1 && a.year <= e + 1; });

/** The prophets active in a span of years, each given the first row where its band and name fit. */
export function prophetRows(from: number, to: number): { p: (typeof MONARCHY.prophets)[number]; row: number }[] {
  const label = (to - from) * 0.14; // room for a name, in years
  const ends: number[] = [];
  return MONARCHY.prophets.filter((p) => p.to >= from && p.from <= to).sort((a, b) => a.from - b.from).map((p) => {
    const left = Math.max(p.from, from);
    let row = ends.findIndex((e) => e < left);
    if (row < 0) { row = ends.length; ends.push(0); }
    ends[row] = Math.max(p.to, left + label);
    return { p, row };
  });
}

/** A kingdom's runs of kings of one house, in a view, for the band under Israel's lane. */
export function dynasties(kingdom: Kingdom, mode: DateMode): { name: string; from: number; to: number }[] {
  const runs: { name: string; from: number; to: number }[] = [];
  for (const k of laneOf(kingdom)) {
    if (!k.reign.dynasty) continue;
    const [s, e] = span(k, mode), last = runs[runs.length - 1];
    if (last?.name === k.reign.dynasty) last.to = Math.max(last.to, e);
    else runs.push({ name: k.reign.dynasty, from: s, to: e });
  }
  return runs;
}

/** A BC year for display, rounded: -873.6 → "874". */
export const bc = (y: number) => `${Math.round(-y)}`;
