import { useState, type CSSProperties } from 'react';
import { goTo, openTab, useFeatureInView, useStore } from '@/app/store';
import { INSIGHT_BY_ID, WORTH } from '@/lib/content';
import { cardId } from '@/lib/catalog';
import { BY_WORTH, eraOf, goodOf, KIND_LABEL, priceDays, priceParts, pricesInChapter, priceRefs, priceSources, scaleAt, shortDays, unitIn, daysLabel, contextLines, gridOf, type PricePart } from '@/lib/prices';
import { contains, formatRef, parseRef } from '@/lib/refs';
import type { Price, PriceKind } from '@/lib/types';
import type { VerseLoc } from '@/lib/refs';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { PriceGrid, PriceScale, gridKey } from '@/components/Price';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
/** A unit's worth as the text and notes give it: 1/128 rather than 0.0078. */
const share = (n: number) => (n < 1 && Number.isInteger(1 / n) ? `1/${1 / n}` : fmt(n));
const go = (p: Price) => goTo(parseRef(p.ref)!.start, { feature: cardId({ kind: 'price', id: p.id }) });

/** How one piece of a price is reckoned: "130 shekels × 30 days", "a weight of gold, ×13 for silver". */
function PartRow({ p, part }: { p: Price; part: PricePart }) {
  const era = eraOf(p);
  const how = (() => {
    if (part.good) { const g = goodOf(part.good.good)!; return { text: `${fmt(part.good.n)} × ${g.name} at ≈${fmt(g.days)} days`, basis: g.basis }; }
    const s = part.sum!, u = unitIn(era, s.unit)!;
    const gold = s.gold && !u.coin ? ` × ${WORTH.gold.ratio} for gold` : '';
    const b = unitIn(era, era.base)!;
    const base = s.unit === era.base ? '' : ` × ${share(u.value)} ${u.value > 1 ? b.plural : b.name}`;
    return { text: `${fmt(s.n)} ${s.n === 1 ? u.name : u.plural}${base}${gold}${era.days === 1 ? '' : ` × ${era.days} days`}`, basis: u.basis };
  })();
  return (
    <tr>
      <td><q>{part.quote}</q>{part.ref !== p.ref && <> <span className="muted">({formatRef(part.ref)})</span></>}</td>
      <td title={how.basis}>{how.text}</td>
      <td className="n">{shortDays(part.days)}</td>
    </tr>
  );
}

function PriceCard({ p, loc, here }: { p: Price; loc: VerseLoc; here: boolean }) {
  const era = eraOf(p);
  const parts = priceParts(p);
  const days = priceDays(p);
  const grid = gridOf(p);
  const insight = p.insight ? INSIGHT_BY_ID.get(p.insight) : undefined;
  return (
    <div className={`card price-card${here ? ' here' : ''}`} id={cardId({ kind: 'price', id: p.id })}>
      <h3><span style={{ flex: 1 }}>{p.what[0].toUpperCase() + p.what.slice(1)}</span><ConfidenceBadge c={daysLabel(p).startsWith('≈') ? 'estimate' : 'evidence'} /></h3>
      <div className="verses">
        {priceRefs(p).map((r) => <RefChip key={r} r={r} here={contains(r, loc)} />)}
        <span className="chip">{KIND_LABEL[p.kind]}</span>
        <span className="chip" title={era.basis}>{era.label}</span>
      </div>
      <p className="price-total"><b>{daysLabel(p)}</b> <span className="muted">({fmt(Math.round(days * 100) / 100)} {days === 1 ? 'day' : 'days'})</span></p>
      {contextLines(p).map((c) => <p key={c} className="price-ctx">{c}</p>)}
      {grid && <PriceGrid days={grid.days} />}
      <p className="price-key">{grid?.each ? `each one’s share: ${gridKey(grid.days)}` : gridKey(days)}</p>
      <PriceScale p={p} onPick={go} />
      <table className="price-parts">
        <tbody>{parts.map((x, i) => <PartRow key={i} p={p} part={x} />)}</tbody>
      </table>
      {p.uncounted && <p className="price-note">Not counted: {p.uncounted}.</p>}
      {p.estimate && <p className="price-note">≈ {p.estimate}</p>}
      {p.note && <p className="price-note">{p.note}</p>}
      {p.compare && <SourceList sources={[p.compare.source]} />}
      {insight && <p className="price-note"><button className="marks-toggle" onClick={() => openTab('insights', { feature: cardId({ kind: 'insight', id: insight.id }) })}>{insight.title}</button></p>}
    </div>
  );
}

