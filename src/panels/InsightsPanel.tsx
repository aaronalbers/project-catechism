import { follow, useFeatureInView, useStore } from '@/app/store';
import { INSIGHT_BY_ID, insightsFor, insightsInChapter, videosForStrongs, wordStrongs } from '@/lib/content';
import type { Insight, Video } from '@/lib/types';
import { ConfidenceBadge, ConsensusNote, MediaList, RefChip, SourceList } from '@/components/SourceList';
import { parseRef } from '@/lib/refs';
import { cardId } from '@/lib/catalog';
import { IndexLink } from '@/components/IndexView';

const KIND: Record<Insight['kind'], string> = { money: 'Money & wages', culture: 'Cultural context', archaeology: 'Archaeology', history: 'History', geography: 'Geography', medicine: 'Medicine', word: 'Word study' };

/** BibleProject's own word studies first, then the themes and the rest; shorts and remixes last. */
const VIDEO_ORDER: Video['kind'][] = ['word', 'theme', 'series', 'insight', 'podcast', 'short', 'remix'];
const videoRank = (v: Video) => { const k = VIDEO_ORDER.indexOf(v.kind); return k < 0 ? VIDEO_ORDER.length : k; };
/** How many videos a word card links before leaving the rest to the Words tab. */
const MAX_WORD_VIDEOS = 3;

/** Links to the BibleProject videos on the words a word card studies. */
function WordVideos({ i }: { i: Insight }) {
  const videos = [...new Map(wordStrongs(i).flatMap(videosForStrongs).map((v) => [v.id, v])).values()].sort((a, b) => videoRank(a) - videoRank(b));
  if (!videos.length) return null;
  return (
    <div className="traditions"><strong>BibleProject:</strong>{' '}
      {videos.slice(0, MAX_WORD_VIDEOS).map((v) => <a key={v.id} className="chip link" href={v.page ?? v.url} target="_blank" rel="noreferrer">▶ {v.title}</a>)}
      {videos.length > MAX_WORD_VIDEOS && <span className="chip">+{videos.length - MAX_WORD_VIDEOS} more in the Words tab</span>}
    </div>
  );
}

export function InsightCard({ i, compact = false, videos = true }: { i: Insight; compact?: boolean; videos?: boolean }) {
  return (
    <div className="card" id={cardId({ kind: 'insight', id: i.id })}>
      <h3><span style={{ flex: 1 }}>{i.title}</span><ConfidenceBadge c={i.confidence} consensus={i.consensus} /></h3>
      <div className="verses"><span className="badge kind">{KIND[i.kind]}</span>{i.verses.map((r) => <RefChip key={r} r={r} />)}</div>
      <p className="summary">{i.summary}</p>
      {!compact && <>
        <MediaList media={i.media} />
        <div className="body">{i.body.map((p, k) => <p key={k}>{p}</p>)}</div>
        <SourceList sources={i.sources} traditions={i.traditions} />
        <ConsensusNote consensus={i.consensus} />
        {videos && <WordVideos i={i} />}
        {i.related?.length ? <div className="traditions"><strong>See also:</strong> {i.related.map((id) => {
          const rel = INSIGHT_BY_ID.get(id);
          if (!rel) return null;
          const first = parseRef(rel.verses[0]);
          return <button key={id} className="chip link" onClick={() => first && follow(first.start, { openTab: 'insights', feature: cardId({ kind: 'insight', id }) })}>{rel.title}</button>;
        })}</div> : null}
      </>}
    </div>
  );
}

export function InsightsPanel() {
  const loc = useStore((s) => s.loc);
  const here = insightsFor(loc);
  const nearby = insightsInChapter(loc.book, loc.chapter).filter((i) => !here.includes(i));
  useFeatureInView();
  return (
    <div className="panel-body">
      {here.length === 0 && nearby.length === 0 && (
        <div className="empty">
          <p>No insight cards for this chapter yet.</p>
          <IndexLink section="insights" />
          <small>Cards live in <code>content/insights/</code>. Each one must cite Scripture, archaeology or a primary source.</small>
        </div>
      )}
      {here.map((i) => <InsightCard key={i.id} i={i} />)}
      {nearby.length > 0 && <>
        <div className="panel-title">Elsewhere in this chapter</div>
        {nearby.map((i) => (
          <div key={i.id} onClick={() => follow(i.verses[0])} style={{ cursor: 'pointer' }}>
            <InsightCard i={i} compact />
          </div>
        ))}
      </>}
    </div>
  );
}
