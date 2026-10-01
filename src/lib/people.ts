// Everyone the Bible names, from the generated people data, tied to the curated profiles and the family tree.
import { useEffect, useState } from 'react';
import { loadPeopleForBook, loadSpeakersForBook } from './data';
import { BOOKS, parseRef } from './refs';
import type { PeopleInBook, Ref, SpeakersInBook } from './types';

/** Who a book names, once it has loaded (undefined until then). */
export function usePeopleInBook(book: string): PeopleInBook | undefined {
  const [data, setData] = useState<{ book: string; data: PeopleInBook }>();
  useEffect(() => {
    let live = true;
    loadPeopleForBook(book).then((d) => live && setData({ book, data: d }));
    return () => { live = false; };
  }, [book]);
  return data?.book === book ? data.data : undefined;
}

/** Who speaks each verse of a book, once it has loaded (undefined until then). */
export function useSpeakersInBook(book: string): SpeakersInBook | undefined {
  const [data, setData] = useState<{ book: string; data: SpeakersInBook }>();
  useEffect(() => {
    let live = true;
    loadSpeakersForBook(book).then((d) => live && setData({ book, data: d }));
    return () => { live = false; };
  }, [book]);
  return data?.book === book ? data.data : undefined;
}

/** One person in a chapter's list: who they are and the verses of the chapter that name them. */
export interface Named { id: string; name: string; title: string; sex: 'male' | 'female'; verses: number[] }

/** The people a chapter names, in the order it first names them. */
export function namedInChapter(data: PeopleInBook, chapter: number): Named[] {
  const out = new Map<string, Named>();
  const keys = Object.keys(data.verses).filter((k) => +k.split('.')[0] === chapter).sort((a, b) => +a.split('.')[1] - +b.split('.')[1]);
  for (const k of keys) {
    const v = +k.split('.')[1];
    for (const id of data.verses[k]) {
      const [name, title, sex] = data.people[id] ?? [id, '', 'm'];
      if (!out.has(id)) out.set(id, { id, name, title, sex: sex === 'f' ? 'female' : 'male', verses: [] });
      out.get(id)!.verses.push(v);
    }
  }
  return [...out.values()];
}

/** How many verses in each book name someone, in canonical order, for the strip of where they appear. */
export function perBook(refs: Ref[]): { book: string; count: number; first: Ref }[] {
  const counts = new Map<string, { count: number; first: Ref }>();
  for (const r of refs) {
    const b = r.split('.')[0];
    const c = counts.get(b);
    if (c) c.count++; else counts.set(b, { count: 1, first: r });
  }
  return BOOKS.filter((b) => counts.has(b.id)).map((b) => ({ book: b.id, ...counts.get(b.id)! }));
}

/** A run of Easton's text: plain words, or a verse link written `[[Judg.4.6|Judg. 4:6]]`. */
export type EastonPart = string | { ref: Ref; label: string };
export function eastonParts(text: string): EastonPart[] {
  const out: EastonPart[] = [];
  let at = 0;
  for (const m of text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    out.push(parseRef(m[1]) ? { ref: m[1], label: m[2] } : m[2]);
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