/** Every sum in the Bible on one logarithmic scale, largest first, filtered by kind. */
function Ladder({ chapter }: { chapter: Set<Price> }) {
  const [kind, setKind] = useState<PriceKind | null>(null);
  const shown = BY_WORTH.filter((p) => !kind || p.kind === kind);
  return (
    <div className="card" id="worth-ladder">
      <h3>On one scale</h3>
      <p className="summary">Every sum the Bible names, largest first, each bar on the same logarithmic scale; this chapter’s are marked.</p>
      <div className="reign-modes price-kinds" role="group" aria-label="Kind">
        <button aria-pressed={!kind} onClick={() => setKind(null)}>All</button>
        {WORTH.kinds.map((k) => <button key={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      <ol className="price-ladder">
        {shown.map((p) => (
          <li key={p.id} className={chapter.has(p) ? 'here' : undefined}>
            <button onClick={() => go(p)} title={`${formatRef(p.ref)}: ${p.what}`}>
              <span className="what">{p.what}</span>
              <span className="ref">{formatRef(p.ref)}</span>
              <span className="bar"><span style={{ '--at': scaleAt(priceDays(p)) } as CSSProperties} /></span>
              <span className="n">{(daysLabel(p).startsWith('≈') ? '≈ ' : '') + shortDays(priceDays(p))}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What the days rest on: the working day and year, each era's wage and coins, the livestock prices, and gold. */
function Reckoning() {
  return (
    <div className="card" id={cardId({ kind: 'price', id: WORTH.id })}>
      <h3><span style={{ flex: 1 }}>How the sums are reckoned</span><ConfidenceBadge c={WORTH.confidence} /></h3>
      <p className="summary">{WORTH.summary}</p>
      <p className="price-note">{WORTH.yardstick.hours}</p>
      <p className="price-note">{WORTH.yardstick.year}</p>
      {WORTH.eras.map((e) => (
        <div key={e.id} className="price-era">
          <h4>{e.label}: a day is {e.days === 1 ? `a ${e.base}` : `1/${e.days} ${e.base}`}</h4>
          <p className="price-note">{e.basis}</p>
          <table className="price-parts">
            <tbody>
              {e.units.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td className="n">{u.estimated ? '≈' : ''}{shortDays(u.value * e.days)}</td><td>{u.basis}</td></tr>
              ))}
            </tbody>
          </table>
          <SourceList sources={e.sources} />
        </div>
      ))}
      <div className="price-era">
        <h4>Gold</h4>
        <p className="price-note">{WORTH.gold.basis}</p>
      </div>
      <div className="price-era">
        <h4>Given in kind</h4>
        <table className="price-parts">
          <tbody>{WORTH.goods.map((g) => <tr key={g.id}><td>{g.name}</td><td className="n">≈{shortDays(g.days)}</td><td>{g.basis}</td></tr>)}</tbody>
        </table>
        <SourceList sources={WORTH.goodsSources} />
      </div>
      <div className="price-era">
        <h4>Not priced</h4>
        {WORTH.unpriced.map((u) => (
          <p key={u.why} className="price-note">{u.why} <span className="verses">{u.refs.map((r) => <RefChip key={r} r={r} />)}</span></p>
        ))}
      </div>
      <SourceList sources={WORTH.sources} />
    </div>
  );
}

/** Every sum the chapter names in wages, then every sum in the Bible on one scale, then what the figures rest on. */
export function WorthPanel() {
  const loc = useStore((s) => s.loc);
  useFeatureInView();
  // In the order the chapter names them.
  const at = (p: Price) => { const r = priceSources(p).map((x) => parseRef(x)!.start).find((l) => l.book === loc.book && l.chapter === loc.chapter); return r ? r.verse : 0; };
  const here = pricesInChapter(loc.book, loc.chapter).sort((a, b) => at(a) - at(b));
  const inVerse = (p: Price) => priceRefs(p).some((r) => contains(r, loc)) || priceParts(p).some((x) => contains(x.ref, loc));
  return (
    <div className="panel-body worth-pane">
      <div className="panel-title">What it was worth, in days of a labourer’s wage</div>
      {here.length
        ? here.map((p) => <PriceCard key={p.id} p={p} loc={loc} here={inVerse(p)} />)
        : <div className="empty">This chapter names no sum of money. Every one that does is on the scale below.</div>}
      <Ladder chapter={new Set(here)} />
      <Reckoning />
    </div>
  );
}
