import { useEffect, useState } from 'react';
import { goTo, useFeatureInView, useStore } from '@/app/store';
import { loadVerseText, loadXrefs } from '@/lib/data';
import { chiasmsFor, fragmentsFor, propheciesFor, quotesFor, speakerFor, talliesFor, writersFor, rulersFor } from '@/lib/content';
import { formatRef, parseRef } from '@/lib/refs';
import { ConfidenceBadge, MediaList, RefChip, SourceList } from '@/components/SourceList';
import type { Xrefs } from '@/lib/types';
import { LinkCircle } from './LinkCircle';
import { label } from '@/components/Chiasm';
import { depth } from '@/lib/chiasm';
import { cardId } from '@/lib/catalog';
import { formatYear } from '@/lib/format';

function XrefRow({ to, votes }: { to: string; votes: number }) {
  const [text, setText] = useState('');
  const r = parseRef(to);
  useEffect(() => { if (r) loadVerseText(r.start.book, r.start.chapter, r.start.verse).then((t) => setText(t ?? '')); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li>
      <button className="chip link" onClick={() => r && goTo(r.start)}>{formatRef(to)}</button>
      <span className="txt">{text.length > 110 ? text.slice(0, 110) + '…' : text}</span>
      <span className="votes" title="Reader votes on OpenBible.info">{votes}</span>
    </li>
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
  const prophecies = propheciesFor(loc);
  const quotes = quotesFor(loc);
  const fragments = fragmentsFor(loc);
  const chiasms = chiasmsFor(loc);
  const tallies = talliesFor(loc);
  const speakers = speakerFor(loc);
  const writers = writersFor(loc.book);
  const rulers = rulersFor(loc);
  useFeatureInView();
  return (
    <div className="panel-body">
      <div className="panel-title">Links across the Bible</div>
      <LinkCircle />
      {speakers.length > 0 && <>
        <div className="panel-title">Who is speaking</div>
        {speakers.map((s) => <div className="card" key={s.id}><h3>{s.speaker}</h3>{s.summary && <p className="summary">{s.summary}</p>}<div className="verses"><RefChip r={s.ref} /></div>{s.sources && <SourceList sources={s.sources} />}</div>)}
      </>}
      {prophecies.length > 0 && <>
        <div className="panel-title">Prophecy</div>
        {prophecies.map(({ p, role }) => (
          <div className="card" key={p.id} id={cardId({ kind: 'prophecy', id: p.id })}>
            <h3><span style={{ flex: 1 }}>{p.title}</span><ConfidenceBadge c={p.confidence} /></h3>
            <p className="summary">{p.summary}</p>
            <div className="verses"><span className="badge kind">{role === 'given' ? 'Given here' : 'Fulfilled here'}</span>
              <span className="chip">given</span><RefChip r={p.given} /><span className="chip">fulfilled</span>{p.fulfilled.map((r) => <RefChip key={r} r={r} />)}</div>
            <SourceList sources={p.sources} traditions={p.traditions} />
          </div>
        ))}
      </>}
      {quotes.length > 0 && <>
        <div className="panel-title">Quotations</div>
        {quotes.map(({ q, role }) => (
          <div className="card" key={q.id} id={cardId({ kind: 'quote', id: q.id })}>
            <p className="summary">{q.summary}</p>
            <div className="verses"><span className="badge kind">{role === 'quoting' ? 'Quotes' : 'Quoted by'}</span><RefChip r={role === 'quoting' ? q.quoted : q.quoting} /></div>
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
                <div><div className="txt">{l.text}</div><button className="ref chip link" onClick={() => { const r = parseRef(l.ref); if (r) goTo(r.start); }}>{formatRef(l.ref)}</button></div>
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
      <div className="panel-title">Cross references</div>
      {refs.length ? <ul className="linklist">{refs.map(([to, votes]) => <XrefRow key={to} to={to} votes={votes} />)}</ul> : <div className="empty">No cross references recorded for this verse.</div>}
      <div className="sources"><ol><li><span className="skind">Dataset</span><a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info cross references</a> (CC-BY), ranked by reader votes.</li></ol></div>
      {writers.length > 0 && <>
        <div className="panel-title">Who wrote {loc.book === 'Ps' ? 'this' : 'this book'}</div>
        {writers.map((w) => (
          <div className="card" key={w.id}>
            <h3><span style={{ flex: 1 }}>{w.name}</span><ConfidenceBadge c={w.confidence} /></h3>
            <p className="summary">{w.summary}</p>
            <SourceList sources={w.sources} traditions={w.traditions} />
          </div>
        ))}
      </>}
    </div>
  );
}
