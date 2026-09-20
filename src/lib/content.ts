// Curated content lives in /content as JSON and is bundled at build time.
import type { Chiasm, Fragment, Insight, Model3D, Person, Prophecy, Quote, Ruler, Speaker, Video, Writer } from './types';
import { contains, touchesChapter, type VerseLoc } from './refs';

const insightFiles = import.meta.glob<{ default: Insight[] }>('@content/insights/*.json', { eager: true });
export const INSIGHTS: Insight[] = Object.values(insightFiles).flatMap((m) => m.default);

import people from '@content/people.json';
import prophecies from '@content/prophecies.json';
import quotes from '@content/quotes.json';
import fragments from '@content/fragments.json';
import writers from '@content/writers.json';
import speakers from '@content/speakers.json';
import chiasms from '@content/chiasms.json';
import rulers from '@content/rulers.json';
import models from '@content/models.json';
import videos from '@content/videos.json';

export const PEOPLE = people as unknown as Person[];
export const PROPHECIES = prophecies as unknown as Prophecy[];
export const QUOTES = quotes as unknown as Quote[];
export const FRAGMENTS = fragments as unknown as Fragment[];
export const WRITERS = writers as unknown as Writer[];
export const SPEAKERS = speakers as unknown as Speaker[];
export const CHIASMS = chiasms as unknown as Chiasm[];
export const RULERS = rulers as unknown as Ruler[];
export const MODELS = models as unknown as Model3D[];
export const VIDEOS = videos as unknown as Video[];

export const PEOPLE_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));
export const INSIGHT_BY_ID = new Map(INSIGHTS.map((i) => [i.id, i]));

const anyContains = (refs: string[] | undefined, loc: VerseLoc) => (refs ?? []).some((r) => contains(r, loc));

export function insightsFor(loc: VerseLoc) { return INSIGHTS.filter((i) => anyContains(i.verses, loc)); }
export function insightsInChapter(book: string, chapter: number) { return INSIGHTS.filter((i) => i.verses.some((r) => touchesChapter(r, book, chapter))); }
export function peopleFor(loc: VerseLoc) { return PEOPLE.filter((p) => anyContains(p.refs, loc)); }
export function peopleInChapter(book: string, chapter: number) { return PEOPLE.filter((p) => p.refs.some((r) => touchesChapter(r, book, chapter))); }
export function propheciesFor(loc: VerseLoc) {
  return PROPHECIES.map((p) => ({ p, role: contains(p.given, loc) ? 'given' as const : anyContains(p.fulfilled, loc) ? 'fulfilled' as const : null }))
    .filter((x): x is { p: Prophecy; role: 'given' | 'fulfilled' } => x.role !== null);
}
export function quotesFor(loc: VerseLoc) {
  return QUOTES.map((q) => ({ q, role: contains(q.quoting, loc) ? 'quoting' as const : contains(q.quoted, loc) ? 'quoted' as const : null }))
    .filter((x): x is { q: Quote; role: 'quoting' | 'quoted' } => x.role !== null);
}
export function fragmentsFor(loc: VerseLoc) { return FRAGMENTS.filter((f) => anyContains(f.contents, loc)); }
export function writersFor(book: string) { return WRITERS.filter((w) => w.books.some((b) => b.book === book)); }
export function speakerFor(loc: VerseLoc) { return SPEAKERS.filter((s) => contains(s.ref, loc)); }
export function chiasmsFor(loc: VerseLoc) { return CHIASMS.filter((c) => contains(c.ref, loc) || c.levels.some((l) => contains(l.ref, loc))); }
export function rulersFor(loc: VerseLoc) { return RULERS.filter((r) => anyContains(r.refs, loc)); }
export function modelsFor(loc: VerseLoc) { return MODELS.filter((m) => anyContains(m.verses, loc)); }
export function modelsInChapter(book: string, chapter: number) { return MODELS.filter((m) => m.verses.some((r) => touchesChapter(r, book, chapter))); }
export function videosFor(loc: VerseLoc) {
  return VIDEOS.filter((v) => anyContains(v.verses, loc) || (v.books ?? []).includes(loc.book));
}

/** Verse numbers in a chapter that have any curated content, for the reader's margin markers. */
export function markersForChapter(book: string, chapter: number): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  const add = (v: number, kind: string) => { if (!map.has(v)) map.set(v, new Set()); map.get(v)!.add(kind); };
  for (let v = 1; v <= 200; v++) {
    const loc = { book, chapter, verse: v };
    if (INSIGHTS.some((i) => anyContains(i.verses, loc))) add(v, 'insight');
    if (MODELS.some((m) => anyContains(m.verses, loc))) add(v, 'model');
    if (PROPHECIES.some((p) => contains(p.given, loc) || anyContains(p.fulfilled, loc))) add(v, 'prophecy');
    if (QUOTES.some((q) => contains(q.quoting, loc) || contains(q.quoted, loc))) add(v, 'quote');
    if (CHIASMS.some((c) => contains(c.ref, loc))) add(v, 'chiasm');
  }
  return map;
}
