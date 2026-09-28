import type { CircleData } from './circle';
import { book } from './refs';
import type { BibleBook, BiblePerson, InterlinearVerse, MapData, PeopleInBook, Place, Ref, StrongsEntry, Xrefs } from './types';

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
/** A book beyond the 66 has no interlinear, so it is not asked for. */
export const loadInterlinear = (b: string, chapter: number) => book(b)?.beyond ? Promise.reject(new Error(`${b} has no interlinear`)) : get<InterlinearVerse[]>(`interlinear/${b}/${chapter}.json`);
export const loadXrefs = (book: string) => get<Xrefs>(`xrefs/${book}.json`).catch(() => ({} as Xrefs));
export const loadCircle = () => get<CircleData>('circle.json');
/** R. H. Charles's cross references from 1 Enoch to the 66, as [1 Enoch ref, ref]. */
export const loadParallels = () => get<[Ref, Ref][]>('parallels.json').catch(() => [] as [Ref, Ref][]);
export const loadPlaces = () => get<Place[]>('places/index.json');
export const loadPlacesForBook = (book: string) => get<Record<string, string[]>>(`places/by-book/${book}.json`).catch(() => ({}));

const NO_PEOPLE: PeopleInBook = { verses: {}, people: {} };
export const loadPeopleForBook = (book: string) => get<PeopleInBook>(`people/by-book/${book}.json`).catch(() => NO_PEOPLE);
/** Where a person is stored: people/<H|G>/<hundreds>.json by their Strong's number, as scripts/people.mjs writes them. */
export const personShard = (id: string) => `${id[0]}/${Math.floor(parseInt(id.slice(1), 10) / 100)}`;
export const loadPerson = (id: string) => get<Record<string, BiblePerson>>(`people/${personShard(id)}.json`).then((s) => s[id]).catch(() => undefined);

export const loadMap = () => get<MapData>('map.json');

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
