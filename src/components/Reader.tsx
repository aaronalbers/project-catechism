import { useEffect, useMemo, useRef, useState } from 'react';
import { follow, getState, goTo, leave, openTab, useStore } from '@/app/store';
import { loadBook, loadInterlinear, loadSpeakersForBook } from '@/lib/data';
import { play } from '@/lib/reader';
import { CANON_BY_ID, CHIASMS, NARROWED, TEXT_BY_ID, markersForChapter, structureOf, talliesInChapter } from '@/lib/content';
import { isPhrase, ladder, levelAt, type Piece } from '@/lib/chiasm';
import { rowsAt } from '@/lib/tally';
import { reignsInChapter } from '@/lib/reign';
import { passionAt } from '@/lib/passion';
import { book, contains, neighbourBook, parseRef, sameLoc, touchesChapter, type VerseLoc } from '@/lib/refs';
import type { Beyond, BibleBook, Chiasm, Insight, InterlinearVerse, InterlinearWord, SpeakersInBook } from '@/lib/types';
import { cardId } from '@/lib/catalog';
import { alignVerse, tokenize } from '@/lib/align';
import { narrowedToken, narrowedWord } from '@/lib/words';
import { wordsOfJesus, type Span } from '@/lib/redletter';
import { readStored, writeStored } from '@/lib/storage';
import { ChiasmCaption, ChiasmStrip, LevelHeader, Rung, levelStyle } from './Chiasm';
import { TallyBar, TallyCaption, TallyGroupBar, TallyTotal } from './Tally';
import { ReignChart } from './Reign';
import { PriceChart } from './Price';
import { chartsAt } from '@/lib/prices';
import { PassionChart } from './Passion';
import { OverlapNote, SeamNote } from './Scrolls';
import { ShapeNote } from './Shape';
import { markersAt } from '@/lib/structure';
import { AlphabetStrip, GutterLetters } from './Acrostic';
import { acrosticsInChapter } from '@/lib/acrostic';
import { overlapsInChapter, seamsInChapter } from '@/lib/scrolls';

/**
 * A verse tapped in the reader: while the audio reads, it reads on from there (the verse being read goes on
 * undisturbed); otherwise the reader goes there.
 */
const pick = (to: VerseLoc) => {
  const s = getState();
  if (!s.playing) goTo(to); else if (!sameLoc(to, s.loc)) void play(to);
};

interface LadderProps { chiasm: Chiasm; pieces: Piece[]; pair: string | null; onPair: (k: string | null) => void }

/** The hover text for a word whose English is narrower than it: "‘birds’ — ʿôp: anything that flies…". */
const narrowTitle = (t: string, w: InterlinearWord, i: Insight) => `‘${t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')}’ — ${w[1]} (${w[4]}): ${i.narrows!.means}. Tap for the word study.`;

