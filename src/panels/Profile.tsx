import { goTo, openPerson, setState, useStore } from '@/app/store';
import { genealogyOf, usePerson, useProfile } from '@/lib/profiles';
import { ConfidenceBadge, RefChip, SourceList } from '@/components/SourceList';
import { THE_66, book as bookOf, contains, formatRef, parseRef } from '@/lib/refs';
import { formatYear } from '@/lib/format';
import { eastonParts, perBook } from '@/lib/people';
import { PeopleSources } from './PeopleSources';
import type { BiblePerson, Kin, Person, Profile as ProfileT } from '@/lib/types';

const KIN: [keyof BiblePerson, string, string][] = [
  ['father', 'Father', 'Father'], ['mother', 'Mother', 'Mother'], ['spouses', 'Spouse', 'Spouses'],
  ['children', 'Child', 'Children'], ['siblings', 'Sibling', 'Siblings'],
];

/**
 * One of someone's kin. A link the text makes names its verse on hover; one it does not is TIPNR's reading, marked
 * ≈, and one TIPNR itself marks as a reading of an ambiguous passage is marked ?.
 */
function KinChip({ k }: { k: Kin }) {
  const why = [
    k.ref ? `Where the text ties them: ${formatRef(k.ref)}` : 'TIPNR links them, but no verse near names both with a word of kinship: its reading, not the text’s',
    k.uncertain ? 'TIPNR marks this as its reading of a passage that could be read another way' : '',
  ].filter(Boolean).join('. ');
  const mark = <>{!k.ref && <span className="est">≈ </span>}{k.name}{k.uncertain && <span className="est"> ?</span>}</>;
  return k.id
    ? <button className="chip link" title={why} onClick={() => openPerson(k.id!)}>{mark}</button>
    : <span className="chip" title={`Not named in the text. ${why}`}>{mark}</span>;
}

