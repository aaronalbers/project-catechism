import { goTo, useFeatureInView, useStore } from '@/app/store';
import { MONARCHY } from '@/lib/content';
import { cardId } from '@/lib/catalog';
import { KINGDOM_NAME, READINGS, VERDICT_LABEL, chartRef, reignAt, span, verdictClass, verdictIn } from '@/lib/reign';
import { parseRef } from '@/lib/refs';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { DateToggle, Facts, Legend, Plot, modeSuffix } from '@/components/Reign';

const bcYears = (a: number, b: number) => `≈${Math.round(-a)}–${Math.round(-b)} BC`;

/** The reign being read, in full: the chart, the text's figures and verdicts, and what the dates rest on. */
export function ReignsPanel() {
  const loc = useStore((s) => s.loc);
  const mode = useStore((s) => s.reignDates);
  const here = reignAt(loc);
  useFeatureInView();
  if (!here) {
    return <div className="panel-body"><div className="empty">The kings of Israel and Judah are charted from 1 Kings 12 to 2 Kings 25, and in 2 Chronicles 10–36.</div></div>;
  }
  const { k, account, beside } = here;
  const [a, b] = span(k, mode);
  const ref = chartRef(k, account)!;
  return (
    <div className="panel-body reign-pane">
      <div className="panel-title">{account === 'kings' ? 'Reign, as Kings tells it' : 'Reign, as Chronicles tells it'}</div>
      <div className="card" id={cardId({ kind: 'reign', id: k.id })}>
        <h3><span style={{ flex: 1 }}>{k.name}, {k.title.toLowerCase()} of {KINGDOM_NAME[k.reign.kingdom]}</span><ConfidenceBadge c={MONARCHY.confidence} /></h3>
        <div className="verses">
          <span className="chip">{bcYears(a, b)}{modeSuffix(mode)}</span>
          <RefChip r={ref} />
          {beside && <>
            <span className="chip">beside</span>
            <button className="chip link" title={`${beside.name}: ${VERDICT_LABEL[verdictClass(verdictIn(beside, 'kings'))].toLowerCase()}`}
              onClick={() => { const r = parseRef(chartRef(beside, account) ?? beside.reign.ref); if (r) goTo(r.start); }}>
              {beside.name} of {KINGDOM_NAME[beside.reign.kingdom]}
            </button>
          </>}
        </div>
        <DateToggle />
        <Plot k={k} account={account} loc={loc} mode={mode} />
        <Legend account={account} />
        <Facts k={k} account={account} mode={mode} />
      </div>
      <div className="card" id={cardId({ kind: 'reign', id: MONARCHY.id })}>
        <h3><span style={{ flex: 1 }}>{MONARCHY.title}: the dates</span><ConfidenceBadge c={MONARCHY.confidence} /></h3>
        <p className="summary">{MONARCHY.summary}</p>
        <SourceList sources={[...MONARCHY.sources, ...READINGS.flatMap((r) => r.sources), ...MONARCHY.anchors.flatMap((x) => x.sources.filter((s) => s.kind !== 'scripture'))]} traditions={MONARCHY.traditions} />
      </div>
    </div>
  );
}
