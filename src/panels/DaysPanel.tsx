import { useFeatureInView, useStore } from '@/app/store';
import { PASSION } from '@/lib/content';
import { cardId } from '@/lib/catalog';
import { READINGS, countsOf, passionAt, readingOf } from '@/lib/passion';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { DaysLegend, DaysStrip, ReadingToggle, countsLine, hoursLabel, whenLabel } from '@/components/Passion';

/** The three days in full: the verse being read, the chart in the chosen reading, how each reading counts, and the sources. */
export function DaysPanel() {
  const loc = useStore((s) => s.loc);
  const r = readingOf(useStore((s) => s.passionReading));
  const { event, saying, account } = passionAt(loc);
  useFeatureInView();
  const moved = event && r.moves?.[event.ref];
  return (
    <div className="panel-body reign-pane">
      <div className="panel-title">{account ? `The three days, as ${account.label} tells them` : PASSION.title}</div>
      <div className="card" id={cardId({ kind: 'passion', id: account?.id ?? 'sayings' })}>
        <h3><span style={{ flex: 1 }}>{event ? event.label : saying ? `“${saying.quote}”` : PASSION.title}</span><ConfidenceBadge c={event ? PASSION.confidence : r.confidence} /></h3>
        {event && (
          <div className="verses">
            <span className="chip">{whenLabel(event, r)}</span>
            <RefChip r={event.ref} />
          </div>
        )}
        {event && <p className="summary">“{event.quote}.” {moved ? moved.basis : event.basis}</p>}
        {!event && saying && <p className="summary">{/nights/.test(saying.quote) ? r.nights : r.thirdDay}</p>}
        <ReadingToggle />
        <DaysStrip r={r} account={account} loc={loc} current={event} />
        <DaysLegend />
        <div className="reign-facts">
          <div className="reign-fact"><span className="k">Counts</span><div>{countsLine(r)}.</div></div>
          <div className="reign-fact"><span className="k">Why</span><div>{r.basis}</div></div>
          <div className="reign-fact"><span className="k">Third day</span><div>{r.thirdDay}</div></div>
          <div className="reign-fact"><span className="k">Three nights</span><div>{r.nights}</div></div>
          <div className="reign-fact"><span className="k">Rising</span><div>{r.rose.basis}</div></div>
        </div>
        <SourceList sources={r.sources} traditions={r.traditions} />
      </div>
      <div className="card" id={cardId({ kind: 'passion', id: 'readings' })}>
        <h3><span style={{ flex: 1 }}>The three readings side by side</span><ConfidenceBadge c="interpretation" /></h3>
        <table className="days-compare">
          <thead><tr><th>Crucified</th><th>Days, inclusive</th><th>Nights</th><th>In the tomb</th></tr></thead>
          <tbody>
            {READINGS.map((x) => { const c = countsOf(x); return <tr key={x.id} className={x === r ? 'current' : ''}><td>{x.label}</td><td>{c.days}</td><td>{c.nights}</td><td>{hoursLabel(c.hours)}</td></tr>; })}
          </tbody>
        </table>
        <p className="summary">Each reading meets one phrase exactly and has to explain the other: Friday meets “the third day” and reads “three days and three nights” as an idiom; Wednesday meets the nights and has to count “the third day” from later.</p>
      </div>
      <div className="card" id={cardId({ kind: 'passion', id: PASSION.id })}>
        <h3><span style={{ flex: 1 }}>How the days were counted</span><ConfidenceBadge c={PASSION.confidence} /></h3>
        <p className="summary">{PASSION.summary}</p>
        <p className="summary">{PASSION.clock}</p>
        <SourceList sources={PASSION.sources} />
      </div>
    </div>
  );
}
