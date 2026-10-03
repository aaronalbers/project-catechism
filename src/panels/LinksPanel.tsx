import { useEffect, useState } from 'react';
import { follow, useFeatureInView, useStore } from '@/app/store';
import { loadParallels, loadVerseText, loadXrefs } from '@/lib/data';
import { chiasmsFor, fragmentsFor, fulfilmentRefs, propheciesFor, quotesFor, talliesFor, rulersFor } from '@/lib/content';
import { book, contains, formatRef, parseRef, type VerseLoc } from '@/lib/refs';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Fulfilment, Prophecy, Xrefs } from '@/lib/types';
import { LinkCircle } from './LinkCircle';
import { label } from '@/components/Chiasm';
import { depth } from '@/lib/chiasm';
import { cardId } from '@/lib/catalog';
import { formatYear } from '@/lib/format';

function XrefRow({ to, votes }: { to: string; votes?: number }) {
  const [text, setText] = useState('');
  const r = parseRef(to);
  useEffect(() => { if (r) loadVerseText(r.start.book, r.start.chapter, r.start.verse).then((t) => setText(t ?? '')); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li>
      <button className="chip link" onClick={() => r && follow(to)}>{formatRef(to)}</button>
      <span className="txt">{text.length > 110 ? text.slice(0, 110) + '…' : text}</span>
      {votes !== undefined && <span className="votes" title="Reader votes on OpenBible.info">{votes}</span>}
    </li>
  );
}

/** R. H. Charles's cross references touching this verse: from a verse of 1 Enoch to the 66, or back to 1 Enoch. */
function useParallels(loc: { book: string; chapter: number; verse: number }) {
  const [all, setAll] = useState<[string, string][]>([]);
  useEffect(() => { loadParallels().then(setAll); }, []);
  return all.flatMap(([en, to]) => contains(en, loc) ? [to] : contains(to, loc) ? [en] : []);
}

/**
 * Foretold, then fulfilled, as two labelled steps joined by a line: a ring where it is foretold and a dot where it
 * comes true, as the reader's margin marks them. A fulfilment told apart from the verse that names it (Matthew's
 * birth narrative and his "to fulfill what was spoken") shows the event, noted at that verse. The step holding the
 * verse being read is marked.
 */
function ProphecyPath({ p, role, loc }: { p: Prophecy; role: 'foretold' | 'fulfilled'; loc: VerseLoc }) {
  const hereIn = (f: Fulfilment) => fulfilmentRefs(f).some((r) => contains(r, loc));
  // Where the event and the note overlap (Matt 1:18-25 and 1:22-23), the note is the closer match.
  const noteHere = (f: Fulfilment) => contains(f.ref, loc);
  return (
    <div className="prophecy-path">
      <div className={`pp-step foretold${role === 'foretold' ? ' here' : ''}`}>
        <span className="pp-label">Foretold</span>
        <div className="pp-refs"><div className="pp-ref"><RefChip r={p.foretold} here={role === 'foretold'} />{role === 'foretold' && <span className="pp-here">here</span>}</div></div>
      </div>
      <div className={`pp-step fulfilled${role === 'fulfilled' ? ' here' : ''}`}>
        <span className="pp-label">Fulfilled</span>
        <div className="pp-refs">
          {p.fulfilled.map((f) => (
            <div key={f.ref} className="pp-ref">
              <RefChip r={f.event ?? f.ref} here={hereIn(f) && !(f.event && noteHere(f))} />
              {f.event && <span className="pp-note">noted at <RefChip r={f.ref} here={noteHere(f)} /></span>}
              {hereIn(f) && <span className="pp-here">here</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const fmtYear = (y: number, est?: boolean) => <>{est && <span className="est" title="Estimated">≈</span>}{formatYear(y)}</>;

export function LinksPanel() {
  const loc = useStore((s) => s.loc);
  const [xrefs, setXrefs] = useState<Xrefs>({});
  useEffect(() => {
    let live = true;
    setXrefs({});
    loadXrefs(loc.book).then((x) => live && setXrefs(x));
    return () => { live = false; };
  }, [loc.book]);
  const refs = (xrefs[`${loc.chapter}.${loc.verse}`] ?? []).slice(0, 12);
  const parallels = useParallels(loc);
  const beyond = !!book(loc.book)?.beyond;
  const prophecies = propheciesFor(loc);
  const quotes = quotesFor(loc);
  const fragments = fragmentsFor(loc);
  const chiasms = chiasmsFor(loc);
  const tallies = talliesFor(loc);
  const rulers = rulersFor(loc);
  useFeatureInView();
  return (
    <div className="panel-body">
      <div className="panel-title">Links across the Bible</div>
      <LinkCircle />
      {prophecies.length > 0 && <>
        <div className="panel-title">Prophecy</div>
        {prophecies.map(({ p, role }) => (
          <div className="card" key={p.id} id={cardId({ kind: 'prophecy', id: p.id })}>
            <h3><span style={{ flex: 1 }}>{p.title}</span><ConfidenceBadge c={p.confidence} /></h3>
            <p className="summary">{p.summary}</p>
            <ProphecyPath p={p} role={role} loc={loc} />
            <SourceList sources={p.sources} traditions={p.traditions} />
          </div>
        ))}
      </>}
      {quotes.length > 0 && <>
        <div className="panel-title">Quotations</div>
        {quotes.map(({ q, role }) => (
          <div className="card" key={q.id} id={cardId({ kind: 'quote', id: q.id })}>
            <p className="summary">{q.summary}</p>
            <div className="verses"><span className="badge kind">{role === 'quoting' ? (q.allusion ? 'Echoes' : 'Quotes') : (q.allusion ? 'Echoed in' : 'Quoted by')}</span><RefChip r={role === 'quoting' ? q.quoted : q.quoting} /></div>
            {q.sources && <SourceList sources={q.sources} />}
          </div>
        ))}
      </>}
      {chiasms.length > 0 && <>
        <div className="panel-title">Chiastic structure</div>
        {chiasms.map((c) => (
          <div className="card chiasm" key={c.id} id={cardId({ kind: 'chiasm', id: c.id })}>
            <h3><span style={{ flex: 1 }}>{c.title}</span><ConfidenceBadge c={c.confidence} /></h3>
            <p className="summary">{c.summary}</p>
            {c.levels.map((l, i) => (
              <div className={`level${l.label === c.centre ? ' centre' : ''}`} key={i} style={{ paddingLeft: `${Math.min(6, depth(c, i)) * 8}px` }}>
                <span className="lbl">{label(l.label)}</span>
                <div><div className="txt">{l.text}</div><button className="ref chip link" onClick={() => follow(l.ref)}>{formatRef(l.ref)}</button></div>
              </div>
            ))}
            <SourceList sources={c.sources} traditions={c.traditions} />
          </div>
        ))}
      </>}
      {tallies.length > 0 && <>
        <div className="panel-title">Counts</div>
        {tallies.map((t) => (
          <div className="card" key={t.id} id={cardId({ kind: 'tally', id: t.id })}>
            <h3><span style={{ flex: 1 }}>{t.title}</span><ConfidenceBadge c={t.confidence} /></h3>
            <p className="summary">{t.summary}</p>
            <div className="verses"><span className="badge kind">Drawn on the text</span><RefChip r={t.ref} /></div>
            <SourceList sources={t.sources} traditions={t.traditions} />
          </div>
        ))}
      </>}
      {fragments.length > 0 && <>
        <div className="panel-title">Earliest manuscript witnesses</div>
        {fragments.map((f) => (
          <div className="card" key={f.id} id={cardId({ kind: 'fragment', id: f.id })}>
            <h3><span style={{ flex: 1 }}>{f.siglum} — {f.name}</span><ConfidenceBadge c="evidence" /></h3>
            <div className="verses"><span className="badge kind">{f.date}</span><span className="chip">{f.held}</span></div>
            <p className="summary">{f.summary}</p>
            <MediaList media={f.media} />
            <div className="verses">{f.contents.map((r) => <RefChip key={r} r={r} />)}</div>
            <SourceList sources={f.sources} />
          </div>
        ))}
      </>}
      {rulers.length > 0 && <>
        <div className="panel-title">Rulers</div>
        {rulers.map((r) => (
          <div className="card" key={r.id}>
            <h3>{r.name}</h3>
            <div className="verses"><span className="badge kind">{r.title} of {r.realm}</span><span className="chip">{fmtYear(r.from, r.estimated)} – {fmtYear(r.to, r.estimated)}</span></div>
            {r.notes && <p className="summary">{r.notes}</p>}
            <div className="verses">{r.refs.map((x) => <RefChip key={x} r={x} />)}</div>
            <SourceList sources={r.sources} />
          </div>
        ))}
      </>}
      {parallels.length > 0 && <>
        <div className="panel-title">{loc.book === '1En' ? 'Charles compares' : 'Compared in 1 Enoch'}</div>
        <ul className="linklist">{parallels.map((to) => <XrefRow key={to} to={to} />)}</ul>
        <div className="sources"><ol><li><span className="skind">Scholarship</span>R. H. Charles’s cross references in his notes to 1 Enoch, <i>The Apocrypha and Pseudepigrapha of the Old Testament</i> (1913), as CrossWire’s edition gives them; its editor has added about half of them.</li></ol></div>
      </>}
      <div className="panel-title">Cross references</div>
      {refs.length ? <ul className="linklist">{refs.map(([to, votes]) => <XrefRow key={to} to={to} votes={votes} />)}</ul> : <div className="empty">{beyond ? 'OpenBible’s cross references cover only the 66 books.' : 'No cross references recorded for this verse.'}</div>}
      <div className="sources"><ol><li><span className="skind">Dataset</span><a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info cross references</a> (CC-BY), ranked by reader votes.</li></ol></div>
    </div>
  );
}
