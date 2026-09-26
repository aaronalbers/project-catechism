// A king's reign on one time axis with both kingdoms round it, each bar coloured by the verdict the account
// being read gives that king, with the synchronism that dates him, the pins dated outside the Bible and the
// prophets of the time, in one of the reconstructions or with the stated lengths end to end. The reader draws the chart
// alone under each accession; the Reign tab adds the date toggle, the legend and the facts.
import type { CSSProperties, ReactNode } from 'react';
import { goTo, setState, useStore } from '@/app/store';
import { MONARCHY } from '@/lib/content';
import { formatRef, parseRef, type VerseLoc } from '@/lib/refs';
import {
  DOMAIN, KINGDOM_NAME, KINGDOMS, READINGS, VERDICT_LABEL, anchorFits, bc, chartRef, datesIn, dynasties, kingById, laneOf, modeLabel, overlapSpan,
  prophetRows, reached, readingOf, reckoningAt, span, statedBefore, synchronism, verdictClass, verdictIn, windowFor, type Account, type DateMode, type King,
} from '@/lib/reign';
import type { Verdict } from '@/lib/types';
import { RefChip } from './SourceList';

// Rows of the plot, in pixels: the SVG overlay uses the same numbers.
const LANE = 18, ISRAEL = 0, HOUSES = 21, JUDAH = 33, PROPHETS = 57, PROPHET_ROW = 14;
const laneY: Record<King['reign']['kingdom'], number> = { israel: ISRAEL, judah: JUDAH };

const go = (ref: string | undefined) => { const r = ref && parseRef(ref); if (r) goTo(r.start); };
const stop = (f: () => void) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); f(); };
const years = (a: number, b: number) => `≈${bc(a)}–${bc(b)} BC`;
const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;
/** What follows a king's years to say which view gave them: nothing for Thiele's, the default. */
export const modeSuffix = (mode: DateMode) => { const r = readingOf(mode); return !r ? ' as stated' : r === READINGS[0] ? '' : ` (${r.label})`; };

/** Under a king's accession: a caption and the chart. What it rests on, and the rest, is in the Reign tab. */
export function ReignChart({ k, account, loc, show, onToggle }: { k: King; account: Account; loc: VerseLoc; show: boolean; onToggle: () => void }) {
  const mode = useStore((s) => s.reignDates);
  const [a, b] = span(k, mode);
  const v = verdictClass(verdictIn(k, account));
  return (
    <div className="reign-block" onClick={(e) => e.stopPropagation()}>
      <div className="chiasm-cap reign-cap">
        <span className="kind">Reign</span>
        <button className="name" onClick={() => setState({ tab: 'reigns', panelOpen: true })} title="Details, dates and sources in the Reign tab">
          {k.name}, {k.title.toLowerCase()} of {KINGDOM_NAME[k.reign.kingdom]}
        </button>
        <span className="when">{years(a, b)}{modeSuffix(mode)}</span>
        <span className="verdict"><i className={`sw v-${v}`} />{VERDICT_LABEL[v]}</span>
        <button className="chiasm-toggle" aria-pressed={show} onClick={onToggle}>{show ? 'Hide chart' : 'Show chart'}</button>
      </div>
      {show && <Plot k={k} account={account} loc={loc} mode={mode} />}
    </div>
  );
}

/** The reconstructions and the stated lengths, for every chart at once. */
export function DateToggle() {
  const reading = readingOf(useStore((s) => s.reignDates));
  return (
    <div className="reign-modes" role="group" aria-label="Dates">
      {READINGS.map((r) => <button key={r.id} aria-pressed={reading === r} onClick={() => setState({ reignDates: r.id })}>{r.label}</button>)}
      <button aria-pressed={!reading} onClick={() => setState({ reignDates: 'stated' })}>Stated lengths</button>
      <p className="reign-note">{reading ? <>{reading.basis} Rounded to the year; hatched, years shared with another king.</> : MONARCHY.stated}</p>
    </div>
  );
}

