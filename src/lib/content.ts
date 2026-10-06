// Curated content lives in /content as JSON and is bundled at build time.
import type { Acrostic, ChurchCanon, Chiasm, Fragment, Insight, Journey, Model3D, Monarchy, Passion, ModelBuild, ModelChange, ModelState, ModelStateAccount, ModelAngle, Person, ProfileIndex, Fulfilment, Prophecy, Quote, Ruler, Scrolls, SkyEvent, SkyName, SkyReading, Speaker, BookStructure, Tally, TextSource, Video, VideoKind, Worth, Writer } from './types';
import { compareLoc, contains, LONGEST_CHAPTER, parseRef, touchesChapter, type VerseLoc } from './refs';

const insightFiles = import.meta.glob<{ default: Insight[] }>('@content/insights/*.json', { eager: true });
export const INSIGHTS: Insight[] = Object.values(insightFiles).flatMap((m) => m.default);

import people from '@content/people.json';
import prophecies from '@content/prophecies.json';
import quotes from '@content/quotes.json';
import fragments from '@content/fragments.json';
import writers from '@content/writers.json';
import speakers from '@content/speakers.json';
import chiasms from '@content/chiasms.json';
import acrostics from '@content/acrostics.json';
import rulers from '@content/rulers.json';
import models from '@content/models.json';
import videos from '@content/videos.json';
import journeys from '@content/journeys.json';
import tallies from '@content/tallies.json';
import monarchy from '@content/monarchy.json';
import passion from '@content/passion.json';
import canons from '@content/canons.json';
import scrolls from '@content/scrolls.json';
import prices from '@content/prices.json';
import skies from '@content/skies.json';
import structures from '@content/structures.json';

export const PEOPLE = people as unknown as Person[];
export const PROPHECIES = prophecies as unknown as Prophecy[];
export const QUOTES = quotes as unknown as Quote[];
export const FRAGMENTS = fragments as unknown as Fragment[];
export const WRITERS = writers as unknown as Writer[];
export const SPEAKERS = speakers as unknown as Speaker[];
export const CHIASMS = chiasms as unknown as Chiasm[];
/** The shapes of whole books: the words each repeats, and the outlines read from them (the Shape tab). */
export const STRUCTURES = structures as unknown as BookStructure[];
export const structureOf = (book: string) => STRUCTURES.find((s) => s.book === book);
/** The alphabet poems, and which verse or line begins with each letter. */
export const ACROSTICS = acrostics as unknown as Acrostic[];
export const RULERS = rulers as unknown as Ruler[];
export const MODELS = models as unknown as Model3D[];
export const VIDEOS = videos as unknown as Video[];
export const JOURNEYS = journeys as unknown as Journey[];
export const TALLIES = tallies as unknown as Tally[];
export const MONARCHY = monarchy as unknown as Monarchy;
export const PASSION = passion as unknown as Passion;
/** The Hebrew Bible's books and scrolls, and where the Greek, Latin and English divide them otherwise. */
export const SCROLLS = scrolls as unknown as Scrolls;
/** Every sum the text names, and the wages it is measured against. */
export const WORTH = prices as unknown as Worth;
export const PRICES = WORTH.prices;
/** The readings of the star of the Magi, each with the moments of its sky (the Sky tab). */
export const SKY_READINGS = skies.readings as unknown as SkyReading[];
export const skyEventsFor = (loc: VerseLoc, r: SkyReading): SkyEvent[] => r.events.filter((e) => contains(e.ref, loc));
/** The stars the text names (kimah, kesil, ʿash, mazzaroth), with the identifications proposed for each. */
export const SKY_NAMES = (skies as unknown as { names: SkyName[] }).names;
export const skyNamesFor = (loc: VerseLoc) => SKY_NAMES.filter((n) => n.refs.some((r) => contains(r, loc)));
export const skyNamesInChapter = (book: string, chapter: number) => SKY_NAMES.filter((n) => n.refs.some((r) => touchesChapter(r, book, chapter)));
export const magiInChapter = (book: string, chapter: number) => SKY_READINGS.some((r) => r.events.some((e) => touchesChapter(e.ref, book, chapter)));
export const skyInChapter = (book: string, chapter: number) => magiInChapter(book, chapter) || skyNamesInChapter(book, chapter).length > 0;
/** The churches that read books beyond the 66, and the translations those books are shown in. */
export const CANONS = canons.canons as unknown as ChurchCanon[];
export const TEXTS = canons.texts as unknown as TextSource[];
export const CANON_BY_ID = new Map(CANONS.map((c) => [c.id, c]));
export const TEXT_BY_ID = new Map(TEXTS.map((t) => [t.id, t]));
/** The kings of the divided kingdoms, whose reigns the reader charts, in the order `rulers.json` gives them. */
export const KINGS = RULERS.filter((r): r is Ruler & { reign: NonNullable<Ruler['reign']> } => !!r.reign);

