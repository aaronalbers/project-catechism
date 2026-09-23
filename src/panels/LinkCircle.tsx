import { useEffect, useMemo, useRef, useState } from 'react';
import { goTo, useStore } from '@/app/store';
import { PROPHECIES, QUOTES } from '@/lib/content';
import { loadCircle } from '@/lib/data';
import { buildCanon, refIndex, type Canon, type CircleData } from '@/lib/circle';
import { BOOKS, formatRef, parseRef, toRef, touchesChapter } from '@/lib/refs';

type Kind = 'prophecy' | 'quote' | 'xref';
/** One line across the circle. `a` and `b` are running verse indices; curated chords keep their refs, cross references derive them. */
interface Chord { kind: Kind; a: number; b: number; refs?: [string, string]; title?: string; votes?: number }

const KINDS: { id: Kind; label: string }[] = [
  { id: 'prophecy', label: 'Prophecies' },
  { id: 'quote', label: 'Quotations' },
  { id: 'xref', label: 'Cross references' },
];
const KIND_NAME: Record<Kind, string> = { prophecy: 'Prophecy', quote: 'Quotation', xref: 'Cross reference' };

interface Filters { prophecy: boolean; quote: boolean; xref: boolean; minVotes: number; chapterOnly: boolean }
const DEFAULT_FILTERS: Filters = { prophecy: true, quote: true, xref: true, minVotes: 100, chapterOnly: false };
const loadFilters = (): Filters => { try { return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem('circle') ?? '{}') }; } catch { return DEFAULT_FILTERS; } };

// Cross references are batched by vote count so thousands of chords stroke as a handful of paths.
const XREF_BUCKETS = [{ min: 0, alpha: 0.06, width: 0.6 }, { min: 80, alpha: 0.1, width: 0.7 }, { min: 160, alpha: 0.18, width: 0.9 }, { min: 300, alpha: 0.3, width: 1 }];
const LABEL_ROOM = 36;

type Hover = { chord: Chord; x: number; y: number } | { verse: number; x: number; y: number } | null;

function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => setV((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => mo.disconnect();
  }, []);
  return v;
}

