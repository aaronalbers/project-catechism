import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, type Edge, type Node } from 'vis-network';
import { DataSet } from 'vis-data';
import { goTo, useStore } from '@/app/store';
import { PEOPLE, PEOPLE_BY_ID, peopleFor, peopleInChapter } from '@/lib/content';
import { RefChip, SourceList } from '@/components/SourceList';
import { parseRef } from '@/lib/refs';
import type { Person } from '@/lib/types';

/** People named in this chapter plus their close kin, so the graph has context without becoming the whole Bible. */
function neighbourhood(seed: Person[], depth = 2): Person[] {
  const seen = new Map<string, Person>();
  const frontier: [Person, number][] = seed.map((p) => [p, 0]);
  const childrenOf = new Map<string, Person[]>();
  for (const p of PEOPLE) for (const par of [p.father, p.mother]) if (par) (childrenOf.get(par) ?? childrenOf.set(par, []).get(par)!).push(p);
  while (frontier.length) {
    const [p, d] = frontier.shift()!;
    if (seen.has(p.id)) continue;
    seen.set(p.id, p);
    if (d >= depth) continue;
    for (const id of [p.father, p.mother, ...(p.spouses ?? []), ...(p.altParents ?? []).map((a) => a.id)]) { const q = id && PEOPLE_BY_ID.get(id); if (q) frontier.push([q, d + 1]); }
    for (const c of childrenOf.get(p.id) ?? []) frontier.push([c, d + 1]);
  }
  return [...seen.values()];
}

const life = (p: Person) => {
  const est = p.estimated ? <span className="est" title="Estimated — see the person's notes">≈ </span> : null;
  if (p.bornAM !== undefined) return <>{est}{p.bornAM}{p.diedAM !== undefined ? `–${p.diedAM} AM (lived ${p.diedAM - p.bornAM})` : ' AM'}</>;
  if (p.born !== undefined) return <>{est}{p.born < 0 ? `${-p.born} BC` : `AD ${p.born}`}{p.died !== undefined ? ` – ${p.died < 0 ? `${-p.died} BC` : `AD ${p.died}`}` : ''}</>;
  return null;
};

