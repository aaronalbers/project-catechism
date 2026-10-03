// A price as the reader draws it: what a sum the text names was worth in days of a labourer's wage, reckoned
// in the money of its own time, on one scale with every other sum in the Bible.
import { PRICES, WORTH } from './content';
import { book, compareLoc, contains, parseRef, sameLoc, touchesChapter, type VerseLoc } from './refs';
import type { MoneyEra, MoneyUnit, Price, PriceGood, PriceGoodKind, PriceSum } from './types';

const ERA_BY_ID = new Map(WORTH.eras.map((e) => [e.id, e]));
const GOOD_BY_ID = new Map(WORTH.goods.map((g) => [g.id, g]));
export const KIND_LABEL = Object.fromEntries(WORTH.kinds.map((k) => [k.id, k.label])) as Record<Price['kind'], string>;

/** The money a price is reckoned in: its own `era`, else its book's (the New Testament's, or one an era lists), else before the exile. */
export function eraOf(p: Price): MoneyEra {
  if (p.era) return ERA_BY_ID.get(p.era)!;
  const id = p.ref.split('.')[0];
  if (book(id)?.testament === 'NT') return ERA_BY_ID.get('roman')!;
  return WORTH.eras.find((e) => e.books?.includes(id)) ?? ERA_BY_ID.get('kings')!;
}
export const unitIn = (era: MoneyEra, id: string): MoneyUnit | undefined => era.units.find((u) => u.id === id);
export const goodOf = (id: string): PriceGoodKind | undefined => GOOD_BY_ID.get(id);

/** One sum's worth in days: its count, times its unit in the era's base, times gold's worth in silver when it is a weight of gold. */
export function sumDays(era: MoneyEra, s: PriceSum): number {
  const u = unitIn(era, s.unit)!;
  return s.n * u.value * (s.gold && !u.coin ? WORTH.gold.ratio : 1) * era.days;
}
export const goodDays = (g: PriceGood) => g.n * goodOf(g.good)!.days;

/** Each piece of a price with its worth in days, in the order the text gives them. */
export interface PricePart { quote: string; ref: string; days: number; sum?: PriceSum; good?: PriceGood }
export function priceParts(p: Price): PricePart[] {
  const era = eraOf(p);
  return [
    ...(p.sums ?? []).map((s) => ({ quote: s.quote, ref: s.ref ?? p.ref, days: sumDays(era, s), sum: s })),
    ...(p.goods ?? []).map((g) => ({ quote: g.quote, ref: g.ref ?? p.ref, days: goodDays(g), good: g })),
  ];
}
export const priceDays = (p: Price) => priceParts(p).reduce((n, x) => n + x.days, 0);

/** Each one's share, where the text counts who shared it. */
export const perHead = (p: Price) => (p.per ? priceDays(p) / p.per.n : null);
/** A sum paid every day over a year, or every year over the years the text gives. */
export function recurring(p: Price): { days: number; over: string } | null {
  if (p.times) return { days: priceDays(p) * p.times.n, over: `over the ${WORDS_FOR[p.times.n] ?? p.times.n} ${p.every === 'day' ? 'days' : 'years'}` };
  if (p.every === 'day') return { days: priceDays(p) * 365, over: 'in a year' };
  return null;
}
const WORDS_FOR: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 7: 'seven', 10: 'ten' };
/**
 * What the grid counts out: the sum itself while it is countable (a century or less), else one person's share
 * where the text counts who shared it, else nothing.
 */
