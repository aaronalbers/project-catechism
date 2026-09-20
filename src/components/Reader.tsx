import { useEffect, useMemo, useRef, useState } from 'react';
import { goTo, setState, useStore } from '@/app/store';
import { loadBook, loadInterlinear } from '@/lib/data';
import { markersForChapter } from '@/lib/content';
import { BOOKS, book } from '@/lib/refs';
import type { BibleBook, InterlinearVerse } from '@/lib/types';

/** Maps an English word in the BSB text to the interlinear entry whose gloss contains it. */
export function matchWordToInterlinear(word: string, position: number, il: InterlinearVerse | undefined): number | null {
  if (!il) return null;
  const w = word.toLowerCase().replace(/[^a-z'’]/g, '');
  if (!w) return null;
  let bestIndex: number | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < il.w.length; i++) {
    const gloss = il.w[i][5].toLowerCase().replace(/[[\]]/g, '');
    if (!gloss.split(/[\s-]+/).includes(w)) continue;
    const d = Math.abs(i / il.w.length - position);
    if (d < bestDistance) { bestDistance = d; bestIndex = i; }
  }
  return bestIndex;
}

function VerseText({ text, verse, current, il }: { text: string; verse: number; current: boolean; il?: InterlinearVerse }) {
  const wordIndex = useStore((s) => s.wordIndex);
  if (!current) return <span className="text">{text}</span>;
  const tokens = text.split(/(\s+)/);
  const words = tokens.filter((t) => t.trim()).length;
  let n = 0;
  return (
    <span className="text">
      {tokens.map((t, i) => {
        if (!t.trim()) return t;
        const pos = n++ / Math.max(1, words);
        const ilIndex = matchWordToInterlinear(t, pos, il);
        return (
          <span key={i} className={`w${ilIndex !== null && ilIndex === wordIndex ? ' active' : ''}`} title={ilIndex !== null ? `${il!.w[ilIndex][0]} (${il!.w[ilIndex][4]})` : undefined}
            onClick={(e) => { e.stopPropagation(); if (ilIndex !== null) setState({ wordIndex: ilIndex, tab: 'words', panelOpen: true }); }}
            data-verse={verse}>{t}</span>
        );
      })}
    </span>
  );
}

export function Reader() {
  const loc = useStore((s) => s.loc);
  const playing = useStore((s) => s.playing);
  const [data, setData] = useState<BibleBook | null>(null);
  const [il, setIl] = useState<InterlinearVerse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = book(loc.book);

  useEffect(() => {
    let live = true;
    setError(null);
    loadBook(loc.book).then((d) => live && setData(d)).catch((e) => live && setError(String(e)));
    setIl(null);
    loadInterlinear(loc.book, loc.chapter).then((d) => live && setIl(d)).catch(() => live && setIl([]));
    return () => { live = false; };
  }, [loc.book, loc.chapter]);

  const markers = useMemo(() => markersForChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  const ilByVerse = useMemo(() => new Map((il ?? []).map((v) => [v.v, v])), [il]);

  // Keep the current verse in view, gently, when it changes (audio, links, hash).
  const lastScrolled = useRef<string>('');
  useEffect(() => {
    const key = `${loc.book}.${loc.chapter}.${loc.verse}`;
    if (lastScrolled.current === key) return;
    lastScrolled.current = key;
    const el = document.getElementById(`v-${loc.verse}`);
    el?.scrollIntoView({ block: playing ? 'center' : 'start', behavior: 'smooth' });
  }, [loc, playing, data]);

  if (error) return <div className="loading">Could not load {b?.name}. Run <code>npm run data</code> first. <br /><small>{error}</small></div>;
  if (!data || data.id !== loc.book) return <div className="loading">Loading {b?.name}…</div>;
  const chapter = data.chapters[loc.chapter - 1] ?? [];
  const bi = BOOKS.findIndex((x) => x.id === loc.book);
  const prev = loc.chapter > 1 ? { book: loc.book, chapter: loc.chapter - 1, verse: 1 } : bi > 0 ? { book: BOOKS[bi - 1].id, chapter: BOOKS[bi - 1].chapters, verse: 1 } : null;
  const next = loc.chapter < data.chapters.length ? { book: loc.book, chapter: loc.chapter + 1, verse: 1 } : bi + 1 < BOOKS.length ? { book: BOOKS[bi + 1].id, chapter: 1, verse: 1 } : null;

  return (
    <article className="reader" aria-label={`${data.name} ${loc.chapter}`}>
      <h1>{data.name} {loc.chapter}</h1>
      <div className="attribution">Berean Standard Bible (public domain). Tap a verse to explore it; tap a word in the current verse for its Hebrew or Greek.</div>
      {chapter.map((v) => {
        const ilv = ilByVerse.get(v.v);
        const current = v.v === loc.verse;
        const m = markers.get(v.v);
        return (
          <div key={v.v}>
            {ilv?.h && <div className="heading">{ilv.h}</div>}
            <div id={`v-${v.v}`} className={`verse${current ? ' current' : ''}`} onClick={() => goTo({ ...loc, verse: v.v })} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo({ ...loc, verse: v.v }); } }} aria-current={current || undefined}>
              {m && <div className="markers" aria-hidden="true">{[...m].map((k) => <span key={k} className={`marker ${k}`} title={k} />)}</div>}
              <span className="num">{v.v}</span>
              <div>
                <VerseText text={v.t} verse={v.v} current={current} il={ilv} />
                {current && ilv?.f?.length ? <div className="fn">{ilv.f.map((f, i) => <div key={i}>† {f}</div>)}</div> : null}
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
