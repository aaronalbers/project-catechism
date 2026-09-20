import { useEffect, useMemo, useRef, useState } from 'react';
import { goTo, setState, useStore } from '@/app/store';
import { BOOKS, book, bookByName } from '@/lib/refs';
import { Icon } from './Icons';

/** Accepts "Matt 5:39", "Matthew 5", "mk 14 3", "1 Cor 13:4". */
function parseInput(s: string) {
  const m = /^\s*([1-3]?\s?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)*)\s*(\d+)?(?:[:.\s]+(\d+))?\s*$/.exec(s);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ');
  const b = bookByName(name) ?? BOOKS.find((b) => b.name.toLowerCase().startsWith(name.toLowerCase()));
  if (!b) return null;
  return { book: b.id, chapter: Math.min(+(m[2] ?? 1), b.chapters) || 1, verse: +(m[3] ?? 1) || 1 };
}

function Navigator({ onClose }: { onClose: () => void }) {
  const loc = useStore((s) => s.loc);
  const [bookId, setBookId] = useState(loc.book);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const b = book(bookId)!;
  const parsed = useMemo(() => (query ? parseInput(query) : null), [query]);
  const submit = () => { if (parsed) { goTo(parsed); onClose(); } };
  return (
    <dialog className="nav" ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="nav-head">
        <Icon.Book />
        <input autoFocus placeholder="Go to… e.g. Mark 14:3" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Go to reference" />
        {parsed && <button className="refbtn" onClick={submit}>{book(parsed.book)?.name} {parsed.chapter}:{parsed.verse}</button>}
      </div>
      <div className="nav-body">
        {(['OT', 'NT'] as const).map((t) => (
          <div key={t}>
            <div className="nav-testament">{t === 'OT' ? 'Old Testament' : 'New Testament'}</div>
            <div className="nav-books">
              {BOOKS.filter((x) => x.testament === t).map((x) => (
                <button key={x.id} aria-current={x.id === bookId} onClick={() => setBookId(x.id)}>{x.name}</button>
              ))}
            </div>
          </div>
        ))}
        <hr />
        <div className="nav-testament">{b.name} — chapter</div>
        <div className="nav-chapters">
          {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => (
            <button key={c} aria-current={bookId === loc.book && c === loc.chapter} onClick={() => { goTo({ book: bookId, chapter: c, verse: 1 }); onClose(); }}>{c}</button>
          ))}
        </div>
      </div>
    </dialog>
  );
}

export function Header() {
  const loc = useStore((s) => s.loc);
  const theme = useStore((s) => s.theme);
  const panelOpen = useStore((s) => s.panelOpen);
  const [open, setOpen] = useState(false);
  const b = book(loc.book);
  return (
    <header className="header">
      <div className="brand">
        <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="var(--accent)" /><path d="M9 7h14v18H9z" fill="var(--accent-ink)" /><path d="M12 11h8M12 15h8M12 19h5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" /></svg>
        <span>Project Catechism <small>— Scripture with the evidence beside it</small></span>
      </div>
      <div className="spacer" />
      <button className="refbtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {b?.name} {loc.chapter}:{loc.verse} <Icon.Chevron />
      </button>
      <button className="iconbtn" title={`Theme: ${theme}`} aria-label="Toggle theme" onClick={() => setState({ theme: theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark' })}>
        {theme === 'dark' ? <Icon.Moon /> : <Icon.Sun />}
      </button>
      <button className="iconbtn" title={panelOpen ? 'Hide context panel' : 'Show context panel'} aria-pressed={panelOpen} onClick={() => setState({ panelOpen: !panelOpen })}><Icon.Panel /></button>
      <a className="iconbtn" href="https://github.com/aaronalbers/project-catechism" title="Source on GitHub" target="_blank" rel="noreferrer"><Icon.GitHub /></a>
      {open && <Navigator onClose={() => setOpen(false)} />}
    </header>
  );
}
