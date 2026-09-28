import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, type Edge, type Node } from 'vis-network';
import { DataSet } from 'vis-data';
import { goTo, openPerson, setState, useStore } from '@/app/store';
import { PEOPLE, PEOPLE_BY_ID, PROFILE_BY_PERSON, PROFILE_INDEX, peopleFor, peopleInChapter } from '@/lib/content';
import { RefChip, SourceList } from '@/components/SourceList';
import { book as bookOf, parseRef } from '@/lib/refs';
import type { Person } from '@/lib/types';
import { formatYear } from '@/lib/format';
import { namedFor, namedInChapter, usePeopleInBook, type Named } from '@/lib/people';
import { cardId } from '@/lib/catalog';
import { Profile } from './Profile';
import { curatedFor, familyTree } from '@/lib/tree';
import { PeopleSources } from './PeopleSources';

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

/** The least zoom the family tree frames a verse's people at; below it the names cannot be read. */
const MIN_FRAME_SCALE = 0.6;
const life = (p: Person) => {
  const est = p.estimated ? <span className="est" title="Estimated — see the person's notes">≈ </span> : null;
  if (p.bornAM !== undefined) return <>{est}{p.bornAM}{p.diedAM !== undefined ? `–${p.diedAM} AM (lived ${p.diedAM - p.bornAM})` : ' AM'}</>;
  if (p.born !== undefined) return <>{est}{formatYear(p.born)}{p.died !== undefined ? ` – ${formatYear(p.died)}` : ''}</>;
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
          <g key={i}><line x1={x(y)} x2={x(y)} y1={16} y2={H - 12} stroke="var(--border)" /><text x={x(y)} y={11} textAnchor="middle" fill="var(--muted)">{mode === 'AM' ? Math.round(y) : formatYear(Math.round(y))}</text></g>
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

/** A person in the chapter's list: portrait and role when there is a profile, their kin otherwise. */
function NamedRow({ n, here = false }: { n: Named; here?: boolean }) {
  const prof = PROFILE_BY_PERSON.get(n.id);
  return (
    <button className={`person named${here ? ' here' : ''}`} onClick={() => openPerson(n.id)}>
      {prof?.thumb ? <img className="thumb" src={prof.thumb} alt="" loading="lazy" /> : <span className={`thumb initial ${n.sex}`} aria-hidden="true">{n.name[0]}</span>}
      <span className="who">
        <span className="name">{prof?.name ?? n.name}{prof && <span className="chip profiled" title="Has a written profile">Profile</span>}</span>
        <span className="life">{prof?.role ?? n.title}</span>
      </span>
      <span className="life count" title="Verses of this chapter that name them">{n.verses.length > 1 ? `vv. ${n.verses[0]}–${n.verses[n.verses.length - 1]}` : `v. ${n.verses[0]}`}</span>
    </button>
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
  const person = useStore((s) => s.person);
  const feature = useStore((s) => s.feature);
  const byBook = usePeopleInBook(loc.book);
  const named = useMemo(() => byBook ? namedInChapter(byBook, loc.chapter) : [], [byBook, loc.chapter]);
  // A tree node opens that person's profile when the chapter names them; otherwise their genealogy card.
  const pick = useRef((_p: Person | null) => {});
  pick.current = (p) => {
    const n = p && namedFor(p, named, loc.book, loc.chapter);
    if (n) openPerson(n.id); else setSelected(p);
  };
  // A link from the index goes to a profile by its card id.
  useEffect(() => {
    const prof = feature && PROFILE_INDEX.find((p) => cardId({ kind: 'profile', id: p.id }) === feature);
    if (prof) setState({ person: prof.people[0], feature: null });
  }, [feature]);

  // The curated tree and, around it, everyone else the chapter names with the parents and spouses TIPNR gives them.
  const tree = useMemo(() => familyTree(graphPeople, byBook, loc.chapter), [graphPeople, byBook, loc.chapter]);

  // Build the tree only when its node set changes; verse-to-verse updates restyle and pan it below.
  useEffect(() => {
    if (!el.current) return;
    const css = getComputedStyle(document.documentElement);
    const nodes = new DataSet<Node>(tree.nodes.map((n) => ({
      id: n.id, label: n.name, level: n.level,
      color: { background: n.sex === 'female' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: css.getPropertyValue('--border') },
      borderWidth: 1, font: { color: css.getPropertyValue('--accent-ink'), size: 13 }, shape: 'box', margin: { top: 6, right: 8, bottom: 6, left: 8 },
    })));
    const muted = css.getPropertyValue('--muted'), estimate = css.getPropertyValue('--estimate'), border = css.getPropertyValue('--border');
    const edges = new DataSet<Edge>(tree.edges.map((e) => ({
      id: `${e.kind}-${e.from}-${e.to}`, from: e.from, to: e.to, title: e.note,
      ...(e.kind === 'spouse' ? { dashes: [2, 4], color: { color: border, opacity: 0.9 } }
        // Alternate parentage (the two NT genealogies disagree), TIPNR's links no verse makes, and TIPNR reading a
        // parent otherwise are drawn dashed, with what they rest on on hover.
        : e.kind === 'parent' ? { arrows: 'to', color: { color: muted, opacity: 0.6 } }
        : { arrows: 'to', dashes: e.kind === 'reading' ? [4, 4] : true, color: { color: estimate, opacity: e.kind === 'reading' ? 0.6 : 0.9 } }),
    })));
    net.current?.destroy();
    net.current = new Network(el.current, { nodes, edges }, {
      layout: { hierarchical: { direction: 'UD', sortMethod: 'directed', levelSeparation: 70, nodeSpacing: 110 } },
      physics: false, interaction: { hover: true, zoomView: true, dragView: true },
      nodes: { shape: 'box' },
    });
    nodeSet.current = nodes;
    fresh.current = true;
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    net.current.on('click', (params: { nodes: string[] }) => {
      const n = params.nodes[0] ? byId.get(params.nodes[0]) : undefined;
      if (n && !n.person) openPerson(n.id); else pick.current(n?.person ?? null);
    });
    return () => { net.current?.destroy(); net.current = null; nodeSet.current = null; };
    // Rebuilt on leaving a profile too, which unmounts the graph's container.
  }, [tree, person]);

  // Highlight the verse's people and glide the viewport to them. Colour/border updates don't trigger a relayout in vis-network.
  useEffect(() => {
    const n = net.current, nodes = nodeSet.current;
    if (!n || !nodes) return;
    const css = getComputedStyle(document.documentElement);
    const ids = new Set(tree.nodes.map((x) => x.id));
    // The people the verse itself names; only a verse that names no one falls back on the curated passages
    // (Abijah's 1 Kings 15:1–8), which would otherwise pull the frame away from David in 15:5.
    const inVerse = named.filter((x) => x.verses.includes(loc.verse)).map((x) => ids.has(x.id) ? x.id : curatedFor(x.id)).filter((x): x is string => !!x && ids.has(x));
    const hereIds = new Set(inVerse.length ? inVerse : here.map((p) => p.id));
    nodes.update(tree.nodes.map((p) => ({
      id: p.id, borderWidth: hereIds.has(p.id) ? 3 : 1,
      color: { background: p.sex === 'female' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: hereIds.has(p.id) ? css.getPropertyValue('--danger') : css.getPropertyValue('--border') },
    })));
    // Frame the verse's people with their parents (children the verse names are among them already; a clan's
    // father may have twenty others), as many as still read: someone the curated tree gives no generation
    // (Uriah in 1 Kings 15:5) can stand far from the rest, and framing both would shrink every box to a dash.
    // The curated come first; whoever is left out is still outlined, a pan away.
    const withParents = (id: string) => [id, ...tree.edges.filter((e) => e.kind !== 'spouse' && e.to === id).map((e) => e.from)];
    const readable = (group: string[]) => {
      const bb = group.map((id) => n.getBoundingBox(id)).filter((b) => b);
      const w = Math.max(...bb.map((b) => b.right)) - Math.min(...bb.map((b) => b.left)), h = Math.max(...bb.map((b) => b.bottom)) - Math.min(...bb.map((b) => b.top));
      return Math.min(el.current!.clientWidth / w, el.current!.clientHeight / h) >= MIN_FRAME_SCALE;
    };
    const curatedFirst = [...hereIds].sort((a, b) => Number(!tree.nodes.find((x) => x.id === a)?.person) - Number(!tree.nodes.find((x) => x.id === b)?.person));
    let frame: string[] = [];
    for (const id of curatedFirst) {
      const next = [...new Set([...frame, ...withParents(id)])];
      if (!frame.length || readable(next)) frame = next;
    }
    n.fit({ nodes: frame.filter((x) => ids.has(x)), maxZoomLevel: 1.2, animation: fresh.current ? false : { duration: 450, easingFunction: 'easeInOutQuad' } });
    fresh.current = false;
  }, [tree, here, named, loc.verse, person]);

  if (person) return <Profile id={person} />;
  const list = selected ? [selected] : [];
  const hereNamed = named.filter((n) => n.verses.includes(loc.verse));
  const restNamed = named.filter((n) => !n.verses.includes(loc.verse));
  return (
    <div className="panel-body flush">
      {/* Distinct keys: vis-network wipes its container on destroy, which would erase React's children if the div were reused. */}
      {tree.nodes.length ? <div key="graph" className="graph" ref={el} role="img" aria-label="Family relationships" /> : null}
      <Lifespans people={graphPeople} />
      <div className="people-list">
        {selected && <button className="chip link" onClick={() => setSelected(null)}>← all in this chapter</button>}
        {!selected && byBook === undefined && <div className="loading">Loading people…</div>}
        {!selected && byBook && !named.length && <div className="empty"><p>{bookOf(loc.book)?.beyond ? `The people list comes from STEPBible's names data, which covers only the 66 books, so it lists no one in ${bookOf(loc.book)?.name}.` : `No one is named in ${bookOf(loc.book)?.name} ${loc.chapter}.`}</p></div>}
        {!selected && hereNamed.length > 0 && <><div className="panel-title">In verse {loc.verse}</div>{hereNamed.map((n) => <NamedRow key={n.id} n={n} here />)}</>}
        {!selected && restNamed.length > 0 && <><div className="panel-title">{hereNamed.length ? 'Elsewhere in' : 'Named in'} {bookOf(loc.book)?.name} {loc.chapter}</div>{restNamed.map((n) => <NamedRow key={n.id} n={n} />)}</>}
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
        <PeopleSources />
        <div className="sources"><ol><li><span className="skind">Scripture</span>The family tree follows the genealogies cited on each person (Genesis 5, 10–11, 25, 36, 46; Exodus 6; 1 Chronicles 1–2; Matthew 1; Luke 3). Anno Mundi years are simple sums of the ages given in Genesis 5 and 11, which assumes no generational gaps — a reading, not a measurement.</li></ol></div>
      </div>
    </div>
  );
}