export function Plot({ k, account, loc, mode }: { k: King; account: Account; loc: VerseLoc; mode: DateMode }) {
  const [w0, w1] = windowFor(k, mode);
  const x = (y: number) => ((y - w0) / (w1 - w0)) * 100;
  const ox = (y: number) => ((y - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100;
  // The prophets' years are set by Thiele's dates, so they are drawn only with them.
  const rows = readingOf(mode) === READINGS[0] ? prophetRows(w0, w1) : [];
  const height = PROPHETS + (rows.length ? (Math.max(...rows.map((r) => r.row)) + 1) * PROPHET_ROW : 0);
  const sync = synchronism(k, mode);
  const pins = MONARCHY.anchors.filter((p) => p.year >= w0 && p.year <= w1);
  const step = w1 - w0 <= 100 ? 10 : w1 - w0 <= 200 ? 25 : 50;
  const ticks: number[] = [];
  for (let t = Math.ceil(w0 / step) * step; t <= w1; t += step) if (x(t) > 3 && x(t) < 97) ticks.push(t); // clear of the edges, where a label would spill
  // Clipped to the window, so a bar that begins before it still shows its name at the edge.
  const clip = (y: number) => Math.min(Math.max(y, w0), w1);
  const at = (s: number, e: number): CSSProperties => ({ left: `${x(clip(s))}%`, width: `${x(clip(e)) - x(clip(s))}%` });

  return (
    <div className="reign-chart">
      {/* The whole period on one scale, with the stretch drawn below marked. */}
      <div className="reign-overview" aria-hidden="true">
        {KINGDOMS.map((kd) => (
          <div key={kd} className="lane">
            {laneOf(kd).map((o) => { const [s, e] = span(o, mode); return <span key={o.id} className={`bar v-${reached(o, loc) ? verdictClass(verdictIn(o, account)) : 'ahead'}`} style={{ left: `${ox(s)}%`, width: `${ox(e) - ox(s)}%` }} />; })}
          </div>
        ))}
        <span className="window" style={{ left: `${ox(w0)}%`, width: `${ox(w1) - ox(w0)}%` }} />
      </div>
      <div className="reign-grid">
        <div className="reign-labels" aria-hidden="true" style={{ height }}>
          <span style={{ top: ISRAEL }}>Israel</span>
          <span style={{ top: JUDAH }}>Judah</span>
          {rows.length > 0 && <span style={{ top: PROPHETS }}>Prophets</span>}
        </div>
        <div className="reign-plot" style={{ height }}>
          {pins.map((p) => {
            const fits = anchorFits(p, mode);
            return <span key={p.id} className={`pin${fits ? '' : ' misses'}`} style={{ left: `${x(p.year)}%` }}
              title={`${p.estimated ? '≈' : ''}${bc(p.year)} BC, ${p.label}: ${p.note}${fits ? '' : ` In this view that year falls outside ${p.kings.map((id) => kingById.get(id)?.name).join(' and ')}’s reign.`}`} />;
          })}
          {dynasties('israel', mode).map((d) => (
            <span key={d.name + d.from} className="house" style={{ ...at(d.from, d.to), top: HOUSES }} title={`House of ${d.name}`}>{x(clip(d.to)) - x(clip(d.from)) > 8 ? d.name : ''}</span>
          ))}
          {KINGDOMS.flatMap((kd) => laneOf(kd).map((o) => {
            const [s, e] = span(o, mode);
            if (e < w0 || s > w1) return null;
            const v = verdictIn(o, account), cls = reached(o, loc) ? verdictClass(v) : 'ahead';
            const ov = overlapSpan(o, mode);
            const wide = x(clip(e)) - x(clip(s)) > 9 || o === k;
            const ref = chartRef(o, account) ?? o.reign.ref;
            return (
              <button key={o.id} className={`reign-bar v-${cls}${o === k ? ' current' : ''}`} style={{ ...at(s, e), top: laneY[kd], zIndex: o === k ? 3 : e - s < 2 ? 2 : 1 }}
                title={`${o.name}, ${KINGDOM_NAME[kd]}, ${years(s, e)}${mode === 'stated' ? ' as stated' : ''}: ${cls === 'ahead' ? 'not yet read' : VERDICT_LABEL[cls].toLowerCase()}`}
                onClick={stop(() => go(ref))}>
                {ov && <span className="overlap" style={{ width: `${((clip(ov[1]) - clip(ov[0])) / (clip(e) - clip(s))) * 100}%` }} />}
                {wide && <span className="nm">{o.name}</span>}
              </button>
            );
          }))}
          {rows.map(({ p, row }) => (
            <button key={p.id} className="prophet" style={{ ...at(p.from, Math.max(p.to, p.from + 0.5)), top: PROPHETS + row * PROPHET_ROW }}
              title={`${p.name}, ${years(p.from, p.to)}: ${p.basis}`} onClick={stop(() => go(p.refs[0]))}><span className="nm">{p.name}</span></button>
          ))}
          {sync && (
            <svg className="sync" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
              <line x1={x(sync.at)} x2={x(sync.to)} y1={laneY[sync.other.reign.kingdom] + LANE / 2} y2={laneY[k.reign.kingdom] + LANE / 2} vectorEffect="non-scaling-stroke" />
              {/* A wider, invisible line over it, so hovering the thin one names the synchronism. */}
              <line className="hit" x1={x(sync.at)} x2={x(sync.to)} y1={laneY[sync.other.reign.kingdom] + LANE / 2} y2={laneY[k.reign.kingdom] + LANE / 2} vectorEffect="non-scaling-stroke">
                <title>{syncTitle(k, sync, mode)}</title>
              </line>
              <line className="tick" x1={x(sync.at)} x2={x(sync.at)} y1={laneY[sync.other.reign.kingdom] - 2} y2={laneY[sync.other.reign.kingdom] + LANE + 2} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
        <span className="reign-axis-unit" aria-hidden="true">BC</span>
        <div className="reign-axis" aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ left: `${x(t)}%` }}>{bc(t)}</span>)}
        </div>
      </div>
    </div>
  );
}

