import { useEffect, useMemo, useRef, useState } from 'react';
import { getState, goTo, setState, useStore } from '@/app/store';
import { loadBook, loadInterlinear } from '@/lib/data';
import { CANON_BY_ID, CHIASMS, NARROWED, TEXT_BY_ID, markersForChapter, talliesInChapter } from '@/lib/content';
import { isPhrase, ladder, levelAt, type Piece } from '@/lib/chiasm';
import { rowsAt } from '@/lib/tally';
import { reignsInChapter } from '@/lib/reign';
import { passionAt } from '@/lib/passion';
import { book, contains, neighbourBook, parseRef, touchesChapter } from '@/lib/refs';
import type { Beyond, BibleBook, Chiasm, Insight, InterlinearVerse, InterlinearWord } from '@/lib/types';
import { cardId } from '@/lib/catalog';
import { alignVerse, tokenize } from '@/lib/align';
import { narrowedToken, narrowedWord } from '@/lib/words';
import { readStored, writeStored } from '@/lib/storage';
import { ChiasmCaption, ChiasmStrip, LevelHeader, Rung, levelStyle } from './Chiasm';
import { TallyBar, TallyCaption, TallyGroupBar, TallyTotal } from './Tally';
import { ReignChart } from './Reign';
import { PassionChart } from './Passion';

interface LadderProps { chiasm: Chiasm; pieces: Piece[]; pair: string | null; onPair: (k: string | null) => void }

/** The hover text for a word whose English is narrower than it: "‘birds’ — ʿôp: anything that flies…". */
const narrowTitle = (t: string, w: InterlinearWord, i: Insight) => `‘${t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')}’ — ${w[1]} (${w[4]}): ${i.narrows!.means}. Tap for the word study.`;

function VerseText({ text, verse, current, il, ladder, marks }: { text: string; verse: number; current: boolean; il?: InterlinearVerse; ladder?: LadderProps; marks: boolean }) {
  const wordIndex = useStore((s) => s.wordIndex);
  // Words whose English is narrower than the Hebrew or Greek are marked in every verse, not just the current one.
  const narrowed = marks && !!il?.w.some((w) => NARROWED.has(w[4]));
  const aligned = useMemo(() => current || narrowed ? alignVerse(text, il) : [], [current, narrowed, text, il]);
  let n = 0;
  // Word positions run across the whole verse, so a ladder's words match the interlinear as prose does.
  const words = (s: string) => !current && !narrowed ? s : tokenize(s).map((t, i) => {
        if (!t.trim()) return t;
        const ilIndex = aligned[n++] ?? null;
        const w = ilIndex !== null ? il!.w[ilIndex] : null;
        const study = narrowed && w ? narrowedToken(t, w, il!) : undefined;
        if (!current && !study) return t;
        const open = () => { if (ilIndex !== null) setState({ wordIndex: ilIndex, tab: 'words', panelOpen: true }); };
        return (
          <span key={i} className={`w${ilIndex !== null && ilIndex === wordIndex ? ' active' : ''}${study ? ' narrow' : ''}`}
            title={study ? narrowTitle(t, w!, study) : w ? `${w[0]} (${w[4]})` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              // A marked word in another verse moves the reader there first; goTo clears the word, so pick it after.
              if (!current) goTo({ ...getState().loc, verse });
              open();
            }}
            data-verse={verse}>{t}</span>
        );
      });
  if (!ladder) return <span className="text">{words(text)}</span>;
  const { chiasm, pieces, pair, onPair } = ladder;
  return (
    <span className="text ladder">
      {pieces.map((p, k) => p.rung
        ? <Rung key={k} c={chiasm} i={p.rung.index} pair={pair} onPair={onPair}>{words(p.text)}</Rung>
        : <span key={k} className="prose">{words(p.text)}</span>)}
    </span>
  );
}