/** The written profiles, as much as the lists and the index show; `loadProfile` (profiles.ts) has the rest. */
export const PROFILE_INDEX = Object.values(import.meta.glob<ProfileIndex>('@content/profiles/*.json', { eager: true, query: '?index', import: 'default' }));
/** A profile by any of the generated person ids it covers. */
export const PROFILE_BY_PERSON = new Map(PROFILE_INDEX.flatMap((p) => p.people.map((id) => [id, p] as const)));
export const PEOPLE_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));
export const INSIGHT_BY_ID = new Map(INSIGHTS.map((i) => [i.id, i]));
/** The Strong's numbers a word card studies: its `strongs`, or the number its id is named for (`word-g211-alabastron`). */
export function wordStrongs(i: Insight): string[] {
  if (i.kind !== 'word') return [];
  const named = /^word-([hg]\d+)-/.exec(i.id)?.[1].toUpperCase();
  return i.strongs ?? (named ? [named] : []);
}
/** Word cards by the Strong's numbers they study. */
export function wordCardsFor(strongs: string) { return INSIGHTS.filter((i) => wordStrongs(i).includes(strongs)); }
/** The word cards whose English is narrower than the word, by Strong's number: the reader marks these words wherever they occur. */
export const NARROWED = new Map(INSIGHTS.filter((i) => i.narrows).flatMap((i) => wordStrongs(i).map((s) => [s, i] as const)));

const anyContains = (refs: string[] | undefined, loc: VerseLoc) => (refs ?? []).some((r) => contains(r, loc));

export function insightsFor(loc: VerseLoc) { return INSIGHTS.filter((i) => anyContains(i.verses, loc)); }
export function insightsInChapter(book: string, chapter: number) { return INSIGHTS.filter((i) => i.verses.some((r) => touchesChapter(r, book, chapter))); }
export function peopleFor(loc: VerseLoc) { return PEOPLE.filter((p) => anyContains(p.refs, loc)); }
export function peopleInChapter(book: string, chapter: number) { return PEOPLE.filter((p) => p.refs.some((r) => touchesChapter(r, book, chapter))); }
/** Every ref a fulfilment covers: where the text says so, and the event if told elsewhere. */
export const fulfilmentRefs = (f: Fulfilment) => (f.event ? [f.event, f.ref] : [f.ref]);
export function propheciesFor(loc: VerseLoc) {
  return PROPHECIES.map((p) => ({ p, role: contains(p.foretold, loc) ? 'foretold' as const : anyContains(p.fulfilled.flatMap(fulfilmentRefs), loc) ? 'fulfilled' as const : null }))
    .filter((x): x is { p: Prophecy; role: 'foretold' | 'fulfilled' } => x.role !== null);
}
export function quotesFor(loc: VerseLoc) {
  return QUOTES.map((q) => ({ q, role: contains(q.quoting, loc) ? 'quoting' as const : contains(q.quoted, loc) ? 'quoted' as const : null }))
    .filter((x): x is { q: Quote; role: 'quoting' | 'quoted' } => x.role !== null);
}
export function fragmentsFor(loc: VerseLoc) { return FRAGMENTS.filter((f) => anyContains(f.contents, loc)); }
export function writersFor(loc: VerseLoc) { return WRITERS.filter((w) => w.books.some((b) => b.book === loc.book && (!b.refs || b.refs.some((r) => contains(r, loc))))); }
export function speakerFor(loc: VerseLoc) { return SPEAKERS.filter((s) => contains(s.ref, loc)); }
export function chiasmsFor(loc: VerseLoc) { return CHIASMS.filter((c) => contains(c.ref, loc) || c.levels.some((l) => contains(l.ref, loc))); }
export function rulersFor(loc: VerseLoc) { return RULERS.filter((r) => anyContains([...r.refs, ...(r.reign ? [r.reign.ref, ...(r.reign.chronicles ? [r.reign.chronicles.ref] : [])] : [])], loc)); }
export function talliesFor(loc: VerseLoc) { return TALLIES.filter((t) => contains(t.ref, loc)); }
export function talliesInChapter(book: string, chapter: number) { return TALLIES.filter((t) => touchesChapter(t.ref, book, chapter)); }
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
/**
 * Where the text last turned to `m` by `loc`: the start of the latest step (or change) reached in the
 * build (or state account) being read, or of that passage if none is reached yet. Null when no
 * passage is building or changing it.
 */
