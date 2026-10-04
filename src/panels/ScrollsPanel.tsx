import { useEffect, useMemo, useState } from 'react';
import { follow, useFeatureInView, useStore } from '@/app/store';
import { SCROLLS } from '@/lib/content';
import { loadCircle } from '@/lib/data';
import { HEBREW, hebrewOf, overlapsOf, strip, type Span } from '@/lib/scrolls';
import { THE_66, book, formatRef, type VerseLoc } from '@/lib/refs';
import type { HebrewBook } from '@/lib/types';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { cardId } from '@/lib/catalog';
import { NUMBER } from '@/components/Scrolls';

/** Verses per chapter of each of the 66, from circle.json (which the Links circle loads too). */
function useVerseCounts(): Map<string, number[]> | null {
  const [counts, setCounts] = useState<Map<string, number[]> | null>(null);
  useEffect(() => { loadCircle().then((d) => setCounts(new Map(d.chapters)), () => setCounts(new Map())); }, []);
  return counts;
}

const pct = (x: number, total: number) => `${(100 * x) / total}%`;
const place = (s: Span, total: number) => ({ left: pct(s.start, total), width: pct(s.end - s.start, total) });

/** One row of the strip: spans laid over the same verses as the rows above and below it. */
function Row({ spans, total, current, go }: { spans: Span[]; total: number; current: (s: Span) => boolean; go: (s: Span) => void }) {
  return (
    <div className="scroll-row">
      {spans.map((s, i) => (
        <button key={i} className={`scroll-span${current(s) ? ' here' : ''}`} style={place(s, total)} title={s.label} onClick={() => go(s)}>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The Hebrew book being read, with the same verses divided as the Greek, the English and the chapters divide them.
 * Where the Hebrew is one book (Samuel) its row has no break at all; where it is one scroll of several books (the
 * Twelve) the break is dotted, for the blank lines between them.
 */
function ScrollStrip({ h, verses, loc }: { h: HebrewBook; verses: Map<string, number[]>; loc: VerseLoc }) {
  const s = useMemo(() => strip(h, verses, loc), [h, verses, loc]);
  if (!s.total) return null;
  const go = (x: Span) => follow({ book: x.book, chapter: x.chapter ?? 1, verse: 1 });
  const cursor = s.at === null ? null : pct(s.at + 0.5, s.total);
  // Where the Hebrew has blank lines between books, drawn as dotted breaks on its row.
  const gaps = h.kind === 'scroll' ? s.english.slice(1).map((x) => x.start) : [];
  return (
    <div className="scroll-strip">
      <div className="scroll-labels" aria-hidden="true">
        <div>Hebrew</div>{s.greek && <div>Greek</div>}<div>English</div><div className="ch">Chapters</div>
      </div>
      <div className="scroll-bars">
        <Row spans={[s.hebrew]} total={s.total} current={() => true} go={go} />
        {s.greek && <Row spans={s.greek} total={s.total} current={(x) => (x.books ?? [x.book]).includes(loc.book)} go={go} />}
        <Row spans={s.english} total={s.total} current={(x) => x.book === loc.book} go={go} />
        <div className="scroll-row chapters">
          {s.chapters.map((c, i) => (
            <button key={i} className={`scroll-ch${c.book === loc.book && c.chapter === loc.chapter ? ' here' : ''}${i > 0 && s.chapters[i - 1].book !== c.book ? ' book' : ''}`}
              style={place(c, s.total)} title={c.label} aria-label={c.label} onClick={() => go(c)} />
          ))}
        </div>
        {/* A dotted break on the Hebrew row where the scroll leaves blank lines, and the verse being read, across every row. */}
        {gaps.map((x) => <span key={x} className="scroll-gap" style={{ left: pct(x, s.total) }} aria-hidden="true" />)}
        {cursor && <span className="scroll-cursor" style={{ left: cursor }} aria-hidden="true" />}
      </div>
    </div>
  );
}

// The order diagram's geometry, in viewBox units: the Hebrew row above, the English below, ribbons between.
const W = 1000, GAP = 3, ROW = 16, TOP = 14, BOTTOM = 92;

/** A box per book on a row, sized by its verses, with a gap between each. */
function lay<T>(items: T[], size: (t: T) => number): { t: T; x: number; w: number }[] {
  const total = items.reduce((n, t) => n + size(t), 0);
  const scale = (W - GAP * (items.length - 1)) / total;
  let x = 0;
  return items.map((t) => { const w = size(t) * scale; const r = { t, x, w }; x += w + GAP; return r; });
}

/**
 * The twenty-four as the Talmud orders them, above, and the Old Testament's thirty-nine as English Bibles order them,
 * below, each box as wide as its verses, with a ribbon from where each English book lies in its Hebrew book to where
 * it stands in the English order. The ribbons that cross are the books the Greek and Latin moved: Ruth, Lamentations,
 * Daniel, Chronicles.
 */
function OrderDiagram({ verses, current }: { verses: Map<string, number[]>; current: HebrewBook | undefined }) {
  const size = (id: string) => (verses.get(id) ?? []).reduce((a, b) => a + b, 0);
  const english = useMemo(() => THE_66.filter((b) => b.testament === 'OT' && hebrewOf(b.id)), []);
  const top = useMemo(() => lay(HEBREW, (h) => h.books.reduce((n, id) => n + size(id), 0)), [verses]); // eslint-disable-line react-hooks/exhaustive-deps
  const bottom = useMemo(() => lay(english, (b) => size(b.id)), [verses]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!top.length || top.some((b) => !Number.isFinite(b.w))) return null;
  // Each English book's share of its Hebrew box, left to right.
  const within = new Map<string, { x: number; w: number }>();
  for (const { t: h, x, w } of top) {
    const all = h.books.reduce((n, id) => n + size(id), 0);
    let at = x;
    for (const id of h.books) { const bw = (w * size(id)) / all; within.set(id, { x: at, w: bw }); at += bw; }
  }
  const go = (id: string) => follow({ book: id, chapter: 1, verse: 1 });
  const y1 = TOP + ROW, y2 = BOTTOM, mid = (y1 + y2) / 2;
  return (
    <div className="scroll-order">
      <svg viewBox={`0 0 ${W} ${BOTTOM + ROW}`} preserveAspectRatio="none" role="img" aria-label="The Hebrew Bible's twenty-four books above, the Old Testament's thirty-nine below">
        {bottom.map(({ t: b, x, w }) => {
          const from = within.get(b.id)!, h = hebrewOf(b.id)!;
          return (
            <path key={b.id} className={`ribbon ${h.part.toLowerCase()}${h === current ? ' here' : ''}`}
              d={`M${from.x},${y1} C${from.x},${mid} ${x},${mid} ${x},${y2} L${x + w},${y2} C${x + w},${mid} ${from.x + from.w},${mid} ${from.x + from.w},${y1} Z`}
              onClick={() => go(b.id)}><title>{b.name}: {h.name} in the Hebrew</title></path>
          );
        })}
        {top.map(({ t: h, x, w }) => (
          <rect key={h.id} className={`box ${h.part.toLowerCase()}${h === current ? ' here' : ''}`} x={x} y={TOP} width={w} height={ROW} onClick={() => go(h.books[0])}>
            <title>{h.name} ({h.part}){h.books.length > 1 ? `: ${h.books.map((id) => book(id)?.name).join(', ')}` : ''}</title>
          </rect>
        ))}
        {bottom.map(({ t: b, x, w }) => (
          <rect key={b.id} className={`box ${hebrewOf(b.id)!.part.toLowerCase()}${hebrewOf(b.id) === current ? ' here' : ''}`} x={x} y={BOTTOM} width={w} height={ROW} onClick={() => go(b.id)}>
            <title>{b.name}</title>
          </rect>
        ))}
      </svg>
      <div className="scroll-parts" aria-hidden="true">
        {(['Torah', 'Prophets', 'Writings'] as const).map((p) => {
          const boxes = top.filter((b) => b.t.part === p);
          const x = boxes[0].x, end = boxes.at(-1)!.x + boxes.at(-1)!.w;
          return <span key={p} className={p.toLowerCase()} style={{ left: pct(x, W), width: pct(end - x, W) }}>{p}</span>;
        })}
      </div>
      <div className="scroll-order-key"><span>Above: the Hebrew Bible’s 24 books, in the Talmud’s order</span><span>Below: the Old Testament’s 39, in English Bibles’ order</span></div>
    </div>
  );
}

const KIND_TEXT: Record<NonNullable<HebrewBook['kind']>, string> = { book: 'One book in Hebrew', scroll: 'One scroll in Hebrew' };

/** Where the book being read sits in the Hebrew Bible: its scroll against the later divisions, and the order of all of them. */
export function ScrollsPanel() {
  const loc = useStore((s) => s.loc);
  const verses = useVerseCounts();
  const h = hebrewOf(loc.book);
  useFeatureInView();
  if (!h) {
    return <div className="panel-body"><div className="empty">
      <p>The Hebrew Bible’s books and scrolls are the Old Testament’s.</p>
      <small>Open an Old Testament book to see where it stands among them.</small>
    </div></div>;
  }
  const overlaps = overlapsOf(h);
  return (
    <div className="panel-body scroll-pane">
      <div className="panel-title">In the Hebrew Bible</div>
      <div className="card" id={cardId({ kind: 'scroll', id: h.id })}>
        <h3><span style={{ flex: 1 }}>{h.name}</span><ConfidenceBadge c={SCROLLS.confidence} /></h3>
        <div className="verses">
          <span className="chip">{h.part}</span>
          {h.kind && <span className="chip">{KIND_TEXT[h.kind]}{h.gap ? `, ${NUMBER[h.gap]} blank lines between books` : ''}</span>}
        </div>
        {verses ? <ScrollStrip h={h} verses={verses} loc={loc} /> : <div className="loading">Loading…</div>}
        <p className="summary">{h.summary ?? (h.books.length === 1 ? `${book(h.books[0])?.name} is one book in Hebrew and English alike; only its chapters and verse numbers are later.` : '')}</p>
        <SourceList sources={h.sources ?? SCROLLS.sources.filter((s) => s.url?.includes('Bava_Batra.14b'))} />
      </div>
      {overlaps.map(({ o, here, there }) => (
        <div key={o.id} className="card" id={cardId({ kind: 'scroll', id: o.id })}>
          <h3><span style={{ flex: 1 }}>The same words at {formatRef(here)} and {formatRef(there)}</span><ConfidenceBadge c={o.confidence} /></h3>
          <div className="verses"><RefChip r={here} /><RefChip r={there} /></div>
          <p className="summary">{o.summary}</p>
          <SourceList sources={o.sources} traditions={o.traditions} />
        </div>
      ))}
      <div className="card" id={cardId({ kind: 'scroll', id: SCROLLS.id })}>
        <h3><span style={{ flex: 1 }}>{SCROLLS.title}</span><ConfidenceBadge c={SCROLLS.confidence} /></h3>
        {verses && <OrderDiagram verses={verses} current={h} />}
        <p className="summary">{SCROLLS.summary}</p>
        {SCROLLS.numbering.map((n) => (
          <div key={n.id} className="scroll-numbering">
            <h4><span style={{ flex: 1 }}>{n.label}, {n.when}</span><ConfidenceBadge c={n.confidence} /></h4>
            <p>{n.summary}</p>
            <SourceList sources={n.sources} />
          </div>
        ))}
        <SourceList sources={SCROLLS.sources} />
      </div>
    </div>
  );
}
