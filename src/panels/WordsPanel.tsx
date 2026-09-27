import { useEffect, useState } from 'react';
import { openPerson, setState, useStore } from '@/app/store';
import { loadInterlinear, loadStrongs } from '@/lib/data';
import type { InterlinearVerse, StrongsEntry } from '@/lib/types';
import { NARROWED, TEXT_BY_ID, videosForStrongs, wordCardsFor } from '@/lib/content';
import { book } from '@/lib/refs';
import { InsightCard } from './InsightsPanel';
import { VideoCard } from './VideosPanel';
import { usePeopleInBook } from '@/lib/people';
import { narrowedWord } from '@/lib/words';

/** Renderings without their inflections, for a sentence: "hear", "heard", "listen" → "hear", "listen". */
const heads = (rendered: string[]) => rendered.filter((r, i) => !rendered.slice(0, i).some((e) => r.startsWith(e)));

/** How many renderings show before "all of them". */
const FIRST_RENDERINGS = 8;

/** Where the selected word stands among its renderings: its index in `r` (-1 for none of its own) and whether that is rare. */
interface Here { at: number; rare: boolean }

function useStrongs(id: string) {
  const [entry, setEntry] = useState<StrongsEntry | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setEntry(undefined);
    loadStrongs(id).then((e) => live && setEntry(e ?? null));
    return () => { live = false; };
  }, [id]);
  return entry;
}

/** A root the derivation names ("from H5774"), with its definition, to open in place of the word. */
function Root({ id, onOpen }: { id: string; onOpen: () => void }) {
  const e = useStrongs(id);
  if (!e) return null;
  return (
    <li><button onClick={onOpen}>
      <span className={`root-lemma${id.startsWith('H') ? ' heb' : ''}`}>{e.lemma}</span>
      <em>{e.xlit}</em> ({id}) — {e.def.length > 140 ? `${e.def.slice(0, 140)}…` : e.def}
    </button></li>
  );
}

function Renderings({ entry, here }: { entry: StrongsEntry; here?: Here }) {
  const [all, setAll] = useState(false);
  const r = entry.r ?? [];
  if (!r.length) return null;
  const most = r[0][1];
  const shown = all ? r : r.slice(0, Math.max(FIRST_RENDERINGS, (here?.at ?? 0) + 1));
  return (
    <>
      <dt>Rendered in the BSB</dt>
      <dd>
        <ul className="renderings">
          {shown.map(([label, n], i) => (
            <li key={label} className={i === here?.at ? 'here' : undefined} title={i === here?.at ? 'The rendering in this verse' : undefined}>
              <span>{label}</span><span className="bar" style={{ width: `${(n / most) * 100}%` }} /><span className="n">{n}</span>
            </li>
          ))}
        </ul>
        {r.length > shown.length && <button className="chiasm-toggle" onClick={() => setAll(true)}>All {r.length} renderings</button>}
        <p className="renderings-note">
          {entry.n} uses{entry.bare ? `, ${entry.bare} of them with no English of their own (the sense is carried by the words round it)` : ''}.
          {here?.at === -1 && ' In this verse it is one of those.'}
        </p>
      </dd>
    </>
  );
}

function Lexicon({ id, here }: { id: string; here?: Here }) {
  // A root opened from the derivation replaces the word until "back"; a new word starts afresh.
  const [trail, setTrail] = useState<string[]>([]);
  useEffect(() => setTrail([]), [id]);
  const shown = trail[trail.length - 1] ?? id;
  const entry = useStrongs(shown);
  if (entry === undefined) return <div className="loading">Loading lexicon…</div>;
  if (!entry) return <div className="empty">No Strong's entry for {shown}.</div>;
  const heb = shown.startsWith('H');
  const at = shown === id ? here : undefined;
  const cards = wordCardsFor(shown);
  const narrow = NARROWED.get(shown);
  const wordVideos = videosForStrongs(shown);
  const roots = [...new Set(entry.derivation?.match(/[HG]\d+/g) ?? [])].filter((r) => r !== shown);
  const r = entry.r ?? [];
  const rendered = r.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="lexicon">
      {trail.length > 0 && <button className="lexicon-back" onClick={() => setTrail(trail.slice(0, -1))}>← back to {trail.length > 1 ? trail[trail.length - 2] : id}</button>}
      <div className={`lemma${heb ? ' heb' : ''}`}>{entry.lemma}</div>
      <div className="meta">{entry.xlit}{entry.pron && <> · {entry.pron}</>} · Strong's {shown}</div>
      {narrow?.narrows && (
        <div className="narrow-note">
          The BSB's {heads(narrow.narrows.rendered).map((r, k) => <span key={r}>{k > 0 && ' and '}<strong>“{r}”</strong></span>)} {heads(narrow.narrows.rendered).length > 1 ? 'are' : 'is'} narrower than {entry.xlit || shown}: {narrow.narrows.means}. The word study is below.
        </div>
      )}
      {at?.rare && (
        <div className="rare-note">
          Rendered <strong>“{r[at.at][0]}”</strong> here, as in only {r[at.at][1]} of the {rendered} places the BSB translates it; mostly it is {r.slice(0, 2).map(([l]) => `“${l}”`).join(' or ')}.
          The translators are choosing a sense for this verse, so it may be worth comparing with the word's other uses.
        </div>
      )}
      <dl>
        {entry.derivation && <><dt>Derivation</dt><dd>{entry.derivation}</dd></>}
        {roots.length > 0 && <><dt>Root</dt><dd><ul className="roots">{roots.map((rid) => <Root key={rid} id={rid} onOpen={() => setTrail([...trail, rid])} />)}</ul></dd></>}
        <dt>Definition</dt><dd>{entry.def}</dd>
        <Renderings key={shown} entry={entry} here={at} />
        {entry.kjv && <><dt>Rendered in KJV as</dt><dd>{entry.kjv}</dd></>}
      </dl>
      <div className="sources"><h4>Sources</h4><ol>
        <li><span className="skind">Lexicon</span>Strong's Exhaustive Concordance dictionaries (1890/1894, public domain) — <a href="https://github.com/openscriptures/strongs" target="_blank" rel="noreferrer">Open Scriptures edition</a></li>
        {r.length > 0 && <li><span className="skind">Data</span>Renderings counted from the Berean Standard Bible interlinear (public domain): each gloss reduced to the word's own English, phrases folded into the rendering they contain and plurals into their singular, so the counts are close but not exact.</li>}
      </ol></div>
      {cards.map((i) => <InsightCard key={i.id} i={i} videos={false} />)}
      {wordVideos.length > 0 && <div className="panel-title">BibleProject on {entry.xlit || shown}</div>}
      {wordVideos.map((v) => <VideoCard key={v.id} v={v} />)}
    </div>
  );
}