function VerseText({ text, verse, current, il, ladder, marks, red }: { text: string; verse: number; current: boolean; il?: InterlinearVerse; ladder?: LadderProps; marks: boolean; red?: Span[] }) {
  const wordIndex = useStore((s) => s.wordIndex);
  // Words whose English is narrower than the Hebrew or Greek are marked in every verse, not just the current one.
  const narrowed = marks && !!il?.w.some((w) => NARROWED.has(w[4]));
  const aligned = useMemo(() => current || narrowed ? alignVerse(text, il) : [], [current, narrowed, text, il]);
  let n = 0;
  // Red letters: whether a token, from character `from` of the verse to `to`, is in the words of Jesus.
  const inRed = (from: number, to: number) => !!red?.some(([a, z]) => from < z && to > a);
  // Word positions run across the whole verse, so a ladder's words match the interlinear as prose does;
  // `at` is where s starts in the verse.
  const words = (s: string, at = 0) => !current && !narrowed && !red ? s : tokenize(s).map((t, i) => {
        const jw = inRed(at, (at += t.length));
        if (!t.trim()) return t;
        const ilIndex = aligned[n++] ?? null;
        const w = ilIndex !== null ? il!.w[ilIndex] : null;
        const study = narrowed && w ? narrowedToken(t, w, il!) : undefined;
        if (!current && !study) return jw ? <span key={i} className="jw">{t}</span> : t;
        const open = () => { if (ilIndex !== null) openTab('words', { wordIndex: ilIndex }); };
        return (
          <span key={i} className={`w${ilIndex !== null && ilIndex === wordIndex ? ' active' : ''}${study ? ' narrow' : ''}${jw ? ' jw' : ''}`}
            title={study ? narrowTitle(t, w!, study) : w ? `${w[0]} (${w[4]})` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              // A marked word in another verse moves the reader there first; goTo clears the word, so pick it after.
              // While the audio reads, it is a tap on the verse: the reading moves there, and the word is left.
              if (!current && getState().playing) { pick({ ...getState().loc, verse }); return; }
              if (!current) goTo({ ...getState().loc, verse });
              open();
            }}
            data-verse={verse}>{t}</span>
        );
      });
  if (!ladder) return <span className="text">{words(text)}</span>;
  const { chiasm, pieces, pair, onPair } = ladder;
  // Pieces are trimmed slices of the verse, in order; find where each starts.
  let from = 0;
  const starts = pieces.map((p) => { const i = text.indexOf(p.text, from); from = i + p.text.length; return i; });
  return (
    <span className="text ladder">
      {pieces.map((p, k) => p.rung
        ? <Rung key={k} c={chiasm} i={p.rung.index} pair={pair} onPair={onPair}>{words(p.text, starts[k])}</Rung>
        : <span key={k} className="prose">{words(p.text, starts[k])}</span>)}
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
  const why = () => follow({ book: id, chapter: 1, verse: 1 }, { openTab: 'insights', feature: cardId({ kind: 'insight', id: 'canon-books-beyond-the-66' }) });
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
  const [speakers, setSpeakers] = useState<{ book: string; who: SpeakersInBook } | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    loadBook(loc.book).then((d) => live && setData(d)).catch((e) => live && setError(String(e)));
    loadInterlinear(loc.book, loc.chapter).then((d) => live && setLoaded({ key: chapterKey, verses: d }), () => live && setLoaded({ key: chapterKey, verses: [] }));
    return () => { live = false; };
  }, [loc.book, loc.chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Red letters, in the New Testament: who speaks each verse says where Jesus does.
  useEffect(() => {
    let live = true;
    if (b?.testament === 'NT' && !b.beyond) loadSpeakersForBook(loc.book).then((who) => live && setSpeakers({ book: loc.book, who }));
    return () => { live = false; };
  }, [loc.book]); // eslint-disable-line react-hooks/exhaustive-deps
  const [redLetters, setRedLetters] = useStoredFlag('red-letters', true);
  const jesus = useMemo(() => data && speakers?.book === data.id ? wordsOfJesus(data, speakers.who) : null, [data, speakers]);

  const markers = useMemo(() => markersForChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const ilByVerse = useMemo(() => new Map((il ?? []).map((v) => [v.v, v])), [il]);
  const phrase = useMemo(() => CHIASMS.filter((c) => isPhrase(c) && touchesChapter(c.ref, loc.book, loc.chapter)), [loc.book, loc.chapter]);
  const passage = useMemo(() => CHIASMS.find((c) => !isPhrase(c) && touchesChapter(c.ref, loc.book, loc.chapter)), [loc.book, loc.chapter]);
  const [structure, setStructure] = useStoredFlag('structure', true);
  const acrostics = useMemo(() => acrosticsInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const [letters, setLetters] = useStoredFlag('alphabet', true);
  const toggleLetters = () => setLetters();
  const toggleStructure = () => setStructure();
  const [pair, setPair] = useState<string | null>(null);
  const tallies = useMemo(() => talliesInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const [charts, setCharts] = useStoredFlag('tallies', true);
  const toggleCharts = () => setCharts();
  const reigns = useMemo(() => reignsInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const [reignCharts, setReignCharts] = useStoredFlag('reigns', true);
  const toggleReigns = () => setReignCharts();
  const [priceCharts, setPriceCharts] = useStoredFlag('prices', true);
  const togglePrices = () => setPriceCharts();
  const [dayCharts, setDayCharts] = useStoredFlag('passion', true);
  const toggleDays = () => setDayCharts();
  const [wordMarks, setWordMarks] = useStoredFlag('word-marks', true);
  const markable = useMemo(() => (il ?? []).some((v) => v.w.some((w) => narrowedWord(w, v))), [il]);
  const reveal = useStore((s) => s.reveal);
  const seams = useMemo(() => seamsInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const overlaps = useMemo(() => overlapsInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const shape = structureOf(loc.book);
  // Arriving from the index at a chiasm, an alphabet poem, a count, a price or a reign: show it even if the reader had hidden it.
  useEffect(() => { if (reveal === 'chiasm') setStructure(true); if (reveal === 'acrostic') setLetters(true); if (reveal === 'tally') setCharts(true); if (reveal === 'reign') setReignCharts(true); if (reveal === 'passion') setDayCharts(true); if (reveal === 'price') setPriceCharts(true); }, [reveal, loc]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // At the first verse, a note that the Hebrew runs on from the book before stands above the heading: take it in too.
    const seam = loc.verse === 1 ? document.querySelector('.seam.before') : null;
    (strip ?? seam ?? el.parentElement ?? el).scrollIntoView({ block: 'start', behavior: 'smooth' });
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
        {chapter.some((v) => jesus?.has(`${loc.chapter}.${v.v}`)) && <> {redLetters ? <span className="jw">Red</span> : 'Red'} words are Jesus’s. <button className="marks-toggle" aria-pressed={redLetters} onClick={() => setRedLetters()}>{redLetters ? 'Hide' : 'Show'} them</button></>}
      </div>}
      {loc.chapter === 1 && data.intro && <div className="book-intro">{data.intro.map((p, i) => <p key={i}>{p}</p>)}</div>}
      {seams.before && <SeamNote seam={seams.before} side="before" />}
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
        // An alphabet poem's strip stands above the first of its verses in this chapter.
        const acrosticOpens = acrostics.filter((a) => { const r = parseRef(a.ref)!; return (r.start.chapter === loc.chapter ? r.start.verse : 1) === v.v; });
        const tallyOpens = tallies.find((t) => { const r = parseRef(t.ref); return r?.start.chapter === loc.chapter && r.start.verse === v.v; });
        const bars = charts ? tallies.flatMap((t) => rowsAt(t, vloc).map((row) => ({ t, row }))) : [];
        const subtotals = charts ? tallies.flatMap((t) => (t.groups ?? []).filter((g) => contains(g.ref, vloc)).map((g) => ({ t, g }))) : [];
        const totals = charts ? tallies.filter((t) => t.total && contains(t.total.ref, vloc)) : [];
        const reign = reigns.get(v.v);
        const days = passionAt(vloc);
        const priced = chartsAt(vloc);
        const repeated = overlaps.filter((e) => parseRef(e.here)!.start.verse === v.v);
        const outlined = shape ? markersAt(shape, vloc) : [];
        return (
          <div key={v.v} className={`vblock${li >= 0 ? ` rail${first ? ' rail-start' : ''}${last ? ' rail-end' : ''}` : ''}`} style={li >= 0 ? levelStyle(passage!, li) : undefined}>
            {first && <LevelHeader c={passage!} i={li} />}
            {(ilv?.h ?? v.h) && <div className="heading">{ilv?.h ?? v.h}</div>}
            {acrosticOpens.map((a) => <AlphabetStrip key={a.id} a={a} loc={loc} show={letters} onToggle={toggleLetters} />)}
            {opens && <ChiasmCaption c={opens} show={structure} onToggle={toggleStructure} />}
            {tallyOpens && <TallyCaption t={tallyOpens} show={charts} onToggle={toggleCharts} />}
            <div id={`v-${v.v}`} className={`verse${current ? ' current' : ''}`} onClick={() => pick(vloc)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(vloc); } }} aria-current={current || undefined}>
              {m && <div className="markers" aria-hidden="true">{[...m].map((k) => <span key={k} className={`marker ${k}`} title={k} />)}</div>}
              <span className="num">{v.l ?? v.v}{letters && acrostics.map((a) => <GutterLetters key={a.id} a={a} loc={vloc} />)}</span>
              <div>
                {!v.t && v.f ? <span className="text omitted">{v.f.join(' ')}</span>
                  : <VerseText text={v.t} verse={v.v} current={current} il={ilv} marks={wordMarks} ladder={pieces && pc ? { chiasm: pc, pieces, pair, onPair: setPair } : undefined} red={redLetters ? jesus?.get(`${loc.chapter}.${v.v}`) : undefined} />}
                {bars.map(({ t, row }) => <TallyBar key={`${t.id}:${row.label}`} t={t} row={row} loc={loc} current={current} />)}
                {subtotals.map(({ t, g }) => <TallyGroupBar key={`${t.id}:${g.label}`} t={t} g={g} loc={loc} current={current} />)}
                {totals.map((t) => <TallyTotal key={t.id} t={t} loc={loc} />)}
                {priced.map((p) => <PriceChart key={p.id} p={p} show={priceCharts} onToggle={togglePrices} />)}
                {(days.event || days.saying) && <PassionChart event={days.event} saying={days.saying} account={days.account} loc={loc} show={dayCharts} onToggle={toggleDays} />}
                {repeated.map((e) => <OverlapNote key={e.o.id} end={e} />)}
                {outlined.map(({ m, n }) => <ShapeNote key={m.id} s={shape!} m={m} n={n} />)}
                {reign && <ReignChart k={reign.k} account={reign.account} loc={loc} show={reignCharts} onToggle={toggleReigns} />}
                {current && !pieces && ilv?.f?.length ? <div className="fn">{ilv.f.map((f, i) => <div key={i}>† {f}</div>)}</div> : null}
                {current && v.t && v.f?.length ? <div className="fn">{v.f.map((f, i) => <div key={i}>† {f}</div>)}</div> : null}
              </div>
            </div>
          </div>
        );
      })}
      {seams.after && <SeamNote seam={seams.after} side="after" />}
      <nav className="chapter-nav" aria-label="Chapter navigation">
        {prev ? <button onClick={() => leave(prev)}>← {book(prev.book)?.name} {prev.chapter}</button> : <span />}
        {next ? <button onClick={() => leave(next)}>{book(next.book)?.name} {next.chapter} →</button> : <span />}
      </nav>
    </article>
  );
}
