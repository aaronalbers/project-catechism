import { useMemo, type CSSProperties } from 'react';
import { follow, useFeatureInView, useStore } from '@/app/store';
import { structureOf } from '@/lib/content';
import { cardId } from '@/lib/catalog';
import { formatRef, parseRef, type VerseLoc } from '@/lib/refs';
import { extent, groupAt, markersAt, offset, pairBase, pairDepth, sectionAt } from '@/lib/structure';
import type { BookStructure, StructureReading, StructureSection } from '@/lib/types';
import { label as prime } from '@/components/Chiasm';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { markerId, NUMBER, ORDINAL } from '@/components/Shape';
import { useVerseCounts } from './ScrollsPanel';

const pct = (x: number, total: number) => `${(100 * x) / total}%`;
const place = (e: { start: number; end: number }, total: number): CSSProperties => ({ left: pct(e.start, total), width: pct(e.end - e.start, total) });
const readingId = (s: BookStructure, r: StructureReading) => cardId({ kind: 'structure', id: `${s.id}-${r.id}` });
const goTo = (ref: string) => follow(parseRef(ref)!.start);
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

/** A section's look: a frame (prologue, epilogue) hatched, the reading's other kinds in tints by order, a mirrored one by depth. */
function look(r: StructureReading, x: StructureSection): { className: string; style?: CSSProperties } {
  const depth = pairDepth(r, x);
  if (depth >= 0) {
    const deepest = Math.max(1, ...r.sections.map((y) => pairDepth(r, y)));
    return { className: 'pair', style: { '--tone': `${Math.round(18 + (52 * depth) / deepest)}%` } as CSSProperties };
  }
  if (x.kind === 'frame') return { className: 'frame' };
  const kinds = Object.keys(r.kinds ?? {}).filter((k) => k !== 'frame');
  return { className: x.kind ? `k${kinds.indexOf(x.kind)}` : '' };
}

/** Arcs joining each mirrored pair under the row, the outermost pair deepest. */
function Arcs({ r, counts, total }: { r: StructureReading; counts: number[]; total: number }) {
  const W = 1000, H = 20;
  const mid = (x: StructureSection) => { const e = extent(counts, x.ref); return ((e.start + e.end) / 2 / total) * W; };
  const firsts = r.sections.filter((x) => x.pair && !x.pair.endsWith("'"));
  const deepest = Math.max(1, ...firsts.map((x) => pairDepth(r, x)));
  return (
    <svg className="shape-arcs" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {firsts.flatMap((a) => {
        const b = r.sections.find((y) => y.pair === `${a.pair}'`);
        if (!b) return [];
        // A cubic's control points at 4/3 of the height bring its peak to the height.
        const h = 4 + ((H - 5) * (deepest - pairDepth(r, a))) / deepest, x1 = mid(a), x2 = mid(b);
        return [<path key={a.pair} d={`M${x1},0 C${x1},${(h * 4) / 3} ${x2},${(h * 4) / 3} ${x2},0`} />];
      })}
    </svg>
  );
}

