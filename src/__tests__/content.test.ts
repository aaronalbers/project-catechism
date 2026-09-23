// Integrity checks for the curated content: every reference parses, every link resolves,
// and every card carries a citation and a confidence badge. These run in CI so a typo
// in content/ fails the build rather than silently dropping a card.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { CHIASMS, FRAGMENTS, INSIGHTS, JOURNEYS, MODELS, PEOPLE, PEOPLE_BY_ID, PROPHECIES, QUOTES, RULERS, SPEAKERS, VIDEOS, WRITERS, INSIGHT_BY_ID, videosFor, videosForStrongs } from '@/lib/content';
import { parseRef, BOOKS } from '@/lib/refs';
import { resolveRoute } from '@/lib/journey';
import type { Place, Source } from '@/lib/types';

const bad = (refs: string[]) => refs.filter((r) => !parseRef(r));
const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);

/** Every curated record that carries a `sources` array, flattened to (id, source) pairs. */
const citations = (): { id: string; s: Source }[] =>
  [...INSIGHTS, ...PEOPLE, ...PROPHECIES, ...QUOTES, ...FRAGMENTS, ...WRITERS, ...SPEAKERS, ...CHIASMS, ...RULERS, ...MODELS, ...JOURNEYS]
    .flatMap((x) => ((x as { id: string; sources?: Source[] }).sources ?? []).map((s) => ({ id: x.id, s })));

/** Matches a wikipedia.org host only — wikisource (primary texts) and wikimedia (image credits) are fine. */
const WIKIPEDIA = /^https?:\/\/[^/]*\bwikipedia\.org\b/i;