function useStoredFlag(key: string, initial: boolean): [boolean, (to?: boolean) => void] {
  const [v, setV] = useState(() => readStored(key, initial));
  return [v, (to) => setV((x) => { const y = to ?? !x; writeStored(key, y); return y; })];
}

/** Above a book beyond the 66: who reads it as scripture, what its text is, and anything odd about its numbering. */
function BeyondNote({ book: id, beyond }: { book: string; beyond: Beyond }) {
  const churches = beyond.canons.filter((c) => c !== 'anglican').map((c) => CANON_BY_ID.get(c)!.name);
  const text = TEXT_BY_ID.get(beyond.text)!;
  const why = () => goTo({ book: id, chapter: 1, verse: 1 }, { openTab: 'insights', feature: cardId({ kind: 'insight', id: 'canon-books-beyond-the-66' }) });
  return (
    <div className="attribution beyond-note">
      <p><strong>Beyond the 66.</strong> {churches.length ? <>Scripture in the {listed(churches)} {churches.length === 1 ? 'church' : 'churches'}{beyond.canons.includes('anglican') ? '; Anglicans read it “for example of life,” not for doctrine' : ''}.</> : 'Read, but not as scripture.'}{' '}
        <button className="marks-toggle" onClick={why}>Which churches read which books</button></p>
      {beyond.note && <p>{beyond.note}</p>}
      <p>Text: <a href={text.url} target="_blank" rel="noreferrer">{text.name}</a> ({text.license}), not the Berean Standard Bible, so it has no interlinear or word study. {text.summary}</p>
    </div>
  );
}
const listed = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

