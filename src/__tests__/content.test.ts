// Integrity checks for the curated content: every reference parses, every link resolves,
// and every card carries a citation and a confidence badge. These run in CI so a typo
// in content/ fails the build rather than silently dropping a card.
import { describe, expect, it } from 'vitest';
import { CHIASMS, FRAGMENTS, INSIGHTS, MODELS, PEOPLE, PEOPLE_BY_ID, PROPHECIES, QUOTES, RULERS, SPEAKERS, VIDEOS, WRITERS, INSIGHT_BY_ID } from '@/lib/content';
import { parseRef, BOOKS } from '@/lib/refs';

const bad = (refs: string[]) => refs.filter((r) => !parseRef(r));
const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);

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
    ];
    expect(bad(all)).toEqual([]);
  });
  it('ids are unique', () => {
    for (const list of [INSIGHTS, PEOPLE, PROPHECIES, QUOTES, FRAGMENTS, WRITERS, SPEAKERS, CHIASMS, RULERS, MODELS, VIDEOS]) {
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
  it('rulers with estimated dates say so, and writers name real books', () => {
    for (const r of RULERS) expect(r.from <= r.to, r.id).toBe(true);
    for (const w of WRITERS) for (const b of w.books) expect(BOOKS.some((x) => x.id === b.book), `${w.id}: ${b.book}`).toBe(true);
    for (const v of VIDEOS) { expect(v.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/); for (const b of v.books ?? []) expect(BOOKS.some((x) => x.id === b)).toBe(true); }
  });
});