export function gridOf(p: Price): { days: number; each: boolean } | null {
  const days = priceDays(p), each = perHead(p);
  if (days <= 100 * WORTH.year) return { days, each: false };
  return each !== null && each <= 100 * WORTH.year ? { days: each, each: true } : null;
}
/** Other figures to mark on the scale beside the sum: each one's share, and the yearly or total figure. */
export function scaleMarks(p: Price): { days: number; label: string }[] {
  const each = perHead(p), again = recurring(p);
  return [...(each !== null ? [{ days: each, label: `each, for ${p.per!.n.toLocaleString('en-US')} ${p.per!.who}` }] : []), ...(again ? [{ days: again.days, label: again.over }] : [])];
}
/** The whole a sum is measured against, in days, and how many times the sum it is (0.89, 11). */
export function compared(p: Price): number | null {
  if (!p.compare) return null;
  const era = eraOf(p);
  return priceDays(p) / (p.compare.n * unitIn(era, p.compare.unit)!.value * era.days);
}
/** A share or a multiple in words: "89%", "≈ 11 times". */
const ratio = (r: number) => (r >= 1.5 ? `${round(r)} times` : `${Math.round(r * 100)}% of`);

/**
 * The context a bare figure needs, one line each, shortest first: each one's share, the yearly or total figure of a
 * sum paid again and again, and the whole it is measured against.
 */
export function contextLines(p: Price): string[] {
  const out: string[] = [];
  const each = perHead(p), again = recurring(p), share = compared(p);
  const approx = exact(p) ? '' : '≈ ';
  if (each !== null) out.push(`${approx}${formatDays(each)} each, for ${p.per!.n.toLocaleString('en-US')} ${p.per!.who}`);
  if (p.every && !p.times) out.push(p.every === 'day' ? 'every day' : 'every year');
  if (again) out.push(`${approx}${formatDays(again.days)} ${again.over}`);
  if (share !== null) out.push(`≈ ${ratio(share)} ${p.compare!.what}`);
  return out;
}

/**
 * Whether the days are the text's own reckoning rather than an estimate: only a sum in New Testament coins whose
 * worth the text or its notes fix (a denarius, a lepton), paid in money, not in kind, and with its unit named.
 */
export function exact(p: Price): boolean {
  const era = eraOf(p);
  return era.id === 'roman' && !p.goods?.length && !p.estimate && (p.sums ?? []).every((s) => !unitIn(era, s.unit)!.estimated && !s.gold);
}

/** Every verse a price stands under. */
export const priceRefs = (p: Price) => [p.ref, ...(p.also ?? [])];
/** Every verse a price draws its figures from, for the coverage check and the margin. */
export const priceSources = (p: Price) => [...new Set([...priceRefs(p), ...priceParts(p).map((x) => x.ref)])];

/** The prices a verse names or gives part of, in content order: the Worth tab's count, and its cards marked as here. */
export const pricesAt = (loc: VerseLoc) => PRICES.filter((p) => priceSources(p).some((r) => contains(r, loc)));

/**
 * The verses a price's chart is drawn under: its own, and each verse naming it again that is more than three
 * verses from any chart already drawn, so a passage (Jacob's gift, Gen 32:13-15) shows it once and a list told
 * leader by leader (Num 7) shows it for each.
 */