function Family({ p }: { p: BiblePerson }) {
  const rows = KIN.map(([k, one, many]) => ({ label: (p[k] as Kin[] | undefined)?.length === 1 ? one : many, kin: p[k] as Kin[] | undefined })).filter((r) => r.kin?.length);
  if (!rows.length) return null;
  return (
    <dl className="kin">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.kin!.map((k, i) => <KinChip key={k.id ?? i} k={k} />)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A bar for each book that names them, on the whole Bible's span, so a reader sees at a glance where they belong. */
function Appearances({ refs }: { refs: string[] }) {
  const books = perBook(refs);
  if (!books.length) return null;
  const max = Math.max(...books.map((b) => b.count));
  const W = 380, H = 46, n = THE_66.length, bw = W / n, ntStart = THE_66.findIndex((b) => b.testament === 'NT');
  return (
    <div className="appearances">
      <div className="panel-title">Named in {refs.length} verse{refs.length === 1 ? '' : 's'}, in {books.length} book{books.length === 1 ? '' : 's'}</div>
      <svg viewBox={`0 0 ${W} ${H + 12}`} width="100%" role="img" aria-label="Verses naming them in each book">
        <line x1={ntStart * bw} x2={ntStart * bw} y1={0} y2={H} stroke="var(--border)" strokeDasharray="2 2" />
        <text x={2} y={H + 10} fontSize={9} fill="var(--muted)">Genesis</text>
        <text x={ntStart * bw + 2} y={H + 10} fontSize={9} fill="var(--muted)">Matthew</text>
        <text x={W - 2} y={H + 10} fontSize={9} fill="var(--muted)" textAnchor="end">Revelation</text>
        {books.map((b) => {
          const i = THE_66.findIndex((x) => x.id === b.book), h = Math.max(2, (Math.sqrt(b.count) / Math.sqrt(max)) * H);
          return (
            <rect key={b.book} x={i * bw + 0.5} y={H - h} width={Math.max(1.5, bw - 1)} height={h} rx={1} fill="var(--accent)" style={{ cursor: 'pointer' }}
              onClick={() => { const r = parseRef(b.first); if (r) goTo(r.start); }}>
              <title>{bookOf(b.book)?.name}: {b.count} verse{b.count === 1 ? '' : 's'}, first {formatRef(b.first)}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function Easton({ text, open }: { text: string[]; open: boolean }) {
  return (
    <details className="easton" open={open}>
      <summary>Easton's Bible Dictionary (1897)</summary>
      {text.map((t, i) => <p key={i}>{eastonParts(t).map((part, j) => typeof part === 'string' ? part : <button key={j} className="inline-ref" onClick={() => { const r = parseRef(part.ref); if (r) goTo(r.start); }}>{part.label}</button>)}</p>)}
      <small>Written by M. G. Easton in 1897 (public domain). Its judgements and datings are its own and are not checked here.</small>
    </details>
  );
}

function Curated({ prof }: { prof: ProfileT }) {
  const loc = useStore((s) => s.loc);
  return (
    <div className="card">
      <h3><span style={{ flex: 1 }}>What the text says</span><ConfidenceBadge c={prof.confidence} /></h3>
      <p className="summary">{prof.summary}</p>
      <div className="body">{prof.body.map((p, k) => <p key={k}>{p}</p>)}</div>
      <ol className="moments">
        {prof.moments.map((m) => (
          <li key={m.ref} className={contains(m.ref, loc) ? 'current' : undefined}><RefChip r={m.ref} /><span>{m.text}</span></li>
        ))}
      </ol>
      <SourceList sources={prof.sources} traditions={prof.traditions} />
    </div>
  );
}

function Later({ prof }: { prof: ProfileT }) {
  if (!prof.later?.length) return null;
  return (
    <>
      <div className="panel-title">Beyond the text</div>
      {prof.later.map((n, i) => (
        <div className="card later" key={i}>
          <div className="later-head"><ConfidenceBadge c={n.confidence} /></div>
          <p>{n.text}</p>
          <SourceList sources={n.sources} traditions={n.traditions} />
        </div>
      ))}
    </>
  );
}

const life = (g: Person) => g.bornAM !== undefined
  ? `${g.bornAM}${g.diedAM !== undefined ? `–${g.diedAM} AM` : ' AM'}`
  : g.born !== undefined ? `${formatYear(g.born)}${g.died !== undefined ? ` – ${formatYear(g.died)}` : ''}` : null;

export function Profile({ id }: { id: string }) {
  const p = usePerson(id);
  const loc = useStore((s) => s.loc);
  const profile = useProfile(id);
  const prof = profile ?? undefined;
  const back = <button className="chip link" onClick={() => setState({ person: null })}>← People in {bookOf(loc.book)?.name} {loc.chapter}</button>;
  if (p === undefined || profile === undefined) return <div className="panel-body">{back}<div className="loading">Loading…</div></div>;
  if (p === null) return <div className="panel-body">{back}<div className="empty">No one with the id {id} in the people data.</div></div>;
  const img = prof?.media?.find((m) => m.type === 'image');
  const g = genealogyOf(p.id, p.name, p.refs);
  const years = g ? life(g) : null;
  return (
    <div className="panel-body profile">
      {back}
      <header className="profile-head">
        {img && (
          <figure className="portrait">
            <a href={img.creditUrl} target="_blank" rel="noreferrer"><img src={img.src} alt={img.caption} /></a>
            <figcaption>{img.caption} {img.credit && <>— {img.creditUrl ? <a href={img.creditUrl} target="_blank" rel="noreferrer">{img.credit}</a> : img.credit}{img.license && <>, {img.license}</>}</>}<span className="depiction">An artist's imagining, not a likeness.</span></figcaption>
          </figure>
        )}
        <h2>{prof?.name ?? p.name}</h2>
        {(prof?.role ?? p.title) && <div className="role">{prof?.role ?? p.title}</div>}
        <div className="facts">
          {prof?.when && <span className="est" title={prof.whenBasis}>{prof.when}</span>}
          {!prof?.when && years && <span className={g!.estimated ? 'est' : undefined} title={g!.notes}>{g!.estimated ? '≈ ' : ''}{years}</span>}
          {p.also?.length ? <span>also called {p.also.join(', ')}</span> : null}
          {p.sex === 'female' && <span className="chip">♀</span>}
        </div>
        {prof?.when && prof.whenBasis && <p className="when-basis"><span className="est">≈</span> {prof.whenBasis}</p>}
      </header>
      <Family p={p} />
      {g && <p className="tree-note">In the family tree of the genealogies{years ? <> ({years})</> : null}. <button className="chip link" onClick={() => { const r = parseRef(g.refs[0]); if (r) goTo(r.start); setState({ person: null }); }}>Show in the tree</button></p>}
      <Appearances refs={p.refs} />
      {prof && <Curated prof={prof} />}
      {prof && <Later prof={prof} />}
      {p.easton && !prof?.eastonWrong && <Easton text={p.easton} open={!prof} />}
      {prof?.eastonWrong && <p className="tree-note">The people data links {prof.name} to Easton's entry on {prof.eastonWrong}, so it is left out here.</p>}
      {!prof && !p.easton && <div className="empty"><p>Nothing more is written about {p.name} here yet.</p><small>Only the verses that name them are known.</small></div>}
      <PeopleSources />
    </div>
  );
}