/** What the synchronism line says, for its tooltip: the verse's words, and whether the dates in view meet it. */
function syncTitle(k: King, sync: NonNullable<ReturnType<typeof synchronism>>, mode: DateMode) {
  const s = k.reign.synchronism!;
  const said = `${k.name} became king in “the ${s.quote}” of ${sync.other.name} (${formatRef(s.ref)})`;
  if (!sync.off) return `${said}. In ${modeLabel(mode)} that year is where his reign begins.`;
  const gap = Math.abs(Math.round(sync.at - sync.to));
  return `${said}. In ${modeLabel(mode)} that year falls in ≈${bc(sync.at)} BC, ${plural(gap, 'year')} ${sync.at > sync.to ? 'after' : 'before'} his reign begins.`;
}

const SWATCHES: [string, string][] = [['right', 'Did right'], ['right-but', 'Right, but…'], ['evil', 'Did evil'], ['evil-but', 'Evil, but…'], ['none', 'No verdict']];

export function Legend({ account }: { account: Account }) {
  return (
    <div className="reign-legend">
      {SWATCHES.map(([c, l]) => <span key={c}><i className={`sw v-${c}`} />{l}</span>)}
      {account === 'chronicles' && <span><i className="sw v-untold" />Israel, not told in Chronicles</span>}
      <span><i className="sw v-ahead" />Not yet read</span>
      <span><i className="sw hatch" />Coregent or rival</span>
      <span><i className="sw pin-key" />Dated outside the Bible</span>
      <span title="Kings dates most accessions by a year of the other kingdom's king. Straight: the dates in view agree; slanted: they fall that far apart."><i className="sw sync-key" />Dated by the other kingdom’s king</span>
    </div>
  );
}

function VerdictLine({ v, label }: { v: Verdict | null; label: string }) {
  if (!v) return null;
  const cls = verdictClass(v);
  return (
    <Row label={label}>
      <span className={`verdict v-${cls}`}><i className={`sw v-${cls}`} />{VERDICT_LABEL[cls]}</span>
      {v.quote && <> “{v.quote}” {v.ref && <RefChip r={v.ref} />}</>}
      {v.but && <> “{v.but.quote}” <RefChip r={v.but.ref} /></>}
      {v.note && <div className="sub">{v.note}</div>}
    </Row>
  );
}

const Row = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={`reign-fact${className ? ` ${className}` : ''}`}><span className="k">{label}</span><div>{children}</div></div>
);

/** A northern king's place in his house: whether he founds it, and whether a son of his succeeds him. */
function house(k: King) {
  const members = laneOf(k.reign.kingdom).filter((o) => o.reign.dynasty === k.reign.dynasty);
  if (members.length === 1) return `Takes the throne by force; no son succeeds him`;
  const i = members.indexOf(k);
  return i === 0 ? `Founds the house of ${k.reign.dynasty}, ${members.length} kings` : `The house of ${k.reign.dynasty}, king ${i + 1} of ${members.length}`;
}

