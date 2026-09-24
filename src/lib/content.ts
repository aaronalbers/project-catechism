// Curated content lives in /content as JSON and is bundled at build time.
import type { Chiasm, Fragment, Insight, Journey, Model3D, ModelBuild, ModelChange, ModelState, ModelStateAccount, ModelAngle, Person, Prophecy, Quote, Ruler, Speaker, Video, VideoKind, Writer } from './types';
import { compareLoc, contains, parseRef, touchesChapter, type VerseLoc } from './refs';

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
import journeys from '@content/journeys.json';

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
export const JOURNEYS = journeys as unknown as Journey[];

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
export function journeysInChapter(book: string, chapter: number) { return JOURNEYS.filter((j) => touchesChapter(j.ref, book, chapter)); }
export function modelsFor(loc: VerseLoc) { return MODELS.filter((m) => anyContains(m.verses, loc)); }
export function modelsInChapter(book: string, chapter: number) { return MODELS.filter((m) => m.verses.some((r) => touchesChapter(r, book, chapter))); }
/**
 * How far the text has built a model by `loc`. Inside one of its `builds`, a part is shown once
 * the first verse of a step naming it is reached; outside every build the model is whole (null).
 */
export function modelBuildAt(m: Model3D, loc: VerseLoc): { build: ModelBuild; step: number; parts: Set<string> } | null {
  const build = m.builds?.find((b) => contains(b.ref, loc));
  if (!build) return null;
  const reached = build.steps.filter((s) => { const r = parseRef(s.ref); return !!r && compareLoc(r.start, loc) <= 0; });
  return { build, step: reached.length, parts: new Set(reached.flatMap((s) => s.parts)) };
}
/**
 * The later state the text is describing at `loc`: the last state with an account containing it,
 * that account, and how many of its changes have been reached. Null outside every account.
 */
export function modelStateAt(m: Model3D, loc: VerseLoc): { state: ModelState; account: ModelStateAccount; step: number } | null {
  for (const state of [...(m.states ?? [])].reverse()) {
    const account = state.accounts.find((a) => contains(a.ref, loc));
    if (account) return { state, account, step: account.changes.filter((c) => { const r = parseRef(c.ref); return !!r && compareLoc(r.start, loc) <= 0; }).length };
  }
  return null;
}
/** The camera's angle while a passage is building or changing a model that sets none: in front, a little to the right, and above. */
export const DEFAULT_MODEL_VIEW: ModelAngle = [30, 25];
/**
 * Where the camera looks from at `loc`: while a build is read, or the state `stateId` is read in one
 * of its accounts, the latest step's or change's `view`, else the model's own, else the default. Null
 * anywhere else, where the model is shown whole and turns.
 */
export function modelViewAt(m: Model3D, loc: VerseLoc, stateId: string | null): ModelAngle | null {
  const at = modelBuildAt(m, loc);
  if (at) return at.build.steps[at.step - 1]?.view ?? m.view ?? DEFAULT_MODEL_VIEW;
  const reading = modelStateAt(m, loc);
  if (reading && reading.state.id === stateId) return reading.account.changes[reading.step - 1]?.view ?? m.view ?? DEFAULT_MODEL_VIEW;
  return null;
}
/**
 * Parts not drawn in a state (null: as built). As built, that is the alternates, the parts only a
 * state shows. In a state, it is what the changes of every state up to it have hidden and not
 * shown again; the state's own changes all apply, unless `loc` is in one of its accounts, when
 * only the changes reached so far do.
 */
export function modelHiddenIn(m: Model3D, stateId: string | null, loc?: VerseLoc): Set<string> {
  const states = m.states ?? [];
  const hidden = new Set(states.flatMap((s) => s.accounts.flatMap((a) => a.changes.flatMap((c) => c.shows ?? []))));
  if (stateId === null) return hidden;
  const apply = (c: ModelChange) => { for (const p of c.hides ?? []) hidden.add(p); for (const p of c.shows ?? []) hidden.delete(p); };
  const reading = loc && modelStateAt(m, loc);
  for (const s of states) {
    if (s.id === stateId && reading && reading.state === s) { reading.account.changes.slice(0, reading.step).forEach(apply); break; }
    for (const a of s.accounts) a.changes.forEach(apply);
    if (s.id === stateId) break;
  }
  return hidden;
}
/** Verses a ref spans, roughly — only used to rank narrower passages above wider ones. */
function spanSize(ref: string) {
  const r = parseRef(ref);
  if (!r) return Infinity;
  if (r.start.book !== r.end.book) return 1e6;
  return (r.end.chapter - r.start.chapter) * 40 + Math.min(r.end.verse, 200) - r.start.verse;
}
const KIND_RANK: Partial<Record<VideoKind, number>> = { short: 1, podcast: 2, remix: 3 };

/**
 * Videos for a verse, most specific first: a video about this very passage outranks a book
 * overview, and full videos outrank shorts, podcast episodes and remixes of the same passage.
 */
export function videosFor(loc: VerseLoc) {
  const scored = VIDEOS.flatMap((v) => {
    const hits = (v.verses ?? []).filter((r) => contains(r, loc)).map(spanSize);
    if (hits.length) return [{ v, score: Math.min(...hits) }];
    if ((v.books ?? []).includes(loc.book)) return [{ v, score: 1e7 + (v.books ?? []).length }];
    return [];
  });
  return scored.sort((a, b) => (KIND_RANK[a.v.kind] ?? 0) - (KIND_RANK[b.v.kind] ?? 0) || a.score - b.score).map((x) => x.v);
}
export function videosForStrongs(id: string) { return VIDEOS.filter((v) => v.strongs?.includes(id)); }
/** The whole library grouped by series, in content order. */
export const VIDEO_SERIES: { series: string; videos: Video[] }[] = (() => {
  const groups = new Map<string, Video[]>();
  for (const v of VIDEOS) groups.set(v.series, [...(groups.get(v.series) ?? []), v]);
  return [...groups].map(([series, videos]) => ({ series, videos }));
})();

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