function Lifespans({ people }: { people: Person[] }) {
  const am = people.filter((p) => p.bornAM !== undefined && p.diedAM !== undefined);
  const bc = people.filter((p) => p.born !== undefined && p.died !== undefined);
  const mode = am.length >= bc.length ? 'AM' : 'BC';
  const rows = (mode === 'AM' ? am : bc).map((p) => ({ p, a: mode === 'AM' ? p.bornAM! : p.born!, b: mode === 'AM' ? p.diedAM! : p.died! })).sort((x, y) => x.a - y.a);
  if (rows.length < 2) return null;
  const min = Math.min(...rows.map((r) => r.a)), max = Math.max(...rows.map((r) => r.b));
  const W = 380, H = rows.length * 18 + 30, L = 96;
  const x = (y: number) => L + ((y - min) / Math.max(1, max - min)) * (W - L - 8);
  const ticks = 5;
  const anyEst = rows.some((r) => r.p.estimated);
  return (
    <div style={{ padding: '10px 16px 0' }}>
      <div className="panel-title">Lifespans ({mode === 'AM' ? 'years from creation, summed from Genesis 5 & 11' : 'BC / AD'}){anyEst && <> · <span className="est">≈ estimated</span></>}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ fontFamily: 'var(--sans)', fontSize: 10 }}>
        {Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks).map((y, i) => (
          <g key={i}><line x1={x(y)} x2={x(y)} y1={16} y2={H - 12} stroke="var(--border)" /><text x={x(y)} y={11} textAnchor="middle" fill="var(--muted)">{mode === 'AM' ? Math.round(y) : y < 0 ? `${Math.round(-y)} BC` : `AD ${Math.round(y)}`}</text></g>
        ))}
        {rows.map((r, i) => (
          <g key={r.p.id} transform={`translate(0 ${22 + i * 18})`} style={{ cursor: 'pointer' }} onClick={() => { const ref = parseRef(r.p.refs[0]); if (ref) goTo(ref.start); }}>
            <text x={L - 6} y={10} textAnchor="end" fill="var(--text)">{r.p.name}</text>
            <rect x={x(r.a)} y={2} width={Math.max(2, x(r.b) - x(r.a))} height={11} rx={3} fill={r.p.sex === 'female' ? 'var(--interpretation)' : 'var(--accent)'} opacity={r.p.estimated ? 0.45 : 0.9} strokeDasharray={r.p.estimated ? '3 2' : undefined} stroke={r.p.estimated ? 'var(--estimate)' : 'none'} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PeoplePanel() {
  const loc = useStore((s) => s.loc);
  const here = useMemo(() => peopleFor(loc), [loc]);
  const inChapter = useMemo(() => peopleInChapter(loc.book, loc.chapter), [loc.book, loc.chapter]);
  // Key the graph on the seed ids, not `here`'s identity: moving verse within a chapter keeps the same tree.
  const seedIds = (inChapter.length ? inChapter : here).map((p) => p.id).join('|');
  const graphPeople = useMemo(() => {
    const seed = seedIds ? seedIds.split('|').map((id) => PEOPLE_BY_ID.get(id)!) : [];
    return neighbourhood(seed, seed.length > 12 ? 1 : 2);
  }, [seedIds]);
  const el = useRef<HTMLDivElement>(null);
  const net = useRef<Network | null>(null);
  const nodeSet = useRef<DataSet<Node> | null>(null);
  const fresh = useRef(true);
  const [selected, setSelected] = useState<Person | null>(null);

  // Build the tree only when its node set changes; verse-to-verse updates restyle and pan it below.
  useEffect(() => {
    if (!el.current) return;
    const ids = new Set(graphPeople.map((p) => p.id));
    const css = getComputedStyle(document.documentElement);
    const nodes = new DataSet<Node>(graphPeople.map((p) => ({
      id: p.id, label: p.name, level: p.generation,
      color: { background: p.sex === 'female' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: css.getPropertyValue('--border') },
      borderWidth: 1, font: { color: css.getPropertyValue('--accent-ink'), size: 13 }, shape: 'box', margin: { top: 6, right: 8, bottom: 6, left: 8 },
    })));
    const edges = new DataSet<Edge>(graphPeople.flatMap((p) => [
      ...[p.father, p.mother].filter((x): x is string => !!x && ids.has(x)).map((par) => ({ id: `${par}-${p.id}`, from: par, to: p.id, arrows: 'to', color: { color: css.getPropertyValue('--muted'), opacity: 0.6 } })),
      // Alternate parentage (the two NT genealogies disagree) is drawn dashed with its citation on hover.
      ...(p.altParents ?? []).filter((a) => ids.has(a.id)).map((a) => ({ id: `alt-${a.id}-${p.id}`, from: a.id, to: p.id, arrows: 'to', dashes: true, title: `Alternate: ${a.note}`, color: { color: css.getPropertyValue('--estimate'), opacity: 0.9 } })),
      ...(p.spouses ?? []).filter((s) => ids.has(s) && s > p.id).map((s) => ({ id: `sp-${p.id}-${s}`, from: p.id, to: s, dashes: [2, 4], color: { color: css.getPropertyValue('--border'), opacity: 0.9 } })),
    ]));
    net.current?.destroy();
    net.current = new Network(el.current, { nodes, edges }, {
      layout: { hierarchical: { direction: 'UD', sortMethod: 'directed', levelSeparation: 70, nodeSpacing: 110 } },
      physics: false, interaction: { hover: true, zoomView: true, dragView: true },
      nodes: { shape: 'box' },
    });
    nodeSet.current = nodes;
    fresh.current = true;
    net.current.on('click', (params: { nodes: string[] }) => { const id = params.nodes[0]; setSelected(id ? PEOPLE_BY_ID.get(id) ?? null : null); });
    return () => { net.current?.destroy(); net.current = null; nodeSet.current = null; };
  }, [graphPeople]);

  // Highlight the verse's people and glide the viewport to them. Colour/border updates don't trigger a relayout in vis-network.
  useEffect(() => {
    const n = net.current, nodes = nodeSet.current;
    if (!n || !nodes) return;
    const css = getComputedStyle(document.documentElement);
    const hereIds = new Set(here.map((p) => p.id));
    nodes.update(graphPeople.map((p) => ({
      id: p.id, borderWidth: hereIds.has(p.id) ? 3 : 1,
      color: { background: p.sex === 'female' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: hereIds.has(p.id) ? css.getPropertyValue('--danger') : css.getPropertyValue('--border') },
    })));
    // Frame the verse's people with their immediate kin; the rest of the neighbourhood is a pan away.
    const frame = graphPeople.filter((p) => hereIds.has(p.id) || (p.father && hereIds.has(p.father)) || (p.mother && hereIds.has(p.mother)) || (p.father && here.some((h) => h.father === p.father))).map((p) => p.id);
    n.fit({ nodes: frame, maxZoomLevel: 1.2, animation: fresh.current ? false : { duration: 450, easingFunction: 'easeInOutQuad' } });
    fresh.current = false;
  }, [graphPeople, here]);

  const list = selected ? [selected] : here.length ? here : inChapter;
  return (
    <div className="panel-body flush">
      {/* Distinct keys: vis-network wipes its container on destroy, which would erase React's children if the div were reused. */}
      {graphPeople.length ? <div key="graph" className="graph" ref={el} role="img" aria-label="Family relationships" /> : <div key="empty" className="empty"><p>No people from the genealogy tables are indexed to this chapter yet.</p><small>Add them in <code>content/people.json</code>.</small></div>}
      <Lifespans people={graphPeople} />
      <div className="people-list">
        {selected && <button className="chip link" onClick={() => setSelected(null)}>← all in this chapter</button>}
        {list.map((p) => (
          <div className="person" key={p.id}>
            <div className="name">{p.name} {p.sex === 'female' && <span className="chip">♀</span>}</div>
            {life(p) && <div className="life">{life(p)}</div>}
            <div className="life">
              {p.father && <>father: {PEOPLE_BY_ID.get(p.father)?.name} </>}
              {p.mother && <>· mother: {PEOPLE_BY_ID.get(p.mother)?.name} </>}
              {p.altParents?.map((a) => <span key={a.id} className="est" title={a.note}>· or {PEOPLE_BY_ID.get(a.id)?.name} ({a.note})</span>)}
            </div>
            {p.notes && <div className="life">{p.notes}</div>}
            <div className="verses" style={{ marginTop: 4 }}>{p.refs.map((r) => <RefChip key={r} r={r} />)}</div>
            {p.sources && <SourceList sources={p.sources} />}
          </div>
        ))}
        <div className="sources"><ol><li><span className="skind">Scripture</span>Relationships follow the genealogies cited on each person (Genesis 5, 10–11, 25, 36, 46; Exodus 6; 1 Chronicles 1–2; Matthew 1; Luke 3). Anno Mundi years are simple sums of the ages given in Genesis 5 and 11, which assumes no generational gaps — a reading, not a measurement.</li></ol></div>
      </div>
    </div>
  );
}
