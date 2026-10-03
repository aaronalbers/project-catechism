// A price drawn under its verse: what the sum was worth in days of a labourer's wage, as a share of a working
// day, a year of working days, or a century of years, and where it stands on one scale with every other sum in
// the Bible.
import type { CSSProperties } from 'react';
import { getState, openCard } from '@/app/store';
import { cardId } from '@/lib/catalog';
import { WORTH } from '@/lib/content';
import { BY_WORTH, daysLabel, KIND_LABEL, priceDays, priceRefs, scaleAt, TICKS } from '@/lib/prices';
import { contains, formatRef, parseRef } from '@/lib/refs';
import type { Price } from '@/lib/types';

/** The price's card in the Worth tab, going first to the verse it stands under if the reader is elsewhere. */
const showCard = (p: Price) => openCard('worth', cardId({ kind: 'price', id: p.id }), priceRefs(p).some((r) => contains(r, getState().loc)), parseRef(p.ref)!.start);

/** The scale every price shares, logarithmic, with this one marked and every other sum in the Bible a faint tick. */
export function PriceScale({ p, onPick }: { p: Price; onPick?: (q: Price) => void }) {
  const at = scaleAt(priceDays(p));
  return (
    <div className="price-scale" aria-hidden="true">
      <div className="rail">
        {BY_WORTH.map((q) => q !== p && (
          <span key={q.id} className="other" style={{ '--at': scaleAt(priceDays(q)) } as CSSProperties} title={`${formatRef(q.ref)}: ${q.what}, ${daysLabel(q)}`}
            onClick={onPick && ((e) => { e.stopPropagation(); onPick(q); })} />
        ))}
        <span className="fill" style={{ '--at': at } as CSSProperties} />
        <span className="dot" style={{ '--at': at } as CSSProperties} />
      </div>
      <div className="ticks">
        {TICKS.map((t) => <span key={t.label} className={t.minor ? 'minor' : undefined} title={t.label} style={{ '--at': scaleAt(t.days) } as CSSProperties}>{t.minor ? '' : t.label}</span>)}
      </div>
    </div>
  );
}

/**
 * The sum made countable. Under a day, the share of a twelve-hour day; up to a year, a square for each working
 * day, a row for each month of 25; up to a century, a square for each year, a row for each decade. Beyond that
 * there is nothing to count, and the scale says it.
 */
export function PriceGrid({ days }: { days: number }) {
  if (days < 1) {
    return (
      <div className="price-hours" aria-hidden="true">
        {Array.from({ length: WORTH.hours }, (_, h) => <span key={h} className="hour"><span className="fill" style={{ '--f': Math.max(0, Math.min(1, days * WORTH.hours - h)) } as CSSProperties} /></span>)}
      </div>
    );
  }
  const years = days / WORTH.year;
  const [count, row, unit] = days <= WORTH.year ? [days, 25, 'day'] : years <= 100 ? [years, 10, 'year'] : [0, 0, ''];
  if (!count) return null;
  const whole = Math.floor(count), part = count - whole;
  const cells = Math.ceil(count);
  return (
    <div className={`price-grid ${unit}s`} style={{ '--row': row } as CSSProperties} aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => <span key={i} className="cell" style={i === whole && part ? { '--f': part } as CSSProperties : undefined} />)}
    </div>
  );
}

/** What the grid's squares stand for, under it. */
export function gridKey(days: number) {
  if (days < 1) return `one square per hour of a ${WORTH.hours}-hour working day`;
  if (days <= WORTH.year) return 'one square per working day, a row per month of 25';
  if (days / WORTH.year <= 100) return `one square per year of ${WORTH.year} working days, a row per decade`;
  return 'too many years to draw; the scale shows how far beyond a lifetime it lies';
}

/** Under the verse: the sum's kind and what it paid for, its worth in wages, and the chart. */
export function PriceChart({ p, show, onToggle }: { p: Price; show: boolean; onToggle: () => void }) {
  const days = priceDays(p);
  return (
    <div className="price-block" onClick={(e) => e.stopPropagation()}>
      <div className="chiasm-cap price-cap">
        <span className="kind">{KIND_LABEL[p.kind]}</span>
        <button className="name" onClick={() => showCard(p)} title="How it is reckoned, and every other sum on one scale, in the Worth tab">{p.what}</button>
        <span className="worth">{daysLabel(p)}</span>
        <button className="chiasm-toggle" aria-pressed={show} onClick={onToggle}>{show ? 'Hide chart' : 'Show chart'}</button>
      </div>
      {show && <div className="price-chart" role="img" aria-label={`${p.what}: ${daysLabel(p)}`}>
        <PriceGrid days={days} />
        <PriceScale p={p} />
      </div>}
    </div>
  );
}
