import { useEffect, useState } from 'react';
import { setState, useStore } from '@/app/store';
import { loadInterlinear, loadStrongs } from '@/lib/data';
import type { InterlinearVerse, StrongsEntry } from '@/lib/types';
import { INSIGHTS } from '@/lib/content';
import { InsightCard } from './InsightsPanel';

function Lexicon({ id }: { id: string }) {
  const [entry, setEntry] = useState<StrongsEntry | null | undefined>(undefined);
  useEffect(() => { setEntry(undefined); loadStrongs(id).then((e) => setEntry(e ?? null)); }, [id]);
  if (entry === undefined) return <div className="loading">Loading lexicon…</div>;
  if (!entry) return <div className="empty">No Strong's entry for {id}.</div>;
  const heb = id.startsWith('H');
  const wordInsights = INSIGHTS.filter((i) => i.kind === 'word' && i.id.includes(id.toLowerCase()));
  return (
    <div className="lexicon">
      <div className={`lemma${heb ? ' heb' : ''}`}>{entry.lemma}</div>
      <div className="meta">{entry.xlit}{entry.pron && <> · {entry.pron}</>} · Strong's {id}</div>
      <dl>
        {entry.derivation && <><dt>Derivation</dt><dd>{entry.derivation}</dd></>}
        <dt>Definition</dt><dd>{entry.def}</dd>
        {entry.kjv && <><dt>Rendered in KJV as</dt><dd>{entry.kjv}</dd></>}
      </dl>
      <div className="sources"><h4>Source</h4><ol><li><span className="skind">Lexicon</span>Strong's Exhaustive Concordance dictionaries (1890/1894, public domain) — <a href="https://github.com/openscriptures/strongs" target="_blank" rel="noreferrer">Open Scriptures edition</a></li></ol></div>
      {wordInsights.map((i) => <InsightCard key={i.id} i={i} />)}
    </div>
  );
}

export function WordsPanel() {
  const loc = useStore((s) => s.loc);
  const wordIndex = useStore((s) => s.wordIndex);
  const [verse, setVerse] = useState<InterlinearVerse | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setVerse(undefined);
    loadInterlinear(loc.book, loc.chapter).then((ch) => live && setVerse(ch.find((v) => v.v === loc.verse) ?? null)).catch(() => live && setVerse(null));
    return () => { live = false; };
  }, [loc.book, loc.chapter, loc.verse]);

  if (verse === undefined) return <div className="loading">Loading interlinear…</div>;
  if (!verse || !verse.w.length) return <div className="panel-body"><div className="empty">No interlinear data for this verse.</div></div>;
  const heb = verse.w[0][4].startsWith('H');
  // Show words in original-language order; glosses reveal the English mapping.
  const ordered = verse.w.map((w, i) => ({ w, i })).sort((a, b) => a.w[6] - b.w[6]);
  const sel = wordIndex !== null ? verse.w[wordIndex] : null;
  return (
    <div className="panel-body">
      <div className="panel-title">{heb ? 'Hebrew' : 'Greek'} — tap a word</div>
      <div className={`il-grid${heb ? ' rtl' : ''}`} dir={heb ? 'rtl' : 'ltr'}>
        {ordered.map(({ w, i }) => (
          <button key={i} className={`il-word${i === wordIndex ? ' active' : ''}`} onClick={() => setState({ wordIndex: i })} dir={heb ? 'rtl' : 'ltr'}>
            <div className={`orig${heb ? ' heb' : ''}`}>{w[0]}</div>
            <div className="xlit">{w[1]}</div>
            <div className="gloss" dir="ltr">{w[5] || '—'}</div>
          </button>
        ))}
      </div>
      {sel ? (
        <>
          <hr />
          <div className="morph" title={sel[2]}>{sel[3] || sel[2]}</div>
          {sel[4] ? <Lexicon id={sel[4]} /> : <div className="empty">No Strong's number attached to this word.</div>}
        </>
      ) : <div className="empty"><p>Select a word for its lexicon entry and morphology.</p><small>Text: Berean Standard Bible interlinear (public domain).</small></div>}
    </div>
  );
}
