// Tallies drawn on the text: a caption where the list opens, a bar under each verse that gives a
// count, all on one scale, each subtotal the text gives stacked from its rows, and the whole list
// stacked under the verse that gives the total.
import type { CSSProperties } from 'react';
import { setState } from '@/app/store';
import { comparedWith, earlierRow, groupMax, groupOf, groupRows, rowReached, tallyMax, tallyPlace, tallySum, wideLabels } from '@/lib/tally';
import type { VerseLoc } from '@/lib/refs';
import type { Tally, TallyGroup, TallyRow } from '@/lib/types';
import { ConfidenceBadge } from './SourceList';

const showSources = () => setState({ tab: 'links', panelOpen: true });
const fmt = (n: number) => n.toLocaleString('en-US');
/** A change with its sign: +20,500, −37,100. */
const delta = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}`;

/** The line above the first verse of a tally, naming it and saying what the bars count. */
export function TallyCaption({ t, show, onToggle }: { t: Tally; show: boolean; onToggle: () => void }) {
  const max = t.rows.reduce((a, b) => (b.count > a.count ? b : a));
  const before = comparedWith(t);
  const biggest = t.groups?.reduce((a, b) => (b.count > a.count ? b : a));
  return (
    <div className="tally-cap">
      <div className="chiasm-cap">
        <span className="kind">Count</span>
        <button className="name" onClick={showSources} title="Summary and sources in the Links panel">{t.title}</button>
        <ConfidenceBadge c={t.confidence} />
        <button className="chiasm-toggle" aria-pressed={show} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{show ? 'Hide chart' : 'Show chart'}</button>
      </div>
      {show && <p className="tally-note">{t.rows.length} groups of {t.unit}, each drawn under its verse on one scale{t.rows.every((r) => r.count === max.count) ? <>: every one is {fmt(max.count)}.</> : <>: the longest bar is {max.label}’s {fmt(max.count)}.</>}{before && <> The outline behind each bar is the same group in {tallyPlace(before)}, with the change beside the figure{t.alone?.length ? '; a bar without one has no match there' : ''}.</>}{biggest && <> The {t.groups!.length} subtotals are stacked from their groups under their own verses, on a scale of their own: the largest is {biggest.label}, {fmt(biggest.count)}.</>}</p>}
    </div>
  );
}

/** One group's bar, empty until its verse is reached. */
export function TallyBar({ t, row, loc, current }: { t: Tally; row: TallyRow; loc: VerseLoc; current: boolean }) {
  const reached = rowReached(t, row, loc);
  const max = tallyMax(t), before = comparedWith(t), was = earlierRow(t, row);
  const said = `${row.label}: ${fmt(row.count)} ${t.unit}${was && before ? `, ${fmt(was.count)} in ${tallyPlace(before)}` : ''}`;
  return (
    <div className={`tally-row${current ? ' current' : ''}${before ? ' compared' : ''}${wideLabels(t) ? ' wide' : ''}`} role="img" aria-label={said}>
      <span className="lbl" title={row.same ? `${row.label} (${row.same} in ${tallyPlace(before!)})` : row.label}>{row.label}</span>
      <span className="track">
        {was && <span className="was" style={{ '--share': was.count / max } as CSSProperties} title={before && `${tallyPlace(before)}: ${fmt(was.count)}`} />}
        <span className="fill" style={{ '--share': reached ? row.count / max : 0 } as CSSProperties} />
      </span>
      <span className="n">{reached ? fmt(row.count) : ''}{reached && was && <small>{delta(row.count - was.count)}</small>}</span>
    </div>
  );
}

/** A subtotal's rows stacked into one bar, against the largest subtotal; a row fills once its verse is read. */
export function TallyGroupBar({ t, g, loc, current }: { t: Tally; g: TallyGroup; loc: VerseLoc; current: boolean }) {
  const rows = groupRows(t, g);
  return (
    <div className={`tally-row tally-group${current ? ' current' : ''}`} role="img" aria-label={`${g.label}: ${fmt(g.count)}, ${rows.map((r) => `${r.label} ${fmt(r.count)}`).join(', ')}`}>
      <span className="lbl">{g.label}</span>
      <span className="track">
        <span className="stack" style={{ '--share': g.count / groupMax(t) } as CSSProperties}>
          {rows.map((r, i) => (
            <span key={r.label} className={`seg${rowReached(t, r, loc) ? '' : ' empty'}`} style={{ flexGrow: r.count, '--tone': i % 2 ? '35%' : '60%' } as CSSProperties}
              title={`${r.label}: ${fmt(r.count)}`}>{r.label}</span>
          ))}
        </span>
      </span>
      <span className="n">{fmt(g.count)}</span>
    </div>
  );
}

/** Every group stacked into the text's total, and whether they add up to it. */
export function TallyTotal({ t, loc }: { t: Tally; loc: VerseLoc }) {
  const sum = tallySum(t), total = t.total!;
  const adds = sum === total.count;
  const before = comparedWith(t), was = before?.total;
  // Grouped, a tone per group and a gap between groups, with the groups named above; else alternating rows.
  const tone = (r: TallyRow, i: number) => { const g = groupOf(t, r); return (g ? t.groups!.indexOf(g) : i) % 2 ? '30%' : '55%'; };
  return (
    <div className="tally-total">
      {t.groups && (
        <div className="groups" aria-hidden="true">
          {t.groups.map((g) => <span key={g.label} style={{ flexGrow: g.count }} title={`${g.label}: ${fmt(g.count)}`}>{g.label}</span>)}
        </div>
      )}
      <div className="stack" role="img" aria-label={t.rows.map((r) => `${r.label} ${fmt(r.count)}`).join(', ')}>
        {t.rows.map((r, i) => (
          <span key={r.label} className={`seg${rowReached(t, r, loc) ? '' : ' empty'}${i && groupOf(t, r) !== groupOf(t, t.rows[i - 1]) ? ' group-start' : ''}`} style={{ flexGrow: r.count, '--tone': tone(r, i) } as CSSProperties}
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
