// The three days on one strip: the Jewish days, sunset to sunset, over the days we count from midnight, the
// time in the tomb across them, and a pin for each verse of the account being read that says when. The reader
// draws the strip under each such verse; the Days tab adds the reading toggle, the legend and the counts.
import type { CSSProperties } from 'react';
import { getState, goTo, openCard, setState, useStore } from '@/app/store';
import { PASSION } from '@/lib/content';
import { parseRef, type VerseLoc } from '@/lib/refs';
import {
  READINGS, WEEKDAYS, buriedAt, clock, countsOf, domain, eventHour, eventTime, eventReached, hourOf, jewishDayAt, jewishDays, passionAt, readingOf, roseFrom, roseTo,
  type Account,
} from '@/lib/passion';
import type { PassionEvent, PassionReading, PassionSaying } from '@/lib/types';
import { plural } from '@/lib/format';

/** "≈36 hours", or "≈24–36 hours" when the text leaves the rising open. */
export const hoursLabel = ([a, b]: [number, number]) => `≈${a === b ? a : `${a}–${b}`} hours`;

/** Where a verse's moment falls: the clock, and the Jewish day with its number in the count. */
export function whenLabel(e: PassionEvent, r: PassionReading) {
  const h = eventHour(e, r), d = jewishDayAt(h, r);
  const end = e.until !== undefined ? ` to ${clock(hourOf({ ...eventTime(e, r), hour: e.until }, r)).replace(/^\w+ /, '')}` : '';
  return `${clock(h)}${end}${d ? ` · ${d.count ? `Jewish day ${d.count}, ` : ''}${d.name}` : ''}`;
}

/** Under a verse that dates a moment, or speaks of the three days: a caption and the strip. */
export function PassionChart({ event, saying, account, loc, show, onToggle }: {
  event: PassionEvent | null; saying: PassionSaying | null; account: Account | null; loc: VerseLoc; show: boolean; onToggle: () => void;
}) {
  const r = readingOf(useStore((s) => s.passionReading));
  const c = countsOf(r);
  // The Days tab tells the moment at the current verse, so from another verse go to this one first.
  const details = () => {
    const at = passionAt(getState().loc);
    openCard('days', undefined, event ? at.event === event : at.saying === saying, parseRef((event ?? saying)!.ref)!.start);
  };
  return (
    <div className="days-block" onClick={(e) => e.stopPropagation()}>
      <div className="chiasm-cap days-cap">
        <span className="kind">Days</span>
        <button className="name" onClick={details} title="Readings, counts and sources in the Days tab">
          {event ? event.label : `“${saying!.quote}”`}
        </button>
        <span className="when">
          {event ? whenLabel(event, r) : `${r.label}: ${plural(c.days, 'day')} counted inclusively, ${plural(c.nights, 'night')}`}
          {r !== READINGS[0] && event ? ` · ${r.label} reading` : ''}
        </span>
        <button className="chiasm-toggle" aria-pressed={show} onClick={onToggle}>{show ? 'Hide chart' : 'Show chart'}</button>
      </div>
      {show && <DaysStrip r={r} account={account} loc={loc} current={event} />}
    </div>
  );
}

/** The reading of the weekday, for every chart at once. */
export function ReadingToggle() {
  const r = readingOf(useStore((s) => s.passionReading));
  return (
    <div className="reign-modes" role="group" aria-label="Crucified on">
      <span>Crucified on</span>
      {READINGS.map((x) => <button key={x.id} aria-pressed={x === r} onClick={() => setState({ passionReading: x.id })}>{x.label}</button>)}
    </div>
  );
}

export function DaysStrip({ r, account, loc, current }: { r: PassionReading; account: Account | null; loc: VerseLoc; current: PassionEvent | null }) {
  const [a, b] = domain(r);
  const x = (h: number) => ((Math.min(Math.max(h, a), b) - a) / (b - a)) * 100;
  const at = (s: number, e: number): CSSProperties => ({ left: `${x(s)}%`, width: `${x(e) - x(s)}%` });
  const days = jewishDays(r);
  const died = hourOf(PASSION.died, r), buried = buriedAt(r), from = roseFrom(r), to = roseTo(r);
  const civil: number[] = [];
  for (let m = Math.ceil(a / 24) * 24 - 24; m < b; m += 24) civil.push(m);
  const events = account?.events ?? [];
  const said = `${r.label} reading: ${days.map((d) => `${d.name} from ${clock(d.from)}`).join(', ')}. In the tomb from ${clock(buried)} until ${from === to ? clock(to) : `between ${clock(from)} and ${clock(to)}`}.`;
  return (
    <div className="days-chart">
      <div className="days-row jewish" role="img" aria-label={said}>
        {days.map((d) => (
          <div key={d.from} className={`day${d.sabbath ? ' sabbath' : ''}${d.count ? ' counted' : ''}`} style={at(d.from, d.to)} title={`${d.name}: ${clock(d.from)} to ${clock(d.to)}${d.count ? `, day ${d.count} counted inclusively` : ''}`}>
            <span className="night" />
            <span className="nm">{d.name}</span>
            {d.count && <span className="n">{d.count}</span>}
          </div>
        ))}
        <span className="cross" style={at(died, buried)} title={`Died ${clock(died)}; buried ${clock(buried)}`} />
        <span className="tomb" style={at(buried, from)} title={`In the tomb from ${clock(buried)}`} />
        {to > from && <span className="tomb rising" style={at(from, to)} title={r.rose.basis} />}
        {from === to && <span className="rose" style={{ left: `${x(to)}%` }} title={r.rose.basis} />}
        {events.map((e) => {
          const h = eventHour(e, r), reached = eventReached(account!, e, loc), cur = e === current;
          const cls = `dpin${reached ? '' : ' ahead'}${cur ? ' current' : ''}`;
          const title = `${e.label}: “${e.quote}”, ${whenLabel(e, r)}. ${r.moves?.[e.ref]?.basis ?? e.basis}`;
          const go = (ev: { stopPropagation: () => void }) => { ev.stopPropagation(); const p = parseRef(e.ref); if (p) goTo(p.start); };
          return e.until !== undefined
            ? <button key={e.ref} className={`${cls} span`} style={at(h, hourOf({ ...eventTime(e, r), hour: e.until }, r))} title={title} onClick={go} />
            : <button key={e.ref} className={cls} style={{ left: `${x(h)}%` }} title={title} onClick={go} />;
        })}
      </div>
      <div className="days-row civil" aria-hidden="true">
        {civil.map((m) => <span key={m} style={at(m, m + 24)}>{x(m + 24) - x(m) > 9 ? WEEKDAYS[((m / 24) % 7 + 7) % 7].slice(0, 3) : ''}</span>)}
      </div>
    </div>
  );
}

export function DaysLegend() {
  return (
    <div className="reign-legend days-legend">
      <span><i className="sw night-key" />Night, sunset to sunrise</span>
      <span><i className="sw sabbath-key" />Sabbath</span>
      <span><i className="sw tomb-key" />In the tomb</span>
      <span><i className="sw rising-key" />Risen by the end, the hour not told</span>
      <span><i className="sw dpin-key" />A verse that says when</span>
      <span><i className="sw count-key" />Days counted inclusively</span>
    </div>
  );
}

export const countsLine = (r: PassionReading) => {
  const c = countsOf(r);
  return `${plural(c.days, 'day')} counted inclusively, ${plural(c.nights, 'night')}, ${hoursLabel(c.hours)} in the tomb`;
};
