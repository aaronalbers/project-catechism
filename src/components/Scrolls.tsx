import { openTab } from '@/app/store';
import { cardId } from '@/lib/catalog';
import { book, formatRef, parseRef } from '@/lib/refs';
import type { OverlapEnd, Seam } from '@/lib/scrolls';
import { RefChip } from './SourceList';

const name = (id: string) => book(id)?.name ?? id;
export const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five'];

/**
 * A dashed rule where an English book begins or ends but the Hebrew runs on: one book the Greek split (Samuel), or
 * separate books on one scroll with blank lines between (the Twelve).
 */
export function SeamNote({ seam: { h, from, to }, side }: { seam: Seam; side: 'before' | 'after' }) {
  const one = h.kind === 'book';
  const text = side === 'before'
    ? one ? <>No break here in the Hebrew: {name(from)} and {name(to)} are one book, {h.name}. The split came later, from Greek and Latin Bibles.</>
      : <>Same scroll in the Hebrew: {name(from)} runs on into {name(to)} after {NUMBER[h.gap!]} blank lines.</>
    : one ? <>The book runs on: in the Hebrew, {name(to)} carries straight on from here.</>
      : <>The scroll runs on: in the Hebrew, {name(to)} follows after {NUMBER[h.gap!]} blank lines.</>;
  return (
    <div className={`seam ${side}${one ? ' one' : ''}`}>
      <span className="kind">{h.name}</span>{' '}{text}{' '}
      <button className="marks-toggle" onClick={() => openTab('scrolls', { feature: cardId({ kind: 'scroll', id: h.id }) })}>See the scroll</button>
    </div>
  );
}

/** Under the first verse of words repeated across a book's end (Cyrus's decree): where they are repeated. */
export function OverlapNote({ end: { o, there } }: { end: OverlapEnd }) {
  const r = parseRef(there)!.start;
  const opens = r.chapter === 1 && r.verse === 1;
  return (
    <div className="seam overlap" onClick={(e) => e.stopPropagation()}>
      The same words {opens ? 'open' : 'close'} {name(r.book)}: <RefChip r={there} />{' '}
      <button className="marks-toggle" onClick={() => openTab('scrolls', { feature: cardId({ kind: 'scroll', id: o.id }) })} title={`${formatRef(o.a)} and ${formatRef(o.b)}`}>Why</button>
    </div>
  );
}