export function Facts({ k, account, mode }: { k: King; account: Account; mode: DateMode }) {
  const r = k.reign;
  const reading = readingOf(mode), thiele = reading === READINGS[0];
  const [a, b] = span(k, READINGS[0].id), [ma, mb] = span(k, mode);
  const s = r.synchronism, other = s && kingById.get(s.king);
  const sync = synchronism(k, mode);
  const drift = Math.round(ma - a);
  const overlap = datesIn(k, mode)?.overlap;
  // Why a reading's dates miss the synchronism: Thiele's own admission, a reading's note, or just how far out it is.
  const unmet = sync?.off && reading && (thiele ? r.discrepancy : reading.notes?.[k.id]);
  const reckon = thiele ? KINGDOMS.map((kd) => ({ kd, rk: reckoningAt(kd, a) })).filter((x) => x.rk) : [];
  const prophets = MONARCHY.prophets.filter((p) => p.to >= a && p.from <= b);
  const pins = MONARCHY.anchors.filter((p) => p.kings.includes(k.id));
  return (
    <div className="reign-facts">
      <Row label="Reigned">
        “{r.length.quote}” <RefChip r={r.length.ref} />{' '}
        {reading ? <>{years(ma, mb)} in {modeLabel(mode)}{!thiele && drift ? <>, {plural(Math.abs(drift), 'year')} {drift > 0 ? 'later' : 'earlier'} than Thiele’s {bc(a)}</> : ''}.</>
          : <>{years(ma, mb)} laid end to end, after {Math.round(statedBefore(k))} stated years of {KINGDOM_NAME[r.kingdom]}’s kings{drift ? <>: {plural(Math.abs(drift), 'year')} {drift > 0 ? 'later' : 'earlier'} than Thiele’s {bc(a)}</> : ''}.</>}
      </Row>
      {s && other && (
        <Row label="Dated by">
          The “{s.quote}” of {other.name} of {KINGDOM_NAME[other.reign.kingdom]} <RefChip r={s.ref} />
          {sync?.off && <>, which in {modeLabel(mode)} falls in ≈{bc(sync.at)}, {plural(Math.abs(Math.round(sync.at - sync.to)), 'year')} {sync.at > sync.to ? 'after' : 'before'} his reign {reading ? 'begins' : 'begins as stated'}.</>}
        </Row>
      )}
      <VerdictLine v={verdictIn(k, account)} label={account === 'chronicles' ? 'Chronicles' : 'Verdict'} />
      {account === 'chronicles' && (
        <Row label="Kings">
          <span className={`verdict v-${verdictClass(r.verdict)}`}><i className={`sw v-${verdictClass(r.verdict)}`} />{VERDICT_LABEL[verdictClass(r.verdict)]}</span>
          {r.verdict.ref && <> <RefChip r={r.verdict.ref} /></>}
        </Row>
      )}
      {overlap && (
        <Row label={overlap.kind === 'coregency' ? 'Coregency' : 'Rival reign'}>
          {overlap.kind === 'coregency' ? 'Beside' : 'Against'} {overlap.with}, {years(ma, overlap.until)}. <span className="sub">{overlap.basis}</span>
        </Row>
      )}
      {r.dynasty && <Row label="House">{house(k)}</Row>}
      {reckon.length > 0 && (
        <Row label="Counting">
          {reckon.map(({ kd, rk }, i) => (
            <span key={kd} title={rk!.basis}>{i ? '; ' : ''}{KINGDOM_NAME[kd]} {rk!.method === 'accession' ? 'left a king’s first part-year uncounted' : 'counted a king’s first part-year as year one'}, its year from {rk!.year}</span>
          ))}.
        </Row>
      )}
      {prophets.length > 0 && (
        <Row label="Prophets">
          {prophets.map((p) => <button key={p.id} className="chip link" title={p.basis} onClick={stop(() => go(p.refs[0]))}>{p.name}</button>)}
        </Row>
      )}
      {pins.map((p) => (
        <Row key={p.id} label="Dated">
          <b>{p.estimated ? '≈' : ''}{bc(p.year)} BC</b>, {p.label}. {p.note} {p.ref && <RefChip r={p.ref} />}
          {!anchorFits(p, mode) && <div className="off">In this view the year falls outside his reign.</div>}
        </Row>
      ))}
      {r.note && <Row label="Note">{r.note}</Row>}
      {sync?.off && reading && (thiele
        ? unmet && <Row label="Unresolved" className="off">{unmet}</Row>
        : unmet ? <Row label={reading.label}>{unmet}</Row>
        : <Row label="Unmet" className="off">{reading.label}’s dates do not meet this synchronism as the chart counts it; his reasons are argued in the work cited below.</Row>)}
    </div>
  );
}
