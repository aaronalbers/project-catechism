import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, type Edge, type Node } from 'vis-network';
import { DataSet } from 'vis-data';
import { goTo, openPerson, setState, useStore } from '@/app/store';
import { PEOPLE, PEOPLE_BY_ID, PROFILE_BY_PERSON, PROFILE_INDEX, peopleFor, peopleInChapter, speakerFor, writersFor } from '@/lib/content';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { book as bookOf, formatRef, parseRef } from '@/lib/refs';
import type { Confidence, Family, Person, Source } from '@/lib/types';
import { loadFamilies } from '@/lib/data';
import { formatYear } from '@/lib/format';
import { namedInChapter, usePeopleInBook, type Named } from '@/lib/people';
import { cardId } from '@/lib/catalog';
import { Profile } from './Profile';
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

/** Who speaks or wrote the verse, as a row like a named person's: it opens the person when the people data has
 *  them (not God, an angel or an unknown writer), and says underneath what the attribution rests on. */
function Credit({ name, person, life, confidence, summary, sources, traditions }: { name: string; person?: string; life?: string; confidence?: Confidence; summary?: string; sources?: Source[]; traditions?: string[] }) {
  const prof = person ? PROFILE_BY_PERSON.get(person) : undefined;
  const row = <>
    {prof?.thumb ? <img className="thumb" src={prof.thumb} alt="" loading="lazy" /> : <span className={`thumb initial${person ? '' : ' none'}`} aria-hidden="true">{name.replace(/^\W+/, '')[0]}</span>}
    <span className="who">
      <span className="name">{name}{prof && <span className="chip profiled" title="Has a written profile">Profile</span>}</span>
      {life && <span className="life">{life}</span>}
    </span>
    {confidence && <ConfidenceBadge c={confidence} />}
  </>;
  return (
    <div className="credit">
      {person ? <button className="person named" onClick={() => openPerson(person)}>{row}</button> : <div className="person named static">{row}</div>}
      {(summary || sources?.length) && <details>
        <summary>What this rests on</summary>
        {summary && <p className="summary">{summary}</p>}
        {sources && <SourceList sources={sources} traditions={traditions} />}
      </details>}
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
  // A genealogy card picked in the tree belongs to its chapter; "← all in this chapter" would name another.
  useEffect(() => setSelected(null), [loc.book, loc.chapter]);
  const person = useStore((s) => s.person);
  const feature = useStore((s) => s.feature);
  const byBook = usePeopleInBook(loc.book);
  const named = useMemo(() => byBook ? namedInChapter(byBook, loc.chapter) : [], [byBook, loc.chapter]);
  // A link from the index goes to a profile by its card id.
  useEffect(() => {
    const prof = feature && PROFILE_INDEX.find((p) => cardId({ kind: 'profile', id: p.id }) === feature);
    if (prof) setState({ person: prof.people[0], feature: null });
  }, [feature]);

  // Every family, laid out at build time; the tab draws the one the verse's people belong to.
  const [families, setFamilies] = useState<Family[]>();
  useEffect(() => { loadFamilies().then(setFamilies).catch(() => setFamilies([])); }, []);
  const familyOf = useMemo(() => new Map((families ?? []).flatMap((f, i) => f.n.map((x) => [x[0], i] as const))), [families]);
  // A curated entry is drawn as the TIPNR person it is; the few the text leaves unnamed keep their curated id.
  const nodeOf = (p: Person) => p.tipnr ?? p.id;
  const speakers = speakerFor(loc);
  const writers = writersFor(loc);
  // The people the verse itself names; a verse that names no one frames who is speaking it (Mary through the
  // Magnificat), and only then the curated passages (Abijah's 1 Kings 15:1–8), which would otherwise pull the
  // frame away from David in 15:5.
  const inVerse = named.filter((x) => x.verses.includes(loc.verse)).map((x) => x.id).filter((id) => familyOf.has(id));
  const speaking = speakers.flatMap((sp) => (sp.person && familyOf.has(sp.person) ? [sp.person] : []));
  const focus = inVerse.length ? inVerse : speaking.length ? speaking : here.map(nodeOf).filter((id) => familyOf.has(id));
  // The family to draw: the verse's, else the first the chapter names someone in.
  const familyIndex = focus.length ? familyOf.get(focus[0]) : named.map((x) => familyOf.get(x.id)).find((i) => i !== undefined);
  const family = familyIndex === undefined ? undefined : families![familyIndex];
  const focusKey = focus.filter((id) => familyOf.get(id) === familyIndex).join('|');

  // Draw the family only when it changes (it is already laid out); verse-to-verse updates restyle and glide below.
  useEffect(() => {
    if (!el.current || !family) return;
    const css = getComputedStyle(document.documentElement);
    const nodes = new DataSet<Node>(family.n.map(([id, name, sex, x, y]) => ({
      id, label: name, x, y,
      color: { background: sex === 'f' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: css.getPropertyValue('--border') },
      borderWidth: 1, font: { color: css.getPropertyValue('--accent-ink'), size: 13 }, shape: 'box', margin: { top: 6, right: 8, bottom: 6, left: 8 },
    })));
    const muted = css.getPropertyValue('--muted'), estimate = css.getPropertyValue('--estimate'), border = css.getPropertyValue('--border');
    const edges = new DataSet<Edge>(family.e.map(([from, to, kind, note]) => ({
      id: `${kind}-${from}-${to}`, from, to, title: note,
      ...(kind === 'spouse' ? { dashes: [2, 4], color: { color: border, opacity: 0.9 } }
        // Alternate parentage (the two NT genealogies disagree), TIPNR's uncertain links, and TIPNR reading a
        // parent otherwise are drawn dashed, with what they rest on on hover.
        : kind === 'parent' ? { arrows: 'to', color: { color: muted, opacity: 0.6 } }
        : { arrows: 'to', dashes: kind === 'uncertain' ? [4, 4] : true, color: { color: estimate, opacity: kind === 'uncertain' ? 0.6 : 0.9 } }),
    })));
    net.current?.destroy();
    net.current = new Network(el.current, { nodes, edges }, {
      layout: { hierarchical: false }, physics: false,
      interaction: { hover: true, zoomView: true, dragView: true, dragNodes: false },
      edges: { smooth: false }, nodes: { shape: 'box' },
    });
    nodeSet.current = nodes;
    fresh.current = true;
    // A node opens that person's profile; one of the few the text leaves unnamed, their genealogy card.
    net.current.on('click', (params: { nodes: string[] }) => {
      const id = params.nodes[0];
      if (!id) return;
      const curated = PEOPLE_BY_ID.get(id);
      if (curated) setSelected(curated); else openPerson(id);
    });
    return () => { net.current?.destroy(); net.current = null; nodeSet.current = null; };
    // Rebuilt on leaving a profile too, which unmounts the graph's container.
  }, [family, person]);

  // Highlight the verse's people, outline the chapter's, and glide to them. Restyling does not move anyone.
  useEffect(() => {
    const n = net.current, nodes = nodeSet.current;
    if (!n || !nodes || !family) return;
    const css = getComputedStyle(document.documentElement);
    const hereIds = new Set(focusKey ? focusKey.split('|') : []);
    const chapterIds = new Set(named.map((x) => x.id));
    nodes.update(family.n.map(([id, , sex]) => ({
      id, borderWidth: hereIds.has(id) ? 3 : chapterIds.has(id) ? 2 : 1,
      color: { background: sex === 'f' ? css.getPropertyValue('--interpretation') : css.getPropertyValue('--accent'), border: hereIds.has(id) ? css.getPropertyValue('--danger') : chapterIds.has(id) ? css.getPropertyValue('--accent-ink') : css.getPropertyValue('--border') },
    })));
    // Frame the verse's first person, then add their parents and the verse's others, each with theirs, while all
    // still read: in a family of a thousand a parent can stand far along the row from a child (Jesse from David,
    // across Judah's clans), and framing both would shrink every box to a dash. The curated come first; whoever
    // is left out is still outlined, a pan away. A verse that names no one in the family frames the chapter's.
    const parentsOf = (id: string) => family.e.filter(([, to, kind]) => kind !== 'spouse' && to === id).map(([from]) => from);
    const readable = (group: string[]) => {
      const bb = group.map((id) => n.getBoundingBox(id)).filter((b) => b);
      const w = Math.max(...bb.map((b) => b.right)) - Math.min(...bb.map((b) => b.left)), h = Math.max(...bb.map((b) => b.bottom)) - Math.min(...bb.map((b) => b.top));
      return Math.min(el.current!.clientWidth / w, el.current!.clientHeight / h) >= MIN_FRAME_SCALE;
    };
    const curatedIds = new Set(family.n.filter((x) => x[5] || PEOPLE_BY_ID.has(x[0])).map((x) => x[0]));
    const seeds = hereIds.size ? [...hereIds] : family.n.map((x) => x[0]).filter((id) => chapterIds.has(id));
    let frame: string[] = [];
    for (const id of seeds.sort((a, b) => Number(!curatedIds.has(a)) - Number(!curatedIds.has(b)))) {
      for (const add of [[id], parentsOf(id)]) {
        const next = [...new Set([...frame, ...add])];
        if (!frame.length || readable(next)) frame = next;
      }
    }
    if (frame.length) n.fit({ nodes: frame, maxZoomLevel: 1.2, animation: fresh.current ? false : { duration: 450, easingFunction: 'easeInOutQuad' } });
    fresh.current = false;
  }, [family, focusKey, named, person]);

  if (person) return <Profile id={person} />;
  const list = selected ? [selected] : [];
  const hereNamed = named.filter((n) => n.verses.includes(loc.verse));
  const restNamed = named.filter((n) => !n.verses.includes(loc.verse));
  return (
    <div className="panel-body flush">
      {/* Distinct keys: vis-network wipes its container on destroy, which would erase React's children if the div were reused. */}
      {family ? <div key="graph" className="graph" ref={el} role="img" aria-label="Family relationships" /> : null}
      <Lifespans people={graphPeople} />
      <div className="people-list">
        {selected && <button className="chip link" onClick={() => setSelected(null)}>← all in this chapter</button>}
        {!selected && speakers.length > 0 && <><div className="panel-title">Speaking in verse {loc.verse}</div>{speakers.map((sp) => <Credit key={sp.id} name={sp.speaker} person={sp.person} life={formatRef(sp.ref)} summary={sp.summary} sources={sp.sources} />)}</>}
        {!selected && writers.length > 0 && <><div className="panel-title">{loc.book === 'Ps' ? `Who wrote Psalm ${loc.chapter}` : `Who wrote ${bookOf(loc.book)?.name}`}</div>{writers.map((w) => <Credit key={w.id} name={w.name} person={w.person} confidence={w.confidence} summary={w.summary} sources={w.sources} traditions={w.traditions} />)}</>}
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
