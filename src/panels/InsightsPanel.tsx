import { goTo, useStore } from '@/app/store';
import { INSIGHT_BY_ID, insightsFor, insightsInChapter } from '@/lib/content';
import type { Insight } from '@/lib/types';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import { parseRef } from '@/lib/refs';

const KIND: Record<Insight['kind'], string> = { money: 'Money & wages', culture: 'Cultural context', archaeology: 'Archaeology', history: 'History', geography: 'Geography', word: 'Word study' };

export function InsightCard({ i, compact = false }: { i: Insight; compact?: boolean }) {
  return (
    <div className="card" id={`insight-${i.id}`}>
      <h3><span style={{ flex: 1 }}>{i.title}</span><ConfidenceBadge c={i.confidence} /></h3>
      <div className="verses"><span className="badge kind">{KIND[i.kind]}</span>{i.verses.map((r) => <RefChip key={r} r={r} />)}</div>
      <p className="summary">{i.summary}</p>
      {!compact && <>
        <MediaList media={i.media} />
        <div className="body">{i.body.map((p, k) => <p key={k}>{p}</p>)}</div>
        <SourceList sources={i.sources} traditions={i.traditions} />
        {i.related?.length ? <div className="traditions"><strong>See also:</strong> {i.related.map((id) => {
          const rel = INSIGHT_BY_ID.get(id);
          if (!rel) return null;
          const first = parseRef(rel.verses[0]);
          return <button key={id} className="chip link" onClick={() => first && goTo(first.start, { openTab: 'insights' })}>{rel.title}</button>;
        })}</div> : null}
      </>}
    </div>
  );
}

export function InsightsPanel() {
  const loc = useStore((s) => s.loc);
  const here = insightsFor(loc);
  const nearby = insightsInChapter(loc.book, loc.chapter).filter((i) => !here.includes(i));
  return (
    <div className="panel-body">
      {here.length === 0 && nearby.length === 0 && (
        <div className="empty">
          <p>No insight cards for this chapter yet.</p>
          <small>Cards live in <code>content/insights/</code>. Each one must cite Scripture, archaeology or a primary source.</small>
        </div>
      )}
      {here.map((i) => <InsightCard key={i.id} i={i} />)}
      {nearby.length > 0 && <>
        <div className="panel-title">Elsewhere in this chapter</div>
        {nearby.map((i) => (
          <div key={i.id} onClick={() => { const r = parseRef(i.verses[0]); if (r) goTo(r.start); }} style={{ cursor: 'pointer' }}>
            <InsightCard i={i} compact />
          </div>
        ))}
      </>}
    </div>
  );
}