export function chartRefs(p: Price) {
  const drawn = [parseRef(p.ref)!.start];
  const near = (a: VerseLoc, b: VerseLoc) => a.book === b.book && a.chapter === b.chapter && Math.abs(a.verse - b.verse) <= 3;
  for (const l of (p.also ?? []).map((r) => parseRef(r)!.start).sort(compareLoc)) if (!drawn.some((d) => near(d, l))) drawn.push(l);
  return drawn;
}
/** The prices drawn under a verse. */
export const chartsAt = (loc: VerseLoc) => PRICES.filter((p) => chartRefs(p).some((l) => sameLoc(l, loc)));
export const pricesInChapter = (bookId: string, chapter: number) => PRICES.filter((p) => priceSources(p).some((r) => touchesChapter(r, bookId, chapter)));

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const FRACTIONS: Record<string, number> = { half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

/**
 * The number a quote names, in words or figures: "four hundred shekels" → 400, "a hundred and fifty" → 150,
 * "1,775 shekels" → 1775, "a third of a shekel" → 1/3, "twenty-four bulls" → 24. Words before the number are
 * skipped ("the other fifty"); a quote with none, or only an article, names one ("a denarius", "the last penny").
 */
export function quotedAmount(quote: string): number {
  const tokens = quote.toLowerCase().replace(/[“”‘’]/g, '').split(/\s+/).flatMap((t) => (/^[a-z]+-[a-z]+$/.test(t) && t.split('-').every((w) => w in WORDS) ? t.split('-') : [t]));
  let total = 0, current = 0, started = false, article = false;
  for (const raw of tokens) {
    const t = raw.replace(/[.,;:!?]+$/, '');
    if (/^\d[\d,]*$/.test(t)) { if (started) break; current = Number(t.replace(/,/g, '')); started = true; continue; }
    if (t in WORDS) { current += WORDS[t]; started = true; continue; }
    if (t === 'hundred') { current = (current || 1) * 100; started = true; continue; }
    if (t === 'thousand') { total += (current || 1) * 1000; current = 0; started = true; continue; }
    if (t === 'and' && started) continue;
    if (t in FRACTIONS && (article || !started)) return FRACTIONS[t];
    if ((t === 'a' || t === 'an') && !started) { article = true; continue; }
    if (started) break;
  }
  return started ? total + current : 1;
}

const round = (n: number) => {
  if (n >= 100) { const p = 10 ** (Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; }
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
};
const fmt = (n: number) => round(n).toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${round(n) === 1 ? one : many}`;
const WORDY: [number, string][] = [[1e6, 'million']];
/** A big count with its scale in words: 160,000,000 → "160 million". */
const big = (n: number) => { for (const [v, w] of WORDY) if (n >= v) return `${fmt(n / v)} ${w}`; return fmt(n); };

/**
 * A number of days in words, in hours and minutes of a working day under a day, in days under a year, in years
 * after: "about 11 minutes", "17 days", "2 years", "200,000 years".
 */
export function formatDays(days: number): string {
  if (days < 1) {
    const minutes = days * WORTH.hours * 60;
    return minutes < 60 ? `${plural(minutes, 'minute')} of a day’s work` : `${plural(minutes / 60, 'hour')} of a day’s work`;
  }
  if (days < WORTH.year) return round(days) === 1 ? 'a day’s wage' : `${fmt(days)} days’ wages`;
  const years = days / WORTH.year;
  if (round(years) === 1) return 'a year’s wages';
  return `${years >= 1e6 ? big(years) : fmt(years)} years’ wages`;
}

/** "≈ 17 days’ wages", or without the ≈ where the text itself fixes the figure (a denarius, a lepton). */
export const daysLabel = (p: Price) => `${exact(p) ? '' : '≈ '}${formatDays(priceDays(p))}`;

/** A number of days without the wage it is in: "17 days", "a year", "11 minutes of a day". */
export const shortDays = (days: number) => formatDays(days).replace(/’ (wages|work)$|’s (wage|wages|work)$/, '');

/** The ends of the shared scale every price is drawn on, in days (logarithmic), a little beyond the smallest and largest. */
const ALL_DAYS = PRICES.map(priceDays);
export const SCALE: [number, number] = [Math.min(...ALL_DAYS) / 2, Math.max(...ALL_DAYS) * 2];
/** Where `days` falls on the scale, 0–1. */
export const scaleAt = (days: number) => Math.min(1, Math.max(0, (Math.log10(days) - Math.log10(SCALE[0])) / (Math.log10(SCALE[1]) - Math.log10(SCALE[0]))));
/**
 * Landmarks on the scale. A `minor` one is a mark without a label, named only on hover: between a century and a
 * million years the labels are longer than the two decades between them.
 */
export const TICKS: { days: number; label: string; minor?: boolean }[] = [
  { days: 1, label: 'a day' },
  { days: WORTH.year, label: 'a year' },
  { days: 100 * WORTH.year, label: 'a century' },
  { days: 1e4 * WORTH.year, label: '10,000 years', minor: true },
  { days: 1e6 * WORTH.year, label: 'a million years' },
].filter((t) => t.days >= SCALE[0] && t.days <= SCALE[1]);

/** Every price, largest first, for the ladder. */
export const BY_WORTH = [...PRICES].sort((a, b) => priceDays(b) - priceDays(a));