export function LinkCircle() {
  const loc = useStore((s) => s.loc);
  const [data, setData] = useState<CircleData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadCircle().then(setData, () => setFailed(true)); }, []);
  const canon = useMemo(() => data && buildCanon(data.chapters), [data]);

  const [filters, setFilters] = useState(loadFilters);
  const setF = (p: Partial<Filters>) => setFilters((f) => { const n = { ...f, ...p }; try { localStorage.setItem('circle', JSON.stringify(n)); } catch { /* private mode */ } return n; });

  const chords = useMemo(() => (canon && data ? allChords(canon, data) : []), [canon, data]);
  const chapter = canon?.chapterRange(loc.book, loc.chapter);
  const touches = (c: Chord) => c.refs
    ? c.refs.some((r) => touchesChapter(r, loc.book, loc.chapter))
    : !!chapter && [c.a, c.b].some((i) => i >= chapter[0] && i < chapter[1]);
  const visible = useMemo(
    () => chords.filter((c) => filters[c.kind] && (c.votes ?? Infinity) >= filters.minVotes && (!filters.chapterOnly || touches(c))),
    [chords, filters, loc.book, loc.chapter], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const focused = useMemo(() => visible.filter(touches), [visible, loc.book, loc.chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const n: Record<Kind, number> = { prophecy: 0, quote: 0, xref: 0 };
    for (const c of visible) n[c.kind]++;
    return n;
  }, [visible]);

  // Square canvas that follows the panel width.
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.min(560, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const theme = useThemeVersion();
  const colors = useMemo(() => {
    const cs = wrap.current ? getComputedStyle(wrap.current) : null;
    const v = (n: string) => cs?.getPropertyValue(n).trim() || '#888';
    return { prophecy: v('--link-prophecy'), quote: v('--link-quote'), xref: v('--link-xref'), surface: v('--surface'), border: v('--border'), muted: v('--muted'), accent: v('--accent'), text: v('--text') };
  }, [theme, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const geo = useMemo(() => (canon && size ? geometry(canon, size) : null), [canon, size]);
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover>(null);

  useEffect(() => {
    const ctx = geo && prepare(base.current, size);
    if (!ctx || !canon) return;
    drawRing(ctx, canon, geo, colors);
    for (const b of XREF_BUCKETS.map((b, i) => ({ ...b, max: XREF_BUCKETS[i + 1]?.min ?? Infinity }))) {
      ctx.beginPath();
      for (const c of visible) if (c.kind === 'xref' && c.votes! >= b.min && c.votes! < b.max) geo.trace(ctx, c);
      ctx.globalAlpha = b.alpha; ctx.lineWidth = b.width; ctx.strokeStyle = colors.xref; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const c of visible) if (c.kind !== 'xref') strokeChord(ctx, geo, c, colors[c.kind], colors.surface, 1.6);
  }, [geo, visible, colors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctx = geo && prepare(overlay.current, size);
    if (!ctx || !canon) return;
    if (chapter) {
      ctx.beginPath(); ctx.arc(geo.c, geo.c, geo.R + 5, geo.theta(chapter[0]) - geo.halfVerse - Math.PI / 2, geo.theta(chapter[1] - 1) + geo.halfVerse - Math.PI / 2);
      ctx.lineWidth = 10; ctx.strokeStyle = colors.accent; ctx.lineCap = 'butt'; ctx.stroke();
    }
    for (const c of focused) strokeChord(ctx, geo, c, colors[c.kind], colors.surface, c.kind === 'xref' ? 1.3 : 2.4);
    const here = canon.indexOf(loc);
    if (here !== undefined) dot(ctx, geo.point(here), 4, colors.accent, colors.surface);
    if (hover && 'chord' in hover) {
      strokeChord(ctx, geo, hover.chord, colors[hover.chord.kind], colors.surface, 3.2);
      for (const i of [hover.chord.a, hover.chord.b]) dot(ctx, geo.point(i), 3.5, colors[hover.chord.kind], colors.surface);
    } else if (hover) {
      const [x0, y0] = geo.point(hover.verse, geo.R - 6), [x1, y1] = geo.point(hover.verse, geo.R + 12);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 2; ctx.strokeStyle = colors.text; ctx.stroke();
    }
  }, [geo, focused, hover, colors, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hit testing against each chord's sampled polyline, curated links first since they are fewer and wider.
  const samples = useMemo(() => {
    if (!geo) return null;
    const pts = new Float32Array(visible.length * SAMPLES * 2);
    visible.forEach((c, k) => geo.sample(c, pts, k * SAMPLES * 2));
    return pts;
  }, [geo, visible]);
  const hit = (x: number, y: number): Hover => {
    if (!geo || !canon || !samples) return null;
    const r = Math.hypot(x - geo.c, y - geo.c);
    if (r > geo.R - 3 && r < geo.R + LABEL_ROOM) {
      const verse = canon.atAngle(Math.atan2(x - geo.c, geo.c - y));
      return verse === undefined ? null : { verse, x, y };
    }
    let best = -1, bestD = 8;
    for (let k = 0; k < visible.length; k++) {
      const d = polylineDist(samples, k * SAMPLES * 2, x, y) + (visible[k].kind === 'xref' ? 3 : 0);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best < 0 ? null : { chord: visible[best], x, y };
  };
  const sameTarget = (a: Hover, b: Hover) => !!a && !!b && ('chord' in a ? 'chord' in b && a.chord === b.chord : 'verse' in b && a.verse === b.verse);
  const navigate = (h: Hover) => {
    if (!h || !canon) return;
    if ('verse' in h) return goTo(canon.locAt(h.verse));
    const [from, to] = chordRefs(canon, h.chord);
    const target = touchesChapter(from, loc.book, loc.chapter) ? to : from;
    const r = parseRef(target);
    if (r) goTo(r.start);
  };
  const at = (e: React.PointerEvent) => { const b = e.currentTarget.getBoundingClientRect(); return hit(e.clientX - b.left, e.clientY - b.top); };

  if (failed) return <div className="empty">The link circle needs <code>public/data/circle.json</code> — run <code>npm run data</code>.</div>;
  return (
    <div className="circle">
      <div className="circle-filters" role="group" aria-label="Link types">
        {KINDS.map((k) => (
          <button key={k.id} className="chip link" aria-pressed={filters[k.id]} onClick={() => setF({ [k.id]: !filters[k.id] })}>
            <span className="swatch" style={{ background: `var(--link-${k.id})` }} />{k.label}<span className="n">{counts[k.id].toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="circle-filters">
        <label title="OpenBible.info reader votes a cross reference needs to be drawn">
          Min. votes <input type="range" min={data?.minVotes ?? 20} max={400} step={10} value={filters.minVotes} disabled={!filters.xref} onChange={(e) => setF({ minVotes: +e.target.value })} /> <span className="n">{filters.minVotes}</span>
        </label>
        <label><input type="checkbox" checked={filters.chapterOnly} onChange={(e) => setF({ chapterOnly: e.target.checked })} /> Only {BOOKS.find((b) => b.id === loc.book)?.name} {loc.chapter}</label>
      </div>
      <div className="circle-wrap" ref={wrap}>
        {!canon ? <div className="loading">Loading…</div> : <div className="circle-stage" style={{ width: size, height: size }}>
          <canvas ref={base} role="img" aria-label={`Circle of the whole Bible, Genesis to Revelation clockwise from the top, with ${visible.length} links drawn across it`} />
          <canvas ref={overlay}
            onPointerMove={(e) => { if (e.pointerType === 'mouse') setHover(at(e)); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
            onPointerUp={(e) => {
              const h = at(e);
              // Touch has no hover, so the first tap shows what is under the finger and a second tap follows it.
              if (e.pointerType === 'mouse' || sameTarget(h, hover)) navigate(h); else setHover(h);
            }} />
          {hover && <Tooltip hover={hover} canon={canon} size={size} />}
        </div>}
      </div>
    </div>
  );
}

function Tooltip({ hover, canon, size }: { hover: NonNullable<Hover>; canon: Canon; size: number }) {
  const style = { left: Math.max(0, Math.min(hover.x + 12, size - 220)), top: hover.y + 14 };
  if ('verse' in hover) return <div className="circle-tip" style={style}><strong>{formatRef(toRef(canon.locAt(hover.verse)))}</strong><small>Click to go there</small></div>;
  const c = hover.chord, [from, to] = chordRefs(canon, c);
  return (
    <div className="circle-tip" style={style}>
      <span className="kind"><span className="swatch" style={{ background: `var(--link-${c.kind})` }} />{KIND_NAME[c.kind]}</span>
      {c.title && <strong>{c.title}</strong>}
      <span>{formatRef(from)} {c.kind === 'prophecy' ? '→' : c.kind === 'quote' ? 'quoted in' : '↔'} {formatRef(to)}</span>
      {c.votes !== undefined && <small>{c.votes} reader votes on OpenBible.info</small>}
    </div>
  );
}

function allChords(canon: Canon, data: CircleData): Chord[] {
  const out: Chord[] = [];
  const add = (kind: Kind, from: string, to: string, title?: string) => {
    const a = refIndex(canon, from), b = refIndex(canon, to);
    if (a !== undefined && b !== undefined && a !== b) out.push({ kind, a, b, refs: [from, to], title });
  };
  // Drawn bottom to top: cross references, then quotations, then prophecies.
  for (let i = 0; i < data.xrefs.length; i += 3) out.push({ kind: 'xref', a: data.xrefs[i], b: data.xrefs[i + 1], votes: data.xrefs[i + 2] });
  for (const q of QUOTES) add('quote', q.quoted, q.quoting);
  for (const p of PROPHECIES) for (const f of p.fulfilled) add('prophecy', p.given, f, p.title.replace(/^'(.*)'$/, '$1'));
  return out;
}
const chordRefs = (canon: Canon, c: Chord): [string, string] => c.refs ?? [toRef(canon.locAt(c.a)), toRef(canon.locAt(c.b))];

const SAMPLES = 9;
type Geo = ReturnType<typeof geometry>;
/** Chords are quadratic curves whose control point moves from the centre (verses opposite each other) toward the rim (near neighbours). */
function geometry(canon: Canon, size: number) {
  const c = size / 2, R = c - LABEL_ROOM;
  const theta = (i: number) => canon.angle(i);
  const point = (i: number, r = R): [number, number] => { const t = theta(i); return [c + r * Math.sin(t), c - r * Math.cos(t)]; };
  const control = (ch: Chord): [number, number] => {
    const ta = theta(ch.a), tb = theta(ch.b);
    let d = tb - ta;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    const tm = ta + d / 2, r = R * (1 - Math.abs(d) / Math.PI) * 0.85;
    return [c + r * Math.sin(tm), c - r * Math.cos(tm)];
  };
  return {
    c, R, theta, point,
    halfVerse: Math.PI / canon.total,
    trace(ctx: CanvasRenderingContext2D, ch: Chord) {
      const [x0, y0] = point(ch.a), [x1, y1] = point(ch.b), [cx, cy] = control(ch);
      ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
    },
    sample(ch: Chord, out: Float32Array, at: number) {
      const [x0, y0] = point(ch.a), [x1, y1] = point(ch.b), [cx, cy] = control(ch);
      for (let s = 0; s < SAMPLES; s++) {
        const t = s / (SAMPLES - 1), u = 1 - t;
        out[at + 2 * s] = u * u * x0 + 2 * u * t * cx + t * t * x1;
        out[at + 2 * s + 1] = u * u * y0 + 2 * u * t * cy + t * t * y1;
      }
    },
  };
}

function polylineDist(p: Float32Array, at: number, x: number, y: number) {
  let best = Infinity;
  for (let s = 0; s < SAMPLES - 1; s++) {
    const ax = p[at + 2 * s], ay = p[at + 2 * s + 1], bx = p[at + 2 * s + 2], by = p[at + 2 * s + 3];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

function prepare(canvas: HTMLCanvasElement | null, size: number) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  return ctx;
}

type Colors = Record<Kind | 'surface' | 'border' | 'muted' | 'accent' | 'text', string>;
function drawRing(ctx: CanvasRenderingContext2D, canon: Canon, geo: Geo, colors: Colors) {
  ctx.lineCap = 'butt';
  canon.books.forEach((b, k) => {
    const t0 = geo.theta(b.start) - geo.halfVerse, t1 = geo.theta(b.end - 1) + geo.halfVerse;
    ctx.beginPath(); ctx.arc(geo.c, geo.c, geo.R + 5, t0 - Math.PI / 2, t1 - Math.PI / 2);
    ctx.lineWidth = 6; ctx.strokeStyle = k % 2 ? colors.muted : colors.border; ctx.globalAlpha = k % 2 ? 0.6 : 1; ctx.stroke();
    ctx.globalAlpha = 1;
    // Radial labels for books wide enough to hold one.
    if ((t1 - t0) * geo.R < 10) return;
    const tm = (t0 + t1) / 2, flip = tm > Math.PI;
    ctx.save();
    ctx.translate(geo.c, geo.c); ctx.rotate(tm - Math.PI / 2 + (flip ? Math.PI : 0));
    ctx.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--sans');
    ctx.fillStyle = colors.muted; ctx.textBaseline = 'middle'; ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(b.id, flip ? -(geo.R + 11) : geo.R + 11, 0);
    ctx.restore();
  });
  ctx.lineCap = 'round';
}

function strokeChord(ctx: CanvasRenderingContext2D, geo: Geo, c: Chord, color: string, halo: string, width: number) {
  ctx.beginPath(); geo.trace(ctx, c);
  ctx.globalAlpha = 1; ctx.lineWidth = width + 2; ctx.strokeStyle = halo; ctx.stroke();
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, [x, y]: [number, number], r: number, fill: string, ring: string) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke();
}
