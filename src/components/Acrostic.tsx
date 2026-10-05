// Alphabet poems drawn on the text: a strip of the poem's letters where it opens in the chapter, each verse's
// letter in its margin, and the card in the Links panel that lists them all.
import { follow, getState, openCard } from '@/app/store';
import { acrosticsFor, letterName, letterNumber, lettersAt, lettersCovering, reached } from '@/lib/acrostic';
import { cardId } from '@/lib/catalog';
import { contains, formatRef, parseRef, type VerseLoc } from '@/lib/refs';
import type { Acrostic, AcrosticLetter } from '@/lib/types';
import { ConfidenceBadge, SourceList } from './SourceList';

/** "34:5": the book goes without saying in the poem's own card. */
const chapterVerse = (ref: string) => { const s = parseRef(ref)!.start; return `${s.chapter}:${s.verse}`; };

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** What a letter's cell says on hover, and its card row's note: where it falls, or that no verse begins with it. */
function describe(l: AcrosticLetter): string {
  const name = `${letterName(l.letter)} (${l.letter})`;
  if (l.missing) return l.note ? `${name}: no verse begins with it. ${l.note}` : `${name}: no verse begins with it.`;
  const where = [l.extra ? 'again' : `the ${ordinal(letterNumber(l.letter))} letter`, l.after && `after ${l.after}`].filter(Boolean).join(', ');
  return `${name}, ${where}: ${formatRef(l.ref!)}${l.note ? `. ${l.note}` : ''}`;
}

const cellClass = (a: Acrostic, l: AcrosticLetter, i: number, loc: VerseLoc, here: Set<AcrosticLetter>) =>
  ['he', reached(a, i, loc) && 'reached', here.has(l) && 'here', l.missing && 'missing', l.extra && 'extra', l.swapped && 'swapped'].filter(Boolean).join(' ');

/** The poem's card in the Links tab, going first to `at` (a verse of it) if the reader is outside it. */
const showCard = (a: Acrostic, at: VerseLoc) => openCard('links', cardId({ kind: 'acrostic', id: a.id }), acrosticsFor(getState().loc).includes(a), at);

/** Above the verse where an alphabet poem opens in this chapter: its letters in the poem's order, filled as they are read. */
export function AlphabetStrip({ a, loc, show, onToggle }: { a: Acrostic; loc: VerseLoc; show: boolean; onToggle: () => void }) {
  const here = new Set(lettersCovering(a, loc));
  const opens = parseRef(a.ref)!.start, top = { book: loc.book, chapter: loc.chapter, verse: 1 };
  const inChapter = opens.chapter === loc.chapter ? opens : top;
  const now = [...here].filter((l) => !l.missing);
  return (
    <div className="acrostic-strip">
      <div className="chiasm-cap acrostic-cap">
        <span className="kind">Alphabet poem</span>
        <button className="name" onClick={() => showCard(a, inChapter)} title="Every letter, and the sources, in the Links panel">{a.title}</button>
        <button className="chiasm-toggle" aria-pressed={show} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{show ? 'Hide letters' : 'Show letters'}</button>
      </div>
      {show && <>
        <ol aria-label={`${a.title}: the letters in the poem's order`} style={{ gridTemplateColumns: `repeat(${a.letters.length}, minmax(0, 1fr))` }}>
          {a.letters.map((l, i) => (
            <li key={i}>
              <button className={cellClass(a, l, i, loc, here)} aria-current={here.has(l) || undefined} disabled={!l.ref} title={describe(l)} aria-label={describe(l)}
                onClick={() => l.ref && follow(l.ref)}>{l.letter}</button>
            </li>
          ))}
        </ol>
        <p className="acrostic-now" aria-live="polite">
          {now.length && contains(a.ref, loc)
            ? now.map((l, i) => <span key={i}>{i > 0 && ', '}<span className="he">{l.letter}</span> {letterName(l.letter)}{l.extra ? ' again' : `, the ${ordinal(letterNumber(l.letter))} letter`}</span>)
            : `${a.letters.filter((l) => !l.missing && !l.extra).length} of the 22 letters begin a ${a.by}${a.every ? ', and every verse of its stanza' : ''}.`}
        </p>
      </>}
    </div>
  );
}

/** The letters a verse begins with, in its margin; fainter in a stanza's later verses, which begin with the same one. */
export function GutterLetters({ a, loc }: { a: Acrostic; loc: VerseLoc }) {
  const own = lettersAt(a, loc);
  const run = !own.length && a.every ? lettersCovering(a, loc) : [];
  const shown = own.length ? own : run;
  if (!shown.length) return null;
  return (
    <span className={`acrostic-letter${own.length ? '' : ' repeat'}`} title={shown.map(describe).join('\n')} lang="he" dir="rtl">
      {shown.map((l) => l.letter).join(' ')}
    </span>
  );
}

/** The poem in the Links panel: every letter with its verse and word, the notes, and the sources. */
export function AcrosticCard({ a, loc }: { a: Acrostic; loc: VerseLoc }) {
  const here = new Set(lettersCovering(a, loc));
  const notes = a.letters.filter((l) => l.note || l.after || l.missing);
  return (
    <div className="card acrostic" id={cardId({ kind: 'acrostic', id: a.id })}>
      <h3><span style={{ flex: 1 }}>{a.title}</span><ConfidenceBadge c={a.confidence} /></h3>
      <p className="summary">{a.summary}</p>
      <ol className="acrostic-letters">
        {a.letters.map((l, i) => (
          <li key={i} className={cellClass(a, l, i, loc, here)} aria-current={here.has(l) || undefined}>
            <span className="glyph" lang="he">{l.letter}</span>
            <span className="nm">{letterName(l.letter)}{l.extra && <small> again</small>}</span>
            {l.ref ? <button className="chip link" onClick={() => follow(l.ref!)} title={formatRef(l.ref)}>{chapterVerse(l.ref)}</button> : <span className="none">no verse</span>}
            {l.word && <span className="word" lang="he" dir="rtl">{l.word}</span>}
          </li>
        ))}
      </ol>
      {notes.length > 0 && (
        <ul className="acrostic-notes">
          {notes.map((l, i) => <li key={i}><span className="he">{l.letter}</span> {describe(l)}</li>)}
        </ul>
      )}
      <SourceList sources={a.sources} traditions={a.traditions} />
    </div>
  );
}
