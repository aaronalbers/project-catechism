// Tallies drawn on the text: a caption where the list opens, a bar under each verse that gives a
// count, all on one scale, and the whole list stacked under the verse that gives the total.
import type { CSSProperties } from 'react';
import { setState } from '@/app/store';
import { comparedWith, earlierRow, rowReached, tallyMax, tallyPlace, tallySum } from '@/lib/tally';
import type { VerseLoc } from '@/lib/refs';
import type { Tally, TallyRow } from '@/lib/types';
import { ConfidenceBadge } from './SourceList';

const showSources = () => setState({ tab: 'links', panelOpen: true });
const fmt = (n: number) => n.toLocaleString('en-US');
/** A change with its sign: +20,500, −37,100. */
const delta = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}`;

/** The line above the first verse of a tally, naming it and saying what the bars count. */
export function TallyCaption({ t, show, onToggle }: { t: Tally; show: boolean; onToggle: () => void }) {
  const max = t.rows.reduce((a, b) => (b.count > a.count ? b : a));
  const before = comparedWith(t);
  return (
    <div className="tally-cap">
      <div className="chiasm-cap">
        <span className="kind">Count</span>
        <button className="name" onClick={showSources} title="Summary and sources in the Links panel">{t.title}</button>
        <ConfidenceBadge c={t.confidence} />
        <button className="chiasm-toggle" aria-pressed={show} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{show ? 'Hide chart' : 'Show chart'}</button>
      </div>
      {show && <p className="tally-note">{t.rows.length} groups of {t.unit}, each drawn under its verse on one scale: the longest bar is {max.label}’s {fmt(max.count)}.{before && <> The outline behind each bar is the same tribe in {tallyPlace(before)}, with the change beside the figure.</>}</p>}
    </div>
  );
}

/** One group's bar, empty until its verse is reached. */
export function TallyBar({ t, row, loc, current }: { t: Tally; row: TallyRow; loc: VerseLoc; current: boolean }) {
  const reached = rowReached(t, row, loc);
  const max = tallyMax(t), before = comparedWith(t), was = earlierRow(t, row);
  const said = `${row.label}: ${fmt(row.count)} ${t.unit}${was && before ? `, ${fmt(was.count)} in ${tallyPlace(before)}` : ''}`;
  return (
    <div className={`tally-row${current ? ' current' : ''}${before ? ' compared' : ''}`} role="img" aria-label={said}>
      <span className="lbl">{row.label}</span>
      <span className="track">
        {was && <span className="was" style={{ '--share': was.count / max } as CSSProperties} title={before && `${tallyPlace(before)}: ${fmt(was.count)}`} />}
        <span className="fill" style={{ '--share': reached ? row.count / max : 0 } as CSSProperties} />
      </span>
      <span className="n">{reached ? fmt(row.count) : ''}{reached && was && <small>{delta(row.count - was.count)}</small>}</span>
    </div>
  );
}

/** Every group stacked into the text's total, and whether they add up to it. */
export function TallyTotal({ t, loc }: { t: Tally; loc: VerseLoc }) {
  const sum = tallySum(t), total = t.total!;
  const adds = sum === total.count;
  const before = comparedWith(t), was = before?.total;
  return (
    <div className="tally-total">
      <div className="stack" role="img" aria-label={t.rows.map((r) => `${r.label} ${fmt(r.count)}`).join(', ')}>
        {t.rows.map((r, i) => (
          <span key={r.label} className={`seg${rowReached(t, r, loc) ? '' : ' empty'}`} style={{ flexGrow: r.count, '--tone': i % 2 ? '30%' : '55%' } as CSSProperties}
            title={`${r.label}: ${fmt(r.count)} (${(100 * r.count / sum).toFixed(1)}%)`}>{r.label}</span>
        ))}
      </div>
      <div className="sum">
        <span>{total.label}: <b>{fmt(total.count)}</b>{was && before && <> ({delta(total.count - was.count)} since {tallyPlace(before)}’s {fmt(was.count)})</>}</span>
        <span className={adds ? 'ok' : 'off'}>{adds ? `the ${t.rows.length} figures add up to it exactly` : `the ${t.rows.length} figures add up to ${fmt(sum)}: ${t.discrepancy}`}</span>
      </div>
    </div>
  );
}