/** One reading as a row of the strip: its larger units above, its sections below, and arcs for a mirror. */
function ReadingRow({ s, r, counts, total, loc }: { s: BookStructure; r: StructureReading; counts: number[]; total: number; loc: VerseLoc }) {
  const here = sectionAt(r, loc), group = groupAt(r, loc);
  const kinds = Object.entries(r.kinds ?? {});
  return (
    <div className="shape-reading">
      <button className="shape-name" onClick={() => scrollTo(readingId(s, r))} title="Who proposes it, and on what">
        <b>{r.label}</b> <span>{r.holder}</span>
      </button>
      {r.groups && (
        <div className="shape-row groups">
          {r.groups.map((g) => (
            <button key={g.ref} className={`shape-group${g === group ? ' here' : ''}`} style={place(extent(counts, g.ref), total)} title={`${g.label} (${formatRef(g.ref)})`} onClick={() => goTo(g.ref)}>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="shape-row">
        {r.sections.map((x) => {
          const { className, style } = look(r, x);
          const name = `${x.pair ? `${prime(x.pair)} ` : ''}${x.label}`;
          return (
            <button key={x.ref} className={`shape-sec ${className}${x.hinge ? ' hinge' : ''}${x === here ? ' here' : ''}${x.pair && pairBase(x.pair) === r.centre ? ' centre' : ''}`}
              style={{ ...place(extent(counts, x.ref), total), ...style }} title={`${name}${x.hinge ? ' (hinge)' : ''}${x.kind && r.kinds?.[x.kind] ? `, ${r.kinds[x.kind].toLowerCase()}` : ''}: ${formatRef(x.ref)}`}
              onClick={() => goTo(x.ref)}>
              <span>{x.hinge ? '' : name}</span>
            </button>
          );
        })}
      </div>
      {r.sections.some((x) => x.pair) && <Arcs r={r} counts={counts} total={total} />}
      {(kinds.length > 0 || r.sections.some((x) => x.hinge)) && (
        <div className="shape-key">
          {kinds.map(([k, name]) => <span key={k} className={`swatch ${look(r, { ref: '', label: '', kind: k }).className}`}>{name}</span>)}
          {r.sections.some((x) => x.hinge) && <span className="swatch hinge">Hinge</span>}
        </div>
      )}
    </div>
  );
}

/** Every reading on the same verses, with the repeated words ticked through all of them and the verse being read. */
function ShapeStrip({ s, counts, loc }: { s: BookStructure; counts: number[]; loc: VerseLoc }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const chapters = useMemo(() => counts.map((_, i) => extent(counts, `${s.book}.${i + 1}`)), [counts, s.book]);
  const ticks = s.markers.flatMap((m, i) => m.quotes.map((q) => ({ m, i, q, x: offset(counts, parseRef(q.ref)!.start) + 0.5 })));
  return (
    <div className="shape-strip">
      <div className="shape-bars">
        {s.readings.map((r) => <ReadingRow key={r.id} s={s} r={r} counts={counts} total={total} loc={loc} />)}
        <div className="scroll-row chapters">
          {chapters.map((c, i) => (
            <button key={i} className={`scroll-ch${i + 1 === loc.chapter ? ' here' : ''}`} style={place(c, total)} title={`${formatRef(`${s.book}.${i + 1}`)}`} aria-label={formatRef(`${s.book}.${i + 1}`)}
              onClick={() => follow({ book: s.book, chapter: i + 1, verse: 1 })} />
          ))}
        </div>
        <div className="shape-axis" aria-hidden="true">
          {chapters.map((c, i) => ((i + 1) % 5 === 0 || i === 0 ? <span key={i} style={{ left: pct(c.start, total) }}>{i + 1}</span> : null))}
        </div>
        {ticks.map(({ m, i, q, x }) => (
          <button key={q.ref} className={`shape-tick m${i}`} style={{ left: pct(x, total) }} title={`${m.label} ${formatRef(q.ref)}`} aria-label={`${m.label} ${formatRef(q.ref)}`} onClick={() => goTo(q.ref)} />
        ))}
        <span className="scroll-cursor" style={{ left: pct(offset(counts, loc) + 0.5, total) }} aria-hidden="true" />
      </div>
      <div className="shape-key markers">
        {s.markers.map((m, i) => <button key={m.id} className={`swatch tick m${i}`} onClick={() => scrollTo(markerId(s, m.id))}>{m.label}</button>)}
      </div>
    </div>
  );
}

/** The shape of the book being read: the words it repeats, and each outline read from them, side by side. */
export function ShapePanel() {
  const loc = useStore((s) => s.loc);
  const verses = useVerseCounts();
  const s = structureOf(loc.book);
  useFeatureInView();
  if (!s) {
    return <div className="panel-body"><div className="empty">
      <p>No outline of this book has been charted yet.</p>
      <small>The Shape tab sets out the outlines proposed for a book, side by side, with the words they rest on.</small>
    </div></div>;
  }
  const counts = verses?.get(s.book);
  const at = markersAt(s, loc);
  return (
    <div className="panel-body shape-pane">
      <div className="panel-title">The shape of the book</div>
      <div className="card" id={cardId({ kind: 'structure', id: s.id })}>
        <h3><span style={{ flex: 1 }}>{s.title}</span></h3>
        <p className="summary">{s.summary}</p>
        {counts ? <ShapeStrip s={s} counts={counts} loc={loc} /> : <div className="loading">Loading…</div>}
        <SourceList sources={s.sources} />
      </div>
      {s.markers.map((m) => {
        const n = at.find((x) => x.m === m)?.n;
        return (
          <div key={m.id} className="card" id={markerId(s, m.id)}>
            <h3><span style={{ flex: 1 }}>{m.label}</span><ConfidenceBadge c={m.confidence} /></h3>
            {n !== undefined && <div className="verses"><span className="chip">Here: the {ORDINAL[n] ?? n + 1} of {NUMBER[m.quotes.length] ?? m.quotes.length}</span></div>}
            <p className="summary">{m.summary}</p>
            <ul className="shape-quotes">
              {m.quotes.map((q) => <li key={q.ref}><RefChip r={q.ref} here={q.ref === m.quotes[n ?? -1]?.ref} /> “{q.quote} …”</li>)}
            </ul>
            <SourceList sources={m.sources} />
          </div>
        );
      })}
      {s.readings.map((r) => {
        const x = sectionAt(r, loc), g = groupAt(r, loc);
        return (
          <div key={r.id} className="card" id={readingId(s, r)}>
            <h3><span style={{ flex: 1 }}>{r.label}: {r.holder}</span><ConfidenceBadge c={r.confidence} /></h3>
            {x && <div className="verses"><span className="chip">Here: {x.pair ? `${prime(x.pair)} ` : ''}{x.label}{x.hinge ? ' (hinge)' : ''}{g && g.label !== x.label ? `, in ${g.label}` : ''}</span><RefChip r={x.ref} /></div>}
            <p className="summary">{r.summary}</p>
            {r.body?.map((p, i) => <p key={i}>{p}</p>)}
            {r.note && <p className="shape-note">{r.note}</p>}
            <SourceList sources={r.sources} traditions={r.traditions} />
          </div>
        );
      })}
    </div>
  );
}
