import type { BibleBook, InterlinearVerse, Place, StrongsEntry, Xrefs } from './types';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(`${base}/data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path) as Promise<T>;
}

export const loadBook = (id: string) => get<BibleBook>(`bible/${id}.json`);
export const loadInterlinear = (book: string, chapter: number) => get<InterlinearVerse[]>(`interlinear/${book}/${chapter}.json`);
export const loadXrefs = (book: string) => get<Xrefs>(`xrefs/${book}.json`).catch(() => ({} as Xrefs));
export const loadPlaces = () => get<Place[]>('places/index.json');
export const loadPlacesForBook = (book: string) => get<Record<string, string[]>>(`places/by-book/${book}.json`).catch(() => ({}));

export async function loadStrongs(id: string): Promise<StrongsEntry | undefined> {
  const m = /^([HG])(\d+)$/.exec(id);
  if (!m) return undefined;
  const shard = Math.floor(+m[2] / 100);
  const data = await get<Record<string, StrongsEntry>>(`strongs/${m[1]}/${shard}.json`).catch(() => ({} as Record<string, StrongsEntry>));
  return data[id];
}

export async function loadVerseText(book: string, chapter: number, verse: number): Promise<string | undefined> {
  const b = await loadBook(book);
  return b.chapters[chapter - 1]?.find((v) => v.v === verse)?.t;
}