export function WordsPanel() {
  const loc = useStore((s) => s.loc);
  const wordIndex = useStore((s) => s.wordIndex);
  const [verse, setVerse] = useState<InterlinearVerse | null | undefined>(undefined);
  const named = usePeopleInBook(loc.book);
  useEffect(() => {
    let live = true;
    setVerse(undefined);
    loadInterlinear(loc.book, loc.chapter).then((ch) => live && setVerse(ch.find((v) => v.v === loc.verse) ?? null)).catch(() => live && setVerse(null));
    return () => { live = false; };
  }, [loc.book, loc.chapter, loc.verse]);

  const beyond = book(loc.book)?.beyond;
  if (beyond) return <div className="panel-body"><div className="empty">No interlinear for {book(loc.book)!.name}: its text here is {TEXT_BY_ID.get(beyond.text)!.name}, and the Hebrew and Greek words, Strong's numbers and word studies come from the Berean Standard Bible's interlinear, which covers only the 66 books.</div></div>;
  if (verse === undefined) return <div className="loading">Loading interlinear…</div>;
  if (!verse || !verse.w.length) return <div className="panel-body"><div className="empty">No interlinear data for this verse.</div></div>;
  const heb = verse.w[0][4].startsWith('H');
  // Show words in original-language order; glosses reveal the English mapping.
  const ordered = verse.w.map((w, i) => ({ w, i })).sort((a, b) => a.w[6] - b.w[6]);
  const sel = wordIndex !== null ? verse.w[wordIndex] : null;
  // A name in the verse that is someone the verse names: offer their profile beside the word's lexicon entry.
  const glossWords = sel ? sel[5].split(/[^\p{L}-]+/u) : [];
  const person = named && (named.verses[`${loc.chapter}.${loc.verse}`] ?? []).find((id) => glossWords.includes(named.people[id]?.[0]));
  return (
    <div className="panel-body">
      <div className="panel-title">{heb ? 'Hebrew' : 'Greek'} — tap a word</div>
      <div className={`il-grid${heb ? ' rtl' : ''}`} dir={heb ? 'rtl' : 'ltr'}>
        {ordered.map(({ w, i }) => (
          <button key={i} className={`il-word${i === wordIndex ? ' active' : ''}${w[9] ? ' rare' : ''}${narrowedWord(w, verse) ? ' narrow' : ''}`} onClick={() => setState({ wordIndex: i })} dir={heb ? 'rtl' : 'ltr'}
            title={w[9] ? 'Rendered here in a way the BSB rarely renders it elsewhere' : narrowedWord(w, verse) ? 'The English here is narrower than this word' : undefined}>
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
          {person && <button className="chip link person-link" onClick={() => openPerson(person)}>{named!.people[person][0]}: profile →</button>}
          {sel[4] ? <Lexicon id={sel[4]} here={{ at: sel[8] ?? -1, rare: sel[9] === 1 }} /> : <div className="empty">No Strong's number attached to this word.</div>}
        </>
      ) : <div className="empty"><p>Select a word for its lexicon entry, how the BSB renders it across the Bible, and morphology.</p><p><small>A dot marks a word rendered here in a way it rarely is elsewhere; a dotted gloss, a word the English is narrower than.</small></p><small>Text: Berean Standard Bible interlinear (public domain).</small></div>}
    </div>
  );
}