export function modelActiveSince(m: Model3D, loc: VerseLoc): VerseLoc | null {
  const at = modelBuildAt(m, loc), reading = at ? null : modelStateAt(m, loc);
  const ref = at ? at.build.steps[at.step - 1]?.ref ?? at.build.ref : reading ? reading.account.changes[reading.step - 1]?.ref ?? reading.account.ref : null;
  return ref ? parseRef(ref)?.start ?? null : null;
}
/**
 * The model the text is working on at `loc`, if any. Where passages overlap (the House of the Forest
 * of Lebanon, 1 Kgs 7:2-5, inside the temple's build), the one whose latest step began most recently.
 */
export function modelLeadAt(loc: VerseLoc): Model3D | null {
  let lead: Model3D | null = null, leadSince: VerseLoc | null = null;
  for (const m of modelsFor(loc)) {
    const since = modelActiveSince(m, loc);
    if (since && (!leadSince || compareLoc(since, leadSince) > 0)) { lead = m; leadSince = since; }
  }
  return lead;
}
/** What each estimated part rests on, as `reading` draws it (the model's first reading when none is given). */
export function modelEstimates(m: Model3D, reading?: string): Record<string, string> {
  const r = m.readings?.find((x) => x.id === reading) ?? m.readings?.[0];
  return { ...m.estimates, ...r?.estimates };
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
  return (r.end.chapter - r.start.chapter) * 40 + Math.min(r.end.verse, LONGEST_CHAPTER) - r.start.verse;
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
  const here = (refs: string[]) => refs.filter((r) => touchesChapter(r, book, chapter));
  const inChapter = (l: VerseLoc) => l.book === book && l.chapter === chapter;
  const kinds: [string, string[]][] = [
    ['insight', here(INSIGHTS.flatMap((i) => i.verses))],
    ['model', here(MODELS.flatMap((m) => m.verses))],
    // Foretold and fulfilled are told apart in the margin: a ring where it is foretold, a dot where it comes true.
    ['prophecy foretold', here(PROPHECIES.map((p) => p.foretold))],
    ['prophecy fulfilled', here(PROPHECIES.flatMap((p) => p.fulfilled.flatMap(fulfilmentRefs)))],
    ['quote', here(QUOTES.flatMap((q) => [q.quoting, q.quoted]))],
    ['chiasm', here(CHIASMS.map((c) => c.ref))],
    ['acrostic', here(ACROSTICS.map((a) => a.ref))],
    ['structure', here(STRUCTURES.flatMap((st) => st.markers.flatMap((m) => m.quotes.map((q) => q.ref))))],
    ['tally', here(TALLIES.map((t) => t.ref))],
    ['price', here(PRICES.flatMap((p) => [p.ref, ...(p.also ?? [])]))],
    ['passion', here([...PASSION.accounts.flatMap((a) => a.events.map((e) => e.ref)), ...PASSION.sayings.map((x) => x.ref)])],
    ['reign', here(KINGS.flatMap((k) => [k.reign.ref, ...(k.reign.chronicles ? [k.reign.chronicles.ref] : [])]))],
  ];
  for (const [kind, refs] of kinds) {
    for (const ref of refs) {
      // A ref touching the chapter that starts (or ends) outside it covers the chapter from its first verse (or to its last).
      const r = parseRef(ref)!;
      const from = inChapter(r.start) ? r.start.verse : 1, to = inChapter(r.end) ? Math.min(r.end.verse, LONGEST_CHAPTER) : LONGEST_CHAPTER;
      for (let v = from; v <= to; v++) (map.get(v) ?? map.set(v, new Set()).get(v)!).add(kind);
    }
  }
  return map;
}
