import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { goTo, setState, useStore } from '@/app/store';
import { CATALOG, cardId, type CatalogEntry, type CatalogSection } from '@/lib/catalog';
import { formatRef, parseRef } from '@/lib/refs';

function open(ref: string, e: CatalogEntry, s: CatalogSection) {
  const r = parseRef(ref);
  if (r) goTo(r.start, { openTab: s.tab, reveal: s.reveal, feature: cardId(e) });
}

function Entry({ e, s }: { e: CatalogEntry; s: CatalogSection }) {
  return (
    <li className="ix-entry">
      <button className="ix-title" onClick={() => open(e.go, e, s)}>
        <span className={`marker ${e.kind}`} aria-hidden="true" />{e.title}
      </button>
      {e.summary && <p className="ix-summary">{e.summary}</p>}
      {e.lines.map((l, i) => (
        <div key={i} className="ix-line">
          {l.label && <span className="ix-label">{l.label}</span>}
          {l.refs.map((r) => <button key={r} className="chip link" onClick={() => open(r, e, s)}>{formatRef(r)}</button>)}
        </div>
      ))}
    </li>
  );
}

const matches = (e: CatalogEntry, q: string) =>
  [e.title, e.summary, e.group ?? '', ...e.lines.flatMap((l) => l.refs.map(formatRef))].some((s) => s.toLowerCase().includes(q));

/** Everything that only some passages have, grouped by kind and in canonical order: `#/index`. */
export function IndexView() {
  const section = useStore((s) => s.index);
  const [query, setQuery] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const sections = useMemo(() => CATALOG.map((s) => ({ ...s, entries: q ? s.entries.filter((e) => matches(e, q)) : s.entries })), [q]);

  useEffect(() => {
    const box = body.current, el = section ? document.getElementById(`ix-${section}`) : null;
    if (!box) return;
    // Below the sticky section bar, however many rows it wraps to.
    const bar = box.querySelector('.ix-toc')?.getBoundingClientRect().height ?? 0;
    box.scrollTo({ top: el ? box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - bar - 8 : 0 });
  }, [section]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setState({ index: null }); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ix" ref={body}>
      <div className="ix-inner">
        <div className="ix-head">
          <h1>Index</h1>
          <input type="search" placeholder="Filter… e.g. temple, Exodus, denarius" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter the index" />
          <button className="refbtn" onClick={() => setState({ index: null })}>Back to reading</button>
        </div>
        <p className="ix-intro">
          The features only some passages have. Pick one to go to its passage with its panel open; chapters that hold
          any of them are dotted in the chapter picker.
        </p>
        <nav className="ix-toc">
          {sections.map((s) => (
            <button key={s.id} className="chip link" disabled={!s.entries.length} onClick={() => setState({ index: s.id })}>
              <span className={`marker ${s.kind}`} aria-hidden="true" />{s.title} <span className="count">{s.entries.length}</span>
            </button>
          ))}
        </nav>
        {sections.map((s) => !!s.entries.length && (
          <section key={s.id} id={`ix-${s.id}`} className="ix-section">
            <h2><span className={`marker ${s.kind}`} aria-hidden="true" />{s.title}</h2>
            <p className="ix-blurb">{s.blurb}</p>
            <ul>
              {s.entries.map((e, i) => (
                <Fragment key={e.id}>
                  {e.group && e.group !== s.entries[i - 1]?.group && <li className="ix-group">{e.group}</li>}
                  <Entry e={e} s={s} />
                </Fragment>
              ))}
            </ul>
          </section>
        ))}
        {sections.every((s) => !s.entries.length) && <div className="empty">Nothing matches “{query}”.</div>}
      </div>
    </div>
  );
}