export function Reader() {
  const loc = useStore((s) => s.loc);
  const playing = useStore((s) => s.playing);
  const [data, setData] = useState<BibleBook | null>(null);
  // Tagged with its chapter, so the render after a chapter change never uses the last chapter's words.
  const [loaded, setLoaded] = useState<{ key: string; verses: InterlinearVerse[] } | null>(null);
  const chapterKey = `${loc.book}.${loc.chapter}`;
  const il = loaded?.key === chapterKey ? loaded.verses : null;
  const [error, setError] = useState<string | null>(null);
  const b = book(loc.book);

  useEffect(() => {
    let live = true;
    setError(null);
    loadBook(loc.book).then((d) => live && setData(d)).catch((e) => live && setError(String(e)));
    loadInterlinear(loc.book, loc.chapter).then((d) => live && setLoaded({ key: chapterKey, verses: d }), () => live && setLoaded({ key: chapterKey, verses: [] }));
    return () => { live = false; };
  }, [loc.book, loc.chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers = useMemo(() => markersForChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const ilByVerse = useMemo(() => new Map((il ?? []).map((v) => [v.v, v])), [il]);
  const phrase = useMemo(() => CHIASMS.filter((c) => isPhrase(c) && touchesChapter(c.ref, loc.book, loc.chapter)), [loc.book, loc.chapter]);
  const passage = useMemo(() => CHIASMS.find((c) => !isPhrase(c) && touchesChapter(c.ref, loc.book, loc.chapter)), [loc.book, loc.chapter]);
  const [structure, setStructure] = useStoredFlag('structure', true);
  const toggleStructure = () => setStructure();
  const [pair, setPair] = useState<string | null>(null);
  const tallies = useMemo(() => talliesInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const [charts, setCharts] = useStoredFlag('tallies', true);
  const toggleCharts = () => setCharts();
  const reigns = useMemo(() => reignsInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const [reignCharts, setReignCharts] = useStoredFlag('reigns', true);
  const toggleReigns = () => setReignCharts();
  const [dayCharts, setDayCharts] = useStoredFlag('passion', true);
  const toggleDays = () => setDayCharts();
  const [wordMarks, setWordMarks] = useStoredFlag('word-marks', true);
  const markable = useMemo(() => (il ?? []).some((v) => v.w.some((w) => narrowedWord(w, v))), [il]);
  const reveal = useStore((s) => s.reveal);
  // Arriving from the index at a chiasm, a count or a reign: show it even if the reader had hidden it.
  useEffect(() => { if (reveal === 'chiasm') setStructure(true); if (reveal === 'tally') setCharts(true); if (reveal === 'reign') setReignCharts(true); if (reveal === 'passion') setDayCharts(true); }, [reveal, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the current verse in view, gently, when it changes (audio, links, hash).
  const lastScrolled = useRef<string>('');
  useEffect(() => {
    const key = `${loc.book}.${loc.chapter}.${loc.verse}.${reveal}`;
    if (lastScrolled.current === key) return;
    // Until the book has loaded there is no verse to scroll to, and until the interlinear has, the
    // section headings it carries are still to be inserted above it; try again when both are here.
    const el = document.getElementById(`v-${loc.verse}`);
    if (!el || il === null) return;
    lastScrolled.current = key;
    if (playing) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    // A passage-level chiasm opening here is shown whole in the strip at the top of the chapter;
    // otherwise take in what sits above the verse: its heading, a chiasm's caption, a level's header.
    const opens = passage && parseRef(passage.ref)?.start;
    const strip = reveal === 'chiasm' && opens?.chapter === loc.chapter && opens.verse === loc.verse ? document.querySelector('.chiasm-strip') : null;
    (strip ?? el.parentElement ?? el).scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [loc, playing, data, il, reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring a word picked in the Words tab into view; 'nearest' leaves it alone when it is already showing.
  const wordIndex = useStore((s) => s.wordIndex);
  useEffect(() => {
    if (wordIndex !== null) document.querySelector('.verse.current .w.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [wordIndex]);

  if (error) return <div className="loading">Could not load {b?.name}. Run <code>npm run data</code> first. <br /><small>{error}</small></div>;
  if (!data || data.id !== loc.book) return <div className="loading">Loading {b?.name}…</div>;
  const chapter = data.chapters[loc.chapter - 1] ?? [];
  const before = neighbourBook(loc.book, -1), after = neighbourBook(loc.book, 1);
  const prev = loc.chapter > 1 ? { book: loc.book, chapter: loc.chapter - 1, verse: 1 } : before ? { book: before.id, chapter: before.chapters, verse: 1 } : null;
  const next = loc.chapter < data.chapters.length ? { book: loc.book, chapter: loc.chapter + 1, verse: 1 } : after ? { book: after.id, chapter: 1, verse: 1 } : null;

  return (
    <article className="reader" aria-label={`${data.name} ${loc.chapter}`}>
      <h1>{data.name} {loc.chapter}</h1>
      {b?.beyond ? <BeyondNote book={b.id} beyond={b.beyond} /> : <div className="attribution">
        Berean Standard Bible (public domain). Tap a verse to explore it; tap a word in the current verse for its Hebrew or Greek.
        {markable && <> <span className="w narrow">Dotted</span> words translate something broader than the English. <button className="marks-toggle" aria-pressed={wordMarks} onClick={() => setWordMarks()}>{wordMarks ? 'Hide' : 'Show'} them</button></>}
      </div>}
      {loc.chapter === 1 && data.intro && <div className="book-intro">{data.intro.map((p, i) => <p key={i}>{p}</p>)}</div>}
      {passage && <ChiasmStrip c={passage} loc={loc} show={structure} onToggle={toggleStructure} />}
      {chapter.map((v, k) => {
        const ilv = ilByVerse.get(v.v);
        const current = v.v === loc.verse;
        const m = markers.get(v.v);
        const vloc = { book: loc.book, chapter: loc.chapter, verse: v.v };
        const pc = phrase.find((c) => c.levels.some((l) => contains(l.ref, vloc)));
        // Footnotes are whole-verse notes with no anchor in the text, so a ladder leaves them out
        // rather than hang them off whichever rung happens to be last; hiding the structure restores them.
        const pieces = structure && pc ? ladder(pc, vloc, v.t) : null;
        const opens = phrase.find((c) => { const r = parseRef(c.ref); return r?.start.book === loc.book && r.start.chapter === loc.chapter && r.start.verse === v.v; });
        // Passage rail: which level this verse is in, and whether it opens or closes a run of that level here.
        const li = structure && passage ? levelAt(passage, vloc) : -1;
        const at = (d: number) => chapter[k + d] && passage ? levelAt(passage, { ...vloc, verse: chapter[k + d].v }) : -1;
        const first = li >= 0 && at(-1) !== li, last = li >= 0 && at(1) !== li;
        const tallyOpens = tallies.find((t) => { const r = parseRef(t.ref); return r?.start.chapter === loc.chapter && r.start.verse === v.v; });
        const bars = charts ? tallies.flatMap((t) => rowsAt(t, vloc).map((row) => ({ t, row }))) : [];
        const subtotals = charts ? tallies.flatMap((t) => (t.groups ?? []).filter((g) => contains(g.ref, vloc)).map((g) => ({ t, g }))) : [];
        const totals = charts ? tallies.filter((t) => t.total && contains(t.total.ref, vloc)) : [];
        const reign = reigns.get(v.v);
        const days = passionAt(vloc);
        return (
          <div key={v.v} className={`vblock${li >= 0 ? ` rail${first ? ' rail-start' : ''}${last ? ' rail-end' : ''}` : ''}`} style={li >= 0 ? levelStyle(passage!, li) : undefined}>
            {first && <LevelHeader c={passage!} i={li} />}
            {(ilv?.h ?? v.h) && <div className="heading">{ilv?.h ?? v.h}</div>}
            {opens && <ChiasmCaption c={opens} show={structure} onToggle={toggleStructure} />}
            {tallyOpens && <TallyCaption t={tallyOpens} show={charts} onToggle={toggleCharts} />}
            <div id={`v-${v.v}`} className={`verse${current ? ' current' : ''}`} onClick={() => goTo({ ...loc, verse: v.v })} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo({ ...loc, verse: v.v }); } }} aria-current={current || undefined}>
              {m && <div className="markers" aria-hidden="true">{[...m].map((k) => <span key={k} className={`marker ${k}`} title={k} />)}</div>}
              <span className="num">{v.l ?? v.v}</span>
              <div>
                {!v.t && v.f ? <span className="text omitted">{v.f.join(' ')}</span>
                  : <VerseText text={v.t} verse={v.v} current={current} il={ilv} marks={wordMarks} ladder={pieces && pc ? { chiasm: pc, pieces, pair, onPair: setPair } : undefined} />}
                {bars.map(({ t, row }) => <TallyBar key={`${t.id}:${row.label}`} t={t} row={row} loc={loc} current={current} />)}
                {subtotals.map(({ t, g }) => <TallyGroupBar key={`${t.id}:${g.label}`} t={t} g={g} loc={loc} current={current} />)}
                {totals.map((t) => <TallyTotal key={t.id} t={t} loc={loc} />)}
                {(days.event || days.saying) && <PassionChart event={days.event} saying={days.saying} account={days.account} loc={loc} show={dayCharts} onToggle={toggleDays} />}
                {reign && <ReignChart k={reign.k} account={reign.account} loc={loc} show={reignCharts} onToggle={toggleReigns} />}
                {current && !pieces && ilv?.f?.length ? <div className="fn">{ilv.f.map((f, i) => <div key={i}>† {f}</div>)}</div> : null}
                {current && v.t && v.f?.length ? <div className="fn">{v.f.map((f, i) => <div key={i}>† {f}</div>)}</div> : null}
              </div>
            </div>
          </div>
        );
      })}
      <nav className="chapter-nav" aria-label="Chapter navigation">
        {prev ? <button onClick={() => goTo(prev)}>← {book(prev.book)?.name} {prev.chapter}</button> : <span />}
        {next ? <button onClick={() => goTo(next)}>{book(next.book)?.name} {next.chapter} →</button> : <span />}
      </nav>
    </article>
  );
}
