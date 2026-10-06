import { openTab } from '@/app/store';
import { cardId } from '@/lib/catalog';
import type { BookStructure, StructureMarker } from '@/lib/types';

/** The element id of a marker's card in the Shape tab. */
export const markerId = (s: BookStructure, id: string) => cardId({ kind: 'structure', id: `${s.id}-${id}` });
export const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
export const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

/** Under a verse that holds words the book repeats where its outlines divide it: which of them, and a way to the outlines. */
export function ShapeNote({ s, m, n }: { s: BookStructure; m: StructureMarker; n: number }) {
  return (
    <div className="seam overlap shape-note-inline" onClick={(e) => e.stopPropagation()}>
      <span className="kind">Outline</span>{' '}
      {cap(ORDINAL[n] ?? `${n + 1}th`)} of {NUMBER[m.quotes.length] ?? m.quotes.length}: {m.label}{' '}
      <button className="marks-toggle" onClick={() => openTab('shape', { feature: markerId(s, m.id) })}>See the outlines</button>
    </div>
  );
}
