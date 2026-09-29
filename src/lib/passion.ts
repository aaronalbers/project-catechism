// The three days as the reader draws them: Jewish days from sunset to sunset above the days we count from
// midnight, the time in the tomb across them, and a pin for each verse of an account that says when.
import { PASSION } from './content';
import { compareLoc, contains, parseRef, touchesChapter, type VerseLoc } from './refs';
import type { PassionEvent, PassionReading, PassionSaying, PassionTime } from './types';

export type Account = (typeof PASSION.accounts)[number];
export const READINGS = PASSION.readings;
/** The reading an id names, or the first (Friday) for one no longer known (a stored choice, say). */
export const readingOf = (id: string) => READINGS.find((r) => r.id === id) ?? READINGS[0];

/** Sunrise and sunset on the clock, ≈, near the spring equinox (the content's `clock` says so). */
export const SUNRISE = 6, SUNSET = 18;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Hours from the midnight that begins Sunday: negative before it. */
export const hourOf = (t: PassionTime, r: PassionReading) => (t.day === 'sunday' ? t.hour : (r.weekday + t.day - 7) * 24 + t.hour);
/** Where a reading puts an event: where the account does, unless the reading moves it. */
export const eventTime = (e: PassionEvent, r: PassionReading): PassionTime => r.moves?.[e.ref] ?? e.at;
export const eventHour = (e: PassionEvent, r: PassionReading) => hourOf(eventTime(e, r), r);
/** The weekday of a civil day, 0 for Sunday, from an hour on the axis. */
const weekdayAt = (h: number) => (((Math.floor(h / 24) % 7) + 7) % 7);

/** What the chart spans: from the sunset that begins the crucifixion's Jewish day to Sunday's sunset. */
export const domain = (r: PassionReading): [number, number] => [hourOf({ day: -1, hour: SUNSET }, r), SUNSET];

export const buriedAt = (r: PassionReading) => hourOf(PASSION.buried, r);
export const roseFrom = (r: PassionReading) => hourOf(r.rose.from, r);
export const roseTo = (r: PassionReading) => hourOf(r.rose.to, r);

export interface JewishDay { from: number; to: number; weekday: number; name: string; sabbath: boolean; count: number | null }
/**
 * The Jewish days in view, sunset to sunset, each named by the civil day whose daylight it holds, with
 * Sabbaths marked and `count` the day's number in the inclusive count from the crucifixion's day to the
 * resurrection (null outside it).
 */
export function jewishDays(r: PassionReading): JewishDay[] {
  const [a, b] = domain(r);
  const end = roseTo(r);
  const out: JewishDay[] = [];
  for (let from = a, i = 0; from < b; from += 24, i++) {
    const weekday = weekdayAt(from + 12), high = i === r.high;
    const name = i === 0 ? 'Preparation' : weekday === 6 ? (high ? 'Sabbath (High)' : 'Sabbath') : high ? 'High Sabbath' : weekday === 0 ? 'First day' : WEEKDAYS[weekday];
    out.push({ from, to: from + 24, weekday, name, sabbath: weekday === 6 || high, count: from < end ? i + 1 : null });
  }
  return out;
}

/** The nights (sunset to sunrise) the time in the tomb reaches, whole or in part, up to the latest the reading allows. */
export function nightsIn(r: PassionReading): number {
  const [a, b] = [buriedAt(r), roseTo(r)];
  let n = 0;
  for (let s = Math.floor((a - SUNSET) / 24) * 24 + SUNSET; s < b; s += 24) if (s + 24 - SUNSET + SUNRISE > a) n++;
  return n;
}
/** How a reading counts the three days: the days counted inclusively, the nights, and the hours in the tomb (a range when the text leaves the rising open). */
export function countsOf(r: PassionReading) {
  return {
    days: jewishDays(r).filter((d) => d.count !== null).length,
    nights: nightsIn(r),
    hours: [Math.round(roseFrom(r) - buriedAt(r)), Math.round(roseTo(r) - buriedAt(r))] as [number, number],
  };
}

/** A clock time on the axis, rounded to the quarter hour: "Friday ≈3 p.m.", "Saturday ≈5:30 p.m.". */
export function clock(h: number) {
  const q = Math.round(h * 4) / 4;
  const day = WEEKDAYS[weekdayAt(q)], t = ((q % 24) + 24) % 24;
  const hr = Math.floor(t), min = Math.round((t - hr) * 60);
  if (t === 12) return `${day} ≈noon`;
  const h12 = hr % 12 || 12, mm = min ? `:${String(min).padStart(2, '0')}` : '';
  return `${day} ≈${h12}${mm} ${hr < 12 ? 'a.m.' : 'p.m.'}`;
}
/** The Jewish day an hour falls in, and its number in the count. */
export const jewishDayAt = (h: number, r: PassionReading) => jewishDays(r).find((d) => d.from <= h && h < d.to) ?? null;

/** The account a verse is in, if any. */
export const accountAt = (loc: VerseLoc) => PASSION.accounts.find((a) => contains(a.ref, loc)) ?? null;
const at = (ref: string, loc: VerseLoc) => { const p = parseRef(ref); return !!p && compareLoc(p.start, loc) === 0; };
/** The event and saying at a verse, and the account it is in. */
export function passionAt(loc: VerseLoc): { event: PassionEvent | null; saying: PassionSaying | null; account: Account | null } {
  const account = accountAt(loc);
  return {
    event: account?.events.find((e) => at(e.ref, loc)) ?? null,
    saying: PASSION.sayings.find((s) => at(s.ref, loc)) ?? null,
    account,
  };
}
/** Whether a chapter has any of it: an event or a saying. */
export const passionInChapter = (book: string, chapter: number) =>
  PASSION.accounts.some((a) => a.events.some((e) => touchesChapter(e.ref, book, chapter))) || PASSION.sayings.some((s) => touchesChapter(s.ref, book, chapter));

/** Whether an event's pin is filled at `loc`: inside its account once its verse is reached; everywhere outside it. */
export function eventReached(account: Account, e: PassionEvent, loc: VerseLoc) {
  if (!contains(account.ref, loc)) return true;
  return compareLoc(parseRef(e.ref)!.start, loc) <= 0;
}