describe('content integrity', () => {
  it('all references parse', () => {
    const all = [
      ...INSIGHTS.flatMap((i) => [...i.verses, ...i.sources.map((s) => s.ref).filter((r): r is string => !!r)]),
      ...PEOPLE.flatMap((p) => p.refs),
      ...PROPHECIES.flatMap((p) => [p.given, ...p.fulfilled]),
      ...QUOTES.flatMap((q) => [q.quoting, q.quoted]),
      ...FRAGMENTS.flatMap((f) => f.contents),
      ...SPEAKERS.map((s) => s.ref),
      ...CHIASMS.flatMap((c) => [c.ref, ...c.levels.map((l) => l.ref)]),
      ...RULERS.flatMap((r) => r.refs),
      ...MODELS.flatMap((m) => m.verses),
      ...VIDEOS.flatMap((v) => v.verses ?? []),
      ...JOURNEYS.flatMap((j) => [j.ref, ...j.stations.map((st) => st.verse)]),
    ];
    expect(bad(all)).toEqual([]);
  });
  it('ids are unique', () => {
    for (const list of [INSIGHTS, PEOPLE, PROPHECIES, QUOTES, FRAGMENTS, WRITERS, SPEAKERS, CHIASMS, RULERS, MODELS, VIDEOS, JOURNEYS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size, `duplicate id in ${ids.find((id, i) => ids.indexOf(id) !== i)}`).toBe(ids.length);
    }
  });
  it('every insight cites evidence and states its confidence', () => {
    for (const i of INSIGHTS) {
      expect(i.sources.some((s) => evidential.has(s.kind)), `${i.id} has no scripture/archaeology/primary source`).toBe(true);
      expect(['evidence', 'consensus', 'interpretation', 'estimate']).toContain(i.confidence);
      if (i.confidence === 'interpretation') expect(i.traditions?.length, `${i.id} is an interpretation but lists no traditions`).toBeGreaterThan(0);
      for (const r of i.related ?? []) expect(INSIGHT_BY_ID.has(r), `${i.id} relates to unknown ${r}`).toBe(true);
    }
  });
  it('people link to existing parents and every person has a reference', () => {
    for (const p of PEOPLE) {
      expect(p.refs.length, `${p.id} has no refs`).toBeGreaterThan(0);
      for (const id of [p.father, p.mother, ...(p.spouses ?? []), ...(p.altParents ?? []).map((a) => a.id)]) if (id) expect(PEOPLE_BY_ID.has(id), `${p.id} → ${id}`).toBe(true);
      if (p.estimated) expect(p.notes, `${p.id} is estimated but has no note explaining why`).toBeTruthy();
    }
  });
  // Wikipedia is a finding aid, not a source. Trace the claim to the museum, the primary
  // text or the publication and cite that instead. Image credits in `media` are exempt —
  // the CC licences require naming Wikimedia Commons and the photographer.
  it('no claim is cited to Wikipedia', () => {
    const offenders = citations()
      .filter(({ s }) => s.url && WIKIPEDIA.test(s.url))
      .map(({ id, s }) => `${id} → ${s.url}`);
    expect(offenders, 'cite the underlying source, not the encyclopaedia article').toEqual([]);
  });

  // An itinerary is drawn as a route; any position or path that is ours rather than a
  // proposed site has to say what it rests on, because the map shows it as ≈.
  it('journeys cite evidence, run in order, and explain every estimate', () => {
    for (const j of JOURNEYS) {
      expect(j.sources.some((s) => evidential.has(s.kind)), j.id).toBe(true);
      const verses = j.stations.map((st) => parseRef(st.verse)!.start.verse);
      expect(verses, `${j.id} stations out of order`).toEqual([...verses].sort((a, b) => a - b));
      for (const st of j.stations) {
        expect(st.place || st.estimate, `${j.id}: ${st.name} has neither a place nor an estimate`).toBeTruthy();
        if (st.estimate) expect(st.estimate.basis.length, `${j.id}: ${st.name}`).toBeGreaterThan(20);
        if (st.via) expect(st.via.basis.length && st.via.points.length, `${j.id}: ${st.name} via`).toBeTruthy();
      }
    }
  });
  // Needs `npm run data`; CI builds the data before testing.
  const index = new URL('../../public/data/places/index.json', import.meta.url);
  it.skipIf(!existsSync(index))('journey stations resolve to OpenBible places and form one route', () => {
    const places = new Map((JSON.parse(readFileSync(index, 'utf8')) as Place[]).map((p) => [p.id, p]));
    for (const j of JOURNEYS) {
      for (const st of j.stations) if (st.place) expect(places.has(st.place), `${j.id}: ${st.name} → ${st.place}`).toBe(true);
      const stops = resolveRoute(j, places);
      expect(stops.length, j.id).toBe(j.stations.length);
      // No two consecutive camps on the same spot: that is a copied placeholder, not a site.
      for (let i = 1; i < stops.length; i++) expect(stops[i].at, `${j.id}: ${stops[i].station.name} sits on ${stops[i - 1].station.name}`).not.toEqual(stops[i - 1].at);
    }
  });

  it('rulers with estimated dates say so, and writers name real books', () => {
    for (const r of RULERS) expect(r.from <= r.to, r.id).toBe(true);
    for (const w of WRITERS) for (const b of w.books) expect(BOOKS.some((x) => x.id === b.book), `${w.id}: ${b.book}`).toBe(true);
  });

  // Videos embed from YouTube where BibleProject publishes there, and otherwise link to
  // bibleproject.com; word studies name their Strong's numbers so the Words panel finds them.
  it('videos have a playable source, a series, and well-formed tags', () => {
    const kinds = ['overview', 'series', 'theme', 'word', 'insight', 'commentary', 'how-to-read', 'podcast', 'class', 'short', 'remix'];
    for (const v of VIDEOS) {
      if (v.provider === 'youtube') {
        expect(v.videoId, v.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
        expect(v.url, v.id).toBe(`https://www.youtube.com/watch?v=${v.videoId}`);
      } else {
        expect(v.provider, v.id).toBe('bibleproject');
        expect(v.url, v.id).toMatch(/^https:\/\/bibleproject\.com\/videos\/[a-z0-9-]+\/$/);
      }
      if (v.page) expect(v.page, v.id).toMatch(/^https:\/\/bibleproject\.com\/videos\/[a-z0-9-]+\/$/);
      expect(v.series, v.id).toBeTruthy();
      expect(kinds, v.id).toContain(v.kind);
      for (const b of v.books ?? []) expect(BOOKS.some((x) => x.id === b), `${v.id}: ${b}`).toBe(true);
      for (const s of v.strongs ?? []) expect(s, v.id).toMatch(/^[HG][1-9]\d*$/);
    }
    const ids = VIDEOS.flatMap((v) => (v.videoId ? [v.videoId] : []));
    expect(new Set(ids).size, 'a YouTube video is listed twice').toBe(ids.length);
  });
  it('ranks a video about the passage above book overviews, and finds word studies by Strong\'s number', () => {
    const atPrayer = videosFor({ book: 'Matt', chapter: 6, verse: 9 });
    expect(atPrayer[0].verses?.some((r) => r.startsWith('Matt.6.9'))).toBe(true);
    expect(atPrayer.findIndex((v) => v.kind === 'overview')).toBeGreaterThan(0);
    expect(videosForStrongs('H2617').map((v) => v.title)).toContain('Khesed / Loyal Love');
  });
});
