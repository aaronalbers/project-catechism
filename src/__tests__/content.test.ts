// Integrity checks for the curated content: every reference parses, every link resolves,
// and every card carries a citation and a confidence badge. These run in CI so a typo
// in content/ fails the build rather than silently dropping a card.
import { describe, expect, it } from 'vitest';
import { PROFILE_INDEX } from '@/lib/content';
import { personShard } from '@/lib/data';

/** Every profile in full. */
const PROFILE_FILES = import.meta.glob<Profile>('@content/profiles/*.json', { eager: true, import: 'default' });
const PROFILES = Object.values(PROFILE_FILES);
import { existsSync, readFileSync } from 'node:fs';
import { CANONS, CANON_BY_ID, TEXT_BY_ID, CHIASMS, FRAGMENTS, INSIGHTS, JOURNEYS, KINGS, MONARCHY, PASSION, SCROLLS, MODELS, PEOPLE, PEOPLE_BY_ID, PROPHECIES, QUOTES, RULERS, SPEAKERS, TALLIES, VIDEOS, WRITERS, INSIGHT_BY_ID, DEFAULT_MODEL_VIEW, wordStrongs, modelBuildAt, modelHiddenIn, modelLeadAt, modelStateAt, modelViewAt, videosFor, videosForStrongs } from '@/lib/content';
import { compareLoc, contains, parseRef, touchesChapter, BOOKS, BEYOND, READING_ORDER, THE_66 } from '@/lib/refs';
import * as THREE from 'three';
import { buildProcedural, isProceduralKind } from '@/lib/models';
import { scaleReference } from '@/lib/models/scale';
import { cutParts } from '@/lib/models/view';
import { resolveRoute } from '@/lib/journey';
import { isPhrase, ladder } from '@/lib/chiasm';
import { quotedCount, tallySum } from '@/lib/tally';
import { laneOf, statedBefore } from '@/lib/reign';
import type { BibleBook, Model3D, Place, Profile, Source, StrongsEntry, Verdict } from '@/lib/types';

/** A procedural model drawn as each of its readings (once, if it has none). */
const drawings = (m: Model3D) => (m.readings?.map((r) => r.id) ?? [undefined]).map((reading) => ({ reading, model: buildProcedural(m.procedural!, reading), label: reading ? `${m.id} (${reading})` : m.id }));

const bad = (refs: string[]) => refs.filter((r) => !parseRef(r));
const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);

/** Every curated record that carries a `sources` array, flattened to (id, source) pairs. */
const citations = (): { id: string; s: Source }[] =>
  [...INSIGHTS, ...CANONS, ...PEOPLE, ...PROPHECIES, ...QUOTES, ...FRAGMENTS, ...WRITERS, ...SPEAKERS, ...CHIASMS, ...RULERS, ...MODELS, ...JOURNEYS, ...TALLIES, MONARCHY, ...MONARCHY.anchors, PASSION, ...PASSION.readings, SCROLLS, ...SCROLLS.hebrew, ...SCROLLS.overlaps, ...SCROLLS.numbering,
    ...PROFILES, ...PROFILES.flatMap((p) => (p.later ?? []).map((n) => ({ id: p.id, sources: n.sources })))]
    .flatMap((x) => ((x as { id: string; sources?: Source[] }).sources ?? []).map((s) => ({ id: x.id, s })));

/** Every quotation a king's reign makes of the text, with the verse it must be found in. */
function reignQuotes(): { id: string; ref: string; quote?: string }[] {
  const verdict = (id: string, v: Verdict) => [...(v.ref ? [{ id, ref: v.ref, quote: v.quote }] : []), ...(v.but ? [{ id, ...v.but }] : [])];
  return KINGS.flatMap(({ id, reign: r }) => [
    { id, ref: r.ref }, { id, ...r.length }, ...(r.synchronism ? [{ id, ref: r.synchronism.ref, quote: r.synchronism.quote }] : []),
    ...verdict(id, r.verdict), ...(r.chronicles ? [{ id, ref: r.chronicles.ref }, ...verdict(id, r.chronicles.verdict)] : []),
  ]);
}

/** The generated BSB text, for the checks that quote it; needs `npm run data`, which CI runs before testing. */
const bibleDir = new URL('../../public/data/bible/', import.meta.url);

/** Matches a wikipedia.org host only — wikisource (primary texts) and wikimedia (image credits) are fine. */
const WIKIPEDIA = /^https?:\/\/[^/]*\bwikipedia\.org\b/i;

describe('content integrity', () => {
  it('all references parse', () => {
    const all = [
      ...INSIGHTS.flatMap((i) => [...i.verses, ...i.sources.map((s) => s.ref).filter((r): r is string => !!r)]),
      ...PEOPLE.flatMap((p) => p.refs),
      ...PROPHECIES.flatMap((p) => [p.foretold, ...p.fulfilled.flatMap((f) => [f.ref, ...(f.event ? [f.event] : [])])]),
      ...QUOTES.flatMap((q) => [q.quoting, q.quoted]),
      ...FRAGMENTS.flatMap((f) => f.contents),
      ...SPEAKERS.map((s) => s.ref),
      ...WRITERS.flatMap((w) => w.books.flatMap((b) => b.refs ?? [])),
      ...CHIASMS.flatMap((c) => [c.ref, ...c.levels.map((l) => l.ref)]),
      ...RULERS.flatMap((r) => r.refs),
      ...MODELS.flatMap((m) => [...m.verses, ...(m.builds ?? []).flatMap((b) => [b.ref, ...b.steps.map((st) => st.ref)]), ...(m.states ?? []).flatMap((st) => st.accounts.flatMap((a) => [a.ref, ...a.changes.map((c) => c.ref)])) ]),
      ...VIDEOS.flatMap((v) => v.verses ?? []),
      ...JOURNEYS.flatMap((j) => [j.ref, ...j.stations.map((st) => st.verse)]),
      ...TALLIES.flatMap((t) => [t.ref, ...[...t.rows, ...(t.groups ?? [])].map((r) => r.ref), ...(t.total ? [t.total.ref] : [])]),
      ...reignQuotes().map((q) => q.ref),
      ...SCROLLS.overlaps.flatMap((o) => [o.a, o.b]),
      MONARCHY.kings, MONARCHY.chronicles,
      ...MONARCHY.anchors.flatMap((a) => (a.ref ? [a.ref] : [])),
      ...MONARCHY.prophets.flatMap((p) => [...p.refs, p.sent]),
      ...PROFILES.flatMap((p) => [...p.moments.map((m) => m.ref), ...[...p.sources, ...(p.later ?? []).flatMap((n) => n.sources)].map((s) => s.ref).filter((r): r is string => !!r)]),
    ];
    expect(bad(all)).toEqual([]);
  });
  it('ids are unique', () => {
    for (const list of [INSIGHTS, PEOPLE, PROPHECIES, QUOTES, FRAGMENTS, WRITERS, SPEAKERS, CHIASMS, RULERS, MODELS, VIDEOS, JOURNEYS, TALLIES, PROFILES]) {
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
  // The reader marks a narrowed word wherever it occurs, so the card must say which word, and only one card may claim it.
  it('word cards that narrow a word name its Strong\'s numbers, and no number has two', () => {
    const claimed = new Map<string, string>();
    for (const i of INSIGHTS) {
      if (i.strongs) expect(i.kind, `${i.id} has strongs but is not a word card`).toBe('word');
      for (const n of i.strongs ?? []) expect(n, `${i.id}: ${n}`).toMatch(/^[HG]\d+$/);
      if (!i.narrows) continue;
      expect(i.kind, `${i.id} narrows but is not a word card`).toBe('word');
      expect(wordStrongs(i).length, `${i.id} narrows but names no Strong's number`).toBeGreaterThan(0);
      expect(i.narrows.rendered.length && i.narrows.means, `${i.id} narrows without renderings or a meaning`).toBeTruthy();
      const only = i.narrows.only;
      if (only) expect(only.command || /^[HG]\d+$/.test(only.before ?? ''), `${i.id}: 'only' needs command or a Strong's number in before`).toBe(true);
      for (const n of wordStrongs(i)) {
        expect(claimed.get(n), `${n} is narrowed by both ${claimed.get(n)} and ${i.id}`).toBeUndefined();
        claimed.set(n, i.id);
      }
    }
  });
  const strongsDir = new URL('../../public/data/strongs/', import.meta.url);
  it.skipIf(!existsSync(strongsDir))('a narrowed rendering is one the BSB uses for the word', () => {
    const entry = (n: string): StrongsEntry | undefined =>
      JSON.parse(readFileSync(new URL(`${n[0]}/${Math.floor(+n.slice(1) / 100)}.json`, strongsDir), 'utf8'))[n];
    for (const i of INSIGHTS.filter((x) => x.narrows)) {
      const labels = wordStrongs(i).flatMap((n) => (entry(n)?.r ?? []).map(([l]) => l.toLowerCase()));
      for (const r of i.narrows!.rendered) {
        expect(labels.some((l) => l.split(/[\s/()]+/).includes(r.toLowerCase())), `${i.id}: the BSB never renders ${wordStrongs(i).join('/')} '${r}'`).toBe(true);
      }
    }
  });
  it('people link to existing parents and every person has a reference', () => {
    for (const p of PEOPLE) {
      expect(p.refs.length, `${p.id} has no refs`).toBeGreaterThan(0);
      for (const id of [p.father, p.mother, ...(p.spouses ?? []), ...(p.altParents ?? []).map((a) => a.id)]) if (id) expect(PEOPLE_BY_ID.has(id), `${p.id} → ${id}`).toBe(true);
      if (p.estimated) expect(p.notes, `${p.id} is estimated but has no note explaining why`).toBeTruthy();
    }
  });
  // A profile is held to an insight's standard, and what tradition adds is kept apart from what the text says.
  it('profiles cite the text, badge every later addition, mark their dates and credit their pictures', () => {
    for (const p of PROFILES) {
      expect(p.sources.some((s) => evidential.has(s.kind)), `${p.id} has no evidential source`).toBe(true);
      expect(['evidence', 'consensus', 'interpretation', 'estimate']).toContain(p.confidence);
      if (p.confidence === 'interpretation') expect(p.traditions?.length, `${p.id} is an interpretation but lists no traditions`).toBeGreaterThan(0);
      expect(p.people.length, `${p.id} covers no person`).toBeGreaterThan(0);
      expect(PROFILE_FILES[`/content/profiles/${p.id}.json`], `${p.id} must be in content/profiles/${p.id}.json, where loadProfile looks`).toBe(p);
      expect(p.moments.length, `${p.id} has no moments`).toBeGreaterThan(0);
      if (p.genealogy) expect(PEOPLE_BY_ID.has(p.genealogy), `${p.id} → ${p.genealogy}`).toBe(true);
      if (p.when || p.whenBasis) {
        expect(p.when?.startsWith('≈'), `${p.id}: a date is always approximate, so mark it ≈`).toBe(true);
        expect(p.whenBasis?.length, `${p.id}: say what the date rests on`).toBeGreaterThan(20);
      }
      for (const n of p.later ?? []) {
        expect(n.sources.length, `${p.id}: "${n.text.slice(0, 40)}…" cites nothing`).toBeGreaterThan(0);
        if (n.confidence === 'interpretation') expect(n.traditions?.length, `${p.id}: "${n.text.slice(0, 40)}…" names no one who holds it`).toBeGreaterThan(0);
      }
      for (const m of p.media ?? []) {
        expect(m.creditUrl, `${p.id}: ${m.src}`).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(m.credit && m.license, `${p.id}: ${m.src} needs its artist and licence`).toBeTruthy();
        expect(m.src, `${p.id}: Wikimedia serves 500px thumbnails`).toMatch(/^https:\/\/upload\.wikimedia\.org\/.*\/500px-/);
      }
    }
    const ids = PROFILES.flatMap((p) => p.people);
    expect(new Set(ids).size, 'a person has two profiles').toBe(ids.length);
    // The index the lists use is the same profiles, cut down.
    expect(PROFILE_INDEX.map((p) => [p.id, p.name, p.people])).toEqual(PROFILES.map((p) => [p.id, p.name, p.people]));
  });
  it.skipIf(!existsSync(bibleDir))('profile quotations are the BSB wording of the passages they cite', () => {
    const books = new Map<string, BibleBook>();
    const read = (id: string) => books.get(id) ?? books.set(id, JSON.parse(readFileSync(new URL(`${id}.json`, bibleDir), 'utf8'))).get(id)!;
    const textOf = (ref: string) => {
      const r = parseRef(ref)!, out: string[] = [];
      for (const b of READING_ORDER.slice(READING_ORDER.findIndex((x) => x.id === r.start.book), READING_ORDER.findIndex((x) => x.id === r.end.book) + 1)) {
        read(b.id).chapters.forEach((ch, i) => ch.forEach((v) => {
          const loc = { book: b.id, chapter: i + 1, verse: v.v };
          if (compareLoc(loc, r.start) >= 0 && compareLoc(loc, r.end) <= 0) out.push(v.t);
        }));
      }
      return out.join(' ');
    };
    const plain = (t: string) => t.replace(/[‘’]/g, "'").toLowerCase();
    const misquoted: string[] = [];
    for (const p of PROFILES) {
      const refs = [...p.moments.map((m) => m.ref), ...[...p.sources, ...(p.later ?? []).flatMap((n) => n.sources)].flatMap((s) => (s.ref ? [s.ref] : []))];
      const text = plain(refs.map(textOf).join(' '));
      for (const t of [p.summary, ...p.body, ...p.moments.map((m) => m.text)]) {
        for (const [, q] of t.matchAll(/“([^”]+)”/g)) {
          for (const part of q.split('…').map((x) => x.trim().replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, '')).filter(Boolean)) {
            if (!text.includes(plain(part))) misquoted.push(`${p.id}: “${part}”`);
          }
        }
      }
    }
    expect(misquoted, 'not the BSB wording of any passage the profile cites').toEqual([]);
  });
  const peopleDir = new URL('../../public/data/people/', import.meta.url);
  // Profiles are keyed on TIPNR's numbers, and TIPNR is pinned (scripts/fetch-sources.mjs): a new pin that
  // renumbers someone fails here.
  it.skipIf(!existsSync(peopleDir))('profiles name people the people data has', () => {
    for (const p of PROFILES) for (const id of p.people) {
      const file = new URL(`${personShard(id)}.json`, peopleDir);
      const shard = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> : {};
      expect(shard[id], `${p.id} → ${id}`).toBeTruthy();
    }
  });
  it.skipIf(!existsSync(peopleDir))('writers and speakers name people the people data has', () => {
    for (const x of [...WRITERS, ...SPEAKERS]) if (x.person) {
      const file = new URL(`${personShard(x.person)}.json`, peopleDir);
      const shard = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> : {};
      expect(shard[x.person], `${x.id} → ${x.person}`).toBeTruthy();
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
      const locs = j.stations.map((st) => parseRef(st.verse)!.start);
      j.stations.forEach((st, i) => expect(contains(j.ref, locs[i]), `${j.id}: ${st.name} (${st.verse}) is outside ${j.ref}`).toBe(true));
      for (let i = 1; i < locs.length; i++) expect(compareLoc(locs[i - 1], locs[i]), `${j.id}: ${j.stations[i].name} out of order`).toBeLessThanOrEqual(0);
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

  it('a chiasm quotes every level or none, and phrase levels sit in one verse', () => {
    for (const c of CHIASMS) {
      const quoted = c.levels.filter((l) => l.quote).length;
      expect([0, c.levels.length], `${c.id}: ${quoted} of ${c.levels.length} levels quoted`).toContain(quoted);
      if (c.confidence === 'interpretation') expect(c.traditions?.length, `${c.id} is an interpretation but lists no traditions`).toBeGreaterThan(0);
      expect(c.levels.some((l) => l.label === c.centre), `${c.id}: centre ${c.centre} is not a level`).toBe(true);
      if (!isPhrase(c)) continue;
      for (const l of c.levels) {
        const r = parseRef(l.ref)!;
        expect(r.start, `${c.id} ${l.label}: a quoted level is one verse`).toEqual(r.end);
      }
    }
  });
  it('passage-level chiasms do not share a chapter, since the reader draws one margin rail', () => {
    const passages = CHIASMS.filter((c) => !isPhrase(c));
    for (const b of BOOKS) for (let ch = 1; ch <= b.chapters; ch++) {
      const here = passages.filter((c) => touchesChapter(c.ref, b.id, ch)).map((c) => c.id);
      expect(here.length, `${b.id} ${ch}: ${here.join(', ')}`).toBeLessThan(2);
    }
  });
  it.skipIf(!existsSync(bibleDir))('chiasm quotes are the BSB wording, in order', () => {
    for (const c of CHIASMS.filter(isPhrase)) {
      for (const ref of new Set(c.levels.map((l) => l.ref))) {
        const loc = parseRef(ref)!.start;
        const book = JSON.parse(readFileSync(new URL(`${loc.book}.json`, bibleDir), 'utf8')) as BibleBook;
        const text = book.chapters[loc.chapter - 1].find((v) => v.v === loc.verse)!.t;
        expect(ladder(c, loc, text), `${c.id} at ${ref}: a quote is not in "${text}"`).not.toBeNull();
      }
    }
  });


  // A count is drawn from the text's own numbers, so each must be the verse's words and the sum must check.
  it('tallies cite evidence, run in order inside their passage, and add up', () => {
    for (const t of TALLIES) {
      expect(t.sources.some((s) => evidential.has(s.kind)), `${t.id} has no evidential source`).toBe(true);
      if (t.confidence === 'interpretation') expect(t.traditions?.length, `${t.id} is an interpretation but lists no traditions`).toBeGreaterThan(0);
      expect(t.rows.length, t.id).toBeGreaterThan(1);
      const rows = [...t.rows, ...(t.groups ?? []), ...(t.total ? [t.total] : [])];
      for (const r of rows) {
        const at = parseRef(r.ref)!;
        expect(at.start, `${t.id} ${r.label}: a row is one verse`).toEqual(at.end);
        expect(contains(t.ref, at.start), `${t.id} ${r.label}: ${r.ref} is outside ${t.ref}`).toBe(true);
        expect(quotedCount(r.quote), `${t.id} ${r.label}: "${r.quote}" is not ${r.count}`).toBe(r.count);
      }
      for (let i = 1; i < t.rows.length; i++) expect(compareLoc(parseRef(t.rows[i - 1].ref)!.start, parseRef(t.rows[i].ref)!.start), `${t.id}: ${t.rows[i].label} out of order`).toBeLessThanOrEqual(0);
      expect(new Set(t.rows.map((r) => r.label)).size, `${t.id}: two rows share a label`).toBe(t.rows.length);
      if (t.total && tallySum(t) !== t.total.count) expect(t.discrepancy?.length, `${t.id}: rows add up to ${tallySum(t)}, not ${t.total.count}, and no discrepancy is given`).toBeGreaterThan(20);
      if (t.discrepancy) expect(t.total && tallySum(t) !== t.total.count, `${t.id}: a discrepancy is given but the rows add up`).toBe(true);
      // A subtotal sums its own members, which it follows, and no row is counted in two.
      for (const g of t.groups ?? []) {
        const members = t.rows.filter((r) => g.members.includes(r.label));
        expect(members.map((r) => r.label).sort(), `${t.id} ${g.label}: unknown member`).toEqual([...g.members].sort());
        expect(members.reduce((n, r) => n + r.count, 0), `${t.id} ${g.label}: members do not add up`).toBe(g.count);
        for (const r of members) expect(compareLoc(parseRef(r.ref)!.start, parseRef(g.ref)!.start), `${t.id} ${g.label}: ${r.label} comes after it`).toBeLessThanOrEqual(0);
      }
      const grouped = (t.groups ?? []).flatMap((g) => g.members);
      expect(new Set(grouped).size, `${t.id}: a row is in two groups`).toBe(grouped.length);
      if (t.compare) {
        const before = TALLIES.find((x) => x.id === t.compare);
        expect(before, `${t.id} compares with unknown ${t.compare}`).toBeTruthy();
        // Bars are matched by label (or `same`), so both lists must name the same groups, but for those `alone` names.
        const alone = new Set(t.alone ?? []);
        expect(t.rows.filter((r) => !alone.has(r.label)).map((r) => r.same ?? r.label).sort(), `${t.id} and ${t.compare} count different groups`)
          .toEqual(before!.rows.filter((r) => !alone.has(r.label)).map((r) => r.label).sort());
        for (const a of alone) expect([...t.rows, ...before!.rows].some((r) => r.label === a), `${t.id}: '${a}' is alone but in neither list`).toBe(true);
      }
    }
  });
  // A reign's chart stands at its accession and quotes the text for its length, its date and its verdict.
  it('every king of the divided kingdoms has a reign, charted inside its account, and the reigns hold together', () => {
    const divided = RULERS.filter((r) => r.from >= MONARCHY.from && r.to <= -586 && /^(Judah|Israel \(northern kingdom\))$/.test(r.realm));
    expect(KINGS.map((k) => k.id).sort()).toEqual(divided.map((r) => r.id).sort());
    const ids = new Set(KINGS.map((k) => k.id));
    for (const { id, from, to, realm, reign: r } of KINGS) {
      expect(r.kingdom, id).toBe(realm === 'Judah' ? 'judah' : 'israel');
      expect(contains(MONARCHY.kings, parseRef(r.ref)!.start), `${id}: ${r.ref} is outside Kings`).toBe(true);
      if (r.chronicles) expect(contains(MONARCHY.chronicles, parseRef(r.chronicles.ref)!.start), `${id}: ${r.chronicles.ref} is outside Chronicles`).toBe(true);
      expect(r.length.years, id).toBeGreaterThan(0);
      if (r.synchronism) {
        const other = KINGS.find((k) => k.id === r.synchronism!.king);
        expect(other && other.reign.kingdom !== r.kingdom, `${id}: synchronism with ${r.synchronism.king}, not a king of the other kingdom`).toBe(true);
      }
      for (const v of [r.verdict, ...(r.chronicles ? [r.chronicles.verdict] : [])]) {
        if (v.kind === 'none') expect(!v.quote && !v.but && !!v.note, `${id}: no verdict, and a note to say so`).toBe(true);
        else expect(!!v.quote && !!v.ref, `${id}: a verdict quotes its verse`).toBe(true);
      }
      if (r.overlap) expect(r.overlap.until > from && r.overlap.until <= to && r.overlap.basis.length > 40, `${id}: overlap`).toBe(true);
      if (r.dynasty) expect(r.kingdom, id).toBe('israel');
    }
    for (const q of reignQuotes()) { const at = parseRef(q.ref)!; expect(at.start, `${q.id}: ${q.ref} is one verse`).toEqual(at.end); }
    // Each kingdom's reigns follow one another and do not run backwards; an overlap is the only way two meet.
    for (const kd of ['israel', 'judah'] as const) {
      const lane = laneOf(kd);
      for (let i = 1; i < lane.length; i++) expect(lane[i].reign.overlap?.until ?? lane[i].from, `${lane[i].id} begins before ${lane[i - 1].id}`).toBeGreaterThanOrEqual(lane[i - 1].from);
      for (let i = 1; i < lane.length; i++) expect(compareLoc(parseRef(lane[i - 1].reign.ref)!.start, parseRef(lane[i].reign.ref)!.start), `${lane[i].id} charted before ${lane[i - 1].id}`).toBeLessThan(0);
    }
    // Jehu's note rests on these sums: Joram and Ahaziah die the same day, 98 stated years from Jeroboam and 95 from Rehoboam.
    const jehu = KINGS.find((k) => k.id === 'jehu')!, athaliah = KINGS.find((k) => k.id === 'athaliah')!;
    expect(Math.round(statedBefore(jehu))).toBe(98);
    expect(statedBefore(athaliah)).toBe(95);
    expect(Math.round(statedBefore(jehu)) - laneOf('israel').slice(0, laneOf('israel').indexOf(jehu)).filter((k) => k.reign.length.years >= 1).length, 'one year less per northern reign counted in years').toBe(90);
    // The chart's pins, prophets and ways of counting name real kings and say what they rest on.
    expect(MONARCHY.traditions?.length).toBeGreaterThan(0);
    for (const a of MONARCHY.anchors) {
      expect(a.sources.some((x) => evidential.has(x.kind)), `${a.id}: no evidential source`).toBe(true);
      for (const k of a.kings) expect(ids.has(k), `${a.id}: unknown king ${k}`).toBe(true);
    }
    for (const p of MONARCHY.prophets) {
      expect(p.from <= p.to && p.basis.length > 20, p.id).toBe(true);
      expect(['israel', 'judah', 'both'], p.id).toContain(p.sentTo);
      expect(p.refs.some((r) => contains(r, parseRef(p.sent)!.start)), `${p.id}: ${p.sent}, the verse that shows whom he spoke to, is not one of his refs`).toBe(true);
      for (const k of p.kings) expect(ids.has(k), `${p.id}: unknown king ${k}`).toBe(true);
    }
    // Thiele's reading is the rulers' own dates; every other reading dates every king, and its overlaps say what they rest on.
    expect(MONARCHY.readings[0].id).toBe('thiele');
    expect(MONARCHY.readings[0].dates).toBeUndefined();
    for (const reading of MONARCHY.readings.slice(1)) {
      expect(Object.keys(reading.dates ?? {}).sort(), reading.id).toEqual([...ids].sort());
      expect(reading.sources.length, reading.id).toBeGreaterThan(0);
      for (const [id, d] of Object.entries(reading.dates!)) {
        expect(d.from <= d.to, `${reading.id} ${id}`).toBe(true);
        if (d.overlap) expect(d.overlap.until > d.from && d.overlap.until <= d.to && d.overlap.basis.length > 20, `${reading.id} ${id}: overlap`).toBe(true);
      }
      for (const kd of ['israel', 'judah'] as const) {
        const lane = laneOf(kd).map((k) => ({ id: k.id, ...reading.dates![k.id] }));
        for (let i = 1; i < lane.length; i++) expect(lane[i].overlap?.until ?? lane[i].from, `${reading.id}: ${lane[i].id} begins before ${lane[i - 1].id}`).toBeGreaterThanOrEqual(lane[i - 1].from);
      }
      for (const id of Object.keys(reading.notes ?? {})) expect(ids.has(id), `${reading.id}: note for unknown ${id}`).toBe(true);
    }
    for (const kd of ['israel', 'judah'] as const) {
      const spans = MONARCHY.reckoning.filter((r) => r.kingdom === kd);
      expect(spans[0].from, kd).toBe(MONARCHY.from);
      for (let i = 1; i < spans.length; i++) expect(spans[i].from, `${kd}: a gap in the reckoning`).toBe(spans[i - 1].to);
      const last = laneOf(kd).at(-1)!;
      expect(spans.at(-1)!.to, `${kd}: the reckoning stops before ${last.id}`).toBeGreaterThanOrEqual(last.to);
    }
  });
  it.skipIf(!existsSync(bibleDir))('reign quotes are the BSB wording', () => {
    for (const q of reignQuotes().filter((x) => x.quote)) {
      const loc = parseRef(q.ref)!.start;
      const book = JSON.parse(readFileSync(new URL(`${loc.book}.json`, bibleDir), 'utf8')) as BibleBook;
      const text = book.chapters[loc.chapter - 1].find((v) => v.v === loc.verse)!.t;
      expect(text, `${q.id} at ${q.ref}`).toContain(q.quote);
    }
  });
  it.skipIf(!existsSync(bibleDir))('tally quotes are the BSB wording', () => {
    for (const t of TALLIES) {
      for (const r of [...t.rows, ...(t.groups ?? []), ...(t.total ? [t.total] : [])]) {
        const loc = parseRef(r.ref)!.start;
        const book = JSON.parse(readFileSync(new URL(`${loc.book}.json`, bibleDir), 'utf8')) as BibleBook;
        const text = book.chapters[loc.chapter - 1].find((v) => v.v === loc.verse)!.t;
        expect(text, `${t.id} ${r.label}`).toContain(r.quote);
      }
    }
  });

  // The viewer sizes its figure, hand and scale bar from `scale`, so every model says how long its unit is.
  it('every model declares its scale', () => {
    for (const m of MODELS) {
      expect(m.scale?.metres, `${m.id}: no scale`).toBeGreaterThan(0);
      if (m.scale?.at) expect(m.scale.at, `${m.id}: scale.at is not [x, y, z]`).toHaveLength(3);
    }
  });
  const placedAt = (r: ReturnType<typeof scaleReference>, box: THREE.Box3, toward?: THREE.Vector3) => r.place(r.spot(box, undefined, toward), box, toward);
  it('small models get a hand for scale, large ones a figure, with a bar in round units', () => {
    const at = (x: number, y: number, z: number) => new THREE.Box3(new THREE.Vector3(-x / 2, 0, -z / 2), new THREE.Vector3(x / 2, y, z / 2));
    const placed = (r: ReturnType<typeof scaleReference>, box: THREE.Box3, where?: [number, number, number], toward?: THREE.Vector3) => r.place(r.spot(box, where, toward), box, toward);
    const coin = scaleReference({ metres: 0.02 }, at(1, 1, 0.1));
    expect(coin.kind).toBe('hand');
    expect(placed(coin, at(1, 1, 0.1), [0, -0.5, 0])).toBe('2 cm, in blocks of 1 cm');
    const noah = scaleReference({ metres: 0.445, unit: 'cubit' }, at(300, 31, 51));
    expect(noah.kind).toBe('figure');
    expect(placed(noah, at(300, 31, 51), [5, 0, 27])).toBe('50 cubits (≈ 22.3 m), in blocks of 10');
    expect(placed(scaleReference({ metres: 0.445, unit: 'cubit' }, at(2.5, 2.4, 1.7)), at(2.5, 2.4, 1.7))).toBe('1 cubit (≈ 44.5 cm)');
  });
  // During a build the figure moves to whatever the camera frames, standing beside it as the camera sees it.
  it('the size figure stands clear of a framed piece, beside it and not in front of it', () => {
    const tabernacle = scaleReference({ metres: 0.445, unit: 'cubit' }, new THREE.Box3(new THREE.Vector3(-50, 0, -25), new THREE.Vector3(50, 10, 25)));
    const table = new THREE.Box3(new THREE.Vector3(-11, 0, -3.7), new THREE.Vector3(-9, 1.6, -2.7));
    const camera = new THREE.Vector3(100, 50, 100), p = tabernacle.spot(table, undefined, camera);
    expect(p.y).toBe(0);
    expect(tabernacle.boundsAt(p).intersectsBox(table)).toBe(false);
    const centre = table.getCenter(new THREE.Vector3());
    expect(new THREE.Ray(camera, centre.clone().sub(camera).normalize()).intersectsBox(tabernacle.boundsAt(p))).toBe(false);
    // To the right as seen from the camera.
    expect(p.clone().sub(centre).cross(camera.clone().sub(centre)).y).toBeLessThan(0);
    expect(tabernacle.place(p, table, new THREE.Vector3(100, 50, 100))).toBe('1 cubit (≈ 44.5 cm)');
    // Beside a piece high off the ground (the temple's capitals, 18 cubits up) it still stands on the ground.
    const capital = new THREE.Box3(new THREE.Vector3(18, 18, -9), new THREE.Vector3(22, 23, -3));
    expect(tabernacle.spot(capital, undefined, new THREE.Vector3(100, 50, 100)).y).toBe(0);
  });
  it('a model that is one reading among several names who holds it', () => {
    for (const m of MODELS) if (m.confidence === 'interpretation') expect(m.traditions?.length, `${m.id} is an interpretation but lists no traditions`).toBeGreaterThan(0);
  });
  it('a model in long cubits marks its bar in them', () => {
    const ezekiel = scaleReference({ metres: 0.519, unit: 'long cubit' }, new THREE.Box3(new THREE.Vector3(-256, 0, -256), new THREE.Vector3(256, 60, 256)));
    expect(ezekiel.place(new THREE.Vector3(256, 0, 9), new THREE.Box3(new THREE.Vector3(-256, 0, -256), new THREE.Vector3(256, 60, 256)))).toBe('100 long cubits (≈ 51.9 m), in blocks of 10');
  });
  // Something tens of kilometres across (the New Jerusalem) gets the map instead of the figure, once
  // the viewer has loaded it, with Jerusalem under the framed box's middle; closer in, the figure again.
  it('the map stands in for the figure beside anything tens of kilometres across', () => {
    const S = 2_220_000, city = new THREE.Box3(new THREE.Vector3(-S / 2, 0, -S / 2), new THREE.Vector3(S / 2, S, S / 2));
    const gate = new THREE.Box3(new THREE.Vector3(S / 2, 0, -25), new THREE.Vector3(S / 2 + 17, 64, 25));
    const ref = scaleReference({ metres: 1 }, city);
    expect(placedAt(ref, city)).toBe('500 km, in blocks of 100 km');
    expect(ref.kind).toBe('figure'); // no map loaded
    ref.setMap(new THREE.Group());
    const p = ref.spot(city);
    expect([p.x, p.y, p.z]).toEqual([0, 0, 0]);
    expect(ref.place(p, city)).toBe('500 km, in blocks of 100 km');
    expect(ref.kind).toBe('map');
    placedAt(ref, gate, new THREE.Vector3(S, 50, 0));
    expect(ref.kind).toBe('figure');
  });
  // A model kilometres across (the camp of Israel) can bring the map in sooner, set on a place of its choosing.
  it('a model can bring the map in at its own size, with a chosen place under a chosen point', () => {
    const camp = new THREE.Box3(new THREE.Vector3(-9000, 0, -9000), new THREE.Vector3(9700, 1000, 9000));
    const tent = new THREE.Box3(new THREE.Vector3(-50, 0, -25), new THREE.Vector3(50, 10, 25));
    const ref = scaleReference({ metres: 0.445, unit: 'cubit', map: { from: 1000, on: 'Mount Moriah' } }, camp);
    const map = new THREE.Group(), fitted: number[] = [];
    map.userData.fit = (km: number) => fitted.push(km);
    ref.setMap(map);
    const p = ref.spot(camp);
    expect([p.x, p.y, p.z]).toEqual([0, 0, 0]);
    ref.place(p, camp);
    expect(ref.kind).toBe('map');
    expect(fitted[0]).toBeCloseTo(18700 * 0.445 / 1000, 3);
    placedAt(ref, tent, new THREE.Vector3(100, 50, 100));
    expect(ref.kind).toBe('figure');
  });
  const mapFile = new URL('../../public/data/map.json', import.meta.url);
  it.skipIf(!existsSync(mapFile))('a model sets its map on a place the map has', () => {
    const data = JSON.parse(readFileSync(mapFile, 'utf8')) as { cities: { name: string }[]; near?: { name: string }[] };
    const names = new Set([...data.cities, ...(data.near ?? [])].map((p) => p.name));
    for (const m of MODELS) if (m.scale?.map?.on) expect(names.has(m.scale.map.on), `${m.id}: no place '${m.scale.map.on}' on the map`).toBe(true);
  });
  // A model drawn more than one way names each reading, says what it rests on and, for a reading of
  // contested text, who holds it; its estimates are for parts that reading draws.
  it('model readings are named, say what they rest on, and estimate only parts they draw', () => {
    for (const m of MODELS.filter((x) => x.readings)) {
      const ids = m.readings!.map((r) => r.id);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i), `${m.id}: duplicate reading ids`).toEqual([]);
      for (const r of m.readings!) {
        expect(r.label && r.basis, `${m.id}: reading ${r.id} needs a label and a basis`).toBeTruthy();
        if (m.confidence === 'interpretation') expect(r.traditions?.length, `${m.id}: reading ${r.id} names no one who holds it`).toBeGreaterThan(0);
        const names = new Set<string>();
        if (m.procedural) buildProcedural(m.procedural, r.id).traverse((o) => { if (o.name) names.add(o.name); });
        for (const p of Object.keys(r.estimates ?? {})) expect(names.has(p), `${m.id}: reading ${r.id} estimates unknown part '${p}'`).toBe(true);
      }
    }
  });
  // 'Its length and width and height are equal' (Rev 21:16), however the wall is read.
  it('the New Jerusalem is a cube in every reading', () => {
    for (const { model, label } of drawings(MODELS.find((m) => m.id === 'new-jerusalem')!)) {
      const size = new THREE.Box3().setFromObject(model.getObjectByName('city')!).getSize(new THREE.Vector3());
      expect(Math.abs(size.y / size.x - 1), `${label}: the city is ${Math.round(size.x / 1000)} km wide and ${Math.round(size.y / 1000)} km high`).toBeLessThan(0.01);
    }
  });
  // The camp is drawn from the charts' figures, so the two cannot disagree: each tribe's ground is in
  // proportion to its figure in Numbers 2, and each Levite clan's to its figure in Numbers 3.
  it('the camp gives each tribe and clan ground in proportion to its figure, in each reading', () => {
    const area = (o: THREE.Object3D) => {
      let sum = 0;
      o.traverse((x) => {
        const g = (x as THREE.Mesh).geometry;
        if (!g || !(x as THREE.Mesh).isMesh) return;
        const p = g.getAttribute('position'), idx = g.getIndex()!, t = new THREE.Triangle(), [a, b, c] = [0, 1, 2].map(() => new THREE.Vector3());
        for (let i = 0; i < idx.count; i += 3) { a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2)); sum += t.set(a, b, c).getArea(); }
      });
      return sum;
    };
    const rows = ['num2-camp', 'num3-levites'].flatMap((id) => TALLIES.find((t) => t.id === id)!.rows);
    for (const { model, label, reading } of drawings(MODELS.find((m) => m.id === 'israels-camp')!)) {
      // As a troop only the hundreds are men, Kohath read as 8,300 (Humphreys 1998, Table 3).
      const figure = (r: (typeof rows)[number]) => reading === 'troops' ? (r.label === 'Kohath' ? 8300 : r.count) % 1000 : r.count;
      const per = rows.map((r) => area(model.getObjectByName(r.label.toLowerCase())!) / figure(r));
      for (const [i, r] of rows.entries()) expect(per[i] / per[0], `${label}: ${r.label}'s ground is out of proportion`).toBeCloseTo(1, 2);
    }
  });
  it('procedural models name a builder that exists', () => {
    for (const m of MODELS) if (m.kind === 'procedural') expect(isProceduralKind(m.procedural ?? ''), `${m.id}: no builder '${m.procedural}'`).toBe(true);
  });
  it('model builds stay inside their passage, run in order, and name parts the model has', () => {
    for (const m of MODELS) {
      if (!m.builds && !m.estimates) continue;
      // Every reading must have every part the builds name; the names are checked for each.
      const readings = m.kind === 'procedural' && m.procedural ? drawings(m) : [];
      let parts: Set<string> | null = null;
      for (const { model, label } of readings) {
        const names: string[] = [];
        model.traverse((o) => { if (o.name) names.push(o.name); });
        // Parts nest, so a name used twice would reveal two things at once.
        expect(names.filter((n, i) => names.indexOf(n) !== i), `${label}: duplicate part names`).toEqual([]);
        if (parts) expect([...names].sort(), `${label}: parts differ from the model's first reading`).toEqual([...parts].sort());
        parts = new Set(names);
      }
      if (parts) for (const p of Object.keys(m.estimates ?? {})) expect(parts.has(p), `${m.id}: estimate for unknown part '${p}'`).toBe(true);
      for (const b of m.builds ?? []) {
        if (parts) for (const p of Object.keys(b.omits ?? {})) {
          expect(parts.has(p), `${m.id}: build ${b.ref} omits unknown part '${p}'`).toBe(true);
          expect(b.steps.some((st) => st.parts.includes(p)), `${m.id}: build ${b.ref} both omits and adds '${p}'`).toBe(false);
        }
        const range = parseRef(b.ref)!;
        expect(m.verses.some((v) => contains(v, range.start) && contains(v, range.end)), `${m.id}: build ${b.ref} is outside the model's verses`).toBe(true);
        let prev = range.start;
        for (const st of b.steps) {
          const r = parseRef(st.ref)!;
          expect(contains(b.ref, r.start) && contains(b.ref, r.end), `${m.id}: step ${st.ref} is outside ${b.ref}`).toBe(true);
          expect(compareLoc(r.start, prev), `${m.id}: step ${st.ref} is out of order`).toBeGreaterThanOrEqual(0);
          prev = r.start;
          // A step that only moves the camera (the New Jerusalem measured, 21:16) says where to with `frame`.
          expect(st.parts.length + (st.frame?.length ?? 0), `${m.id}: step ${st.ref} adds nothing`).toBeGreaterThan(0);
          if (parts) for (const p of [...st.parts, ...st.frame ?? []]) expect(parts.has(p), `${m.id}: step ${st.ref} names unknown part '${p}'`).toBe(true);
          for (const p of st.cuts ?? []) expect(st.parts, `${m.id}: step ${st.ref} cuts '${p}', which it does not add`).toContain(p);
        }
      }
    }
  });
  // A part a build never reaches stays hidden to the end of the passage; that must be a choice the
  // content states (the build's `omits`), not an oversight. Parts only a later state shows are exempt.
  it('a build shows every part by its last step, unless it says it omits it', () => {
    for (const m of MODELS) {
      if (m.kind !== 'procedural' || !m.procedural || !m.builds) continue;
      for (const { model, label } of drawings(m)) {
      const named = (o: THREE.Object3D | null, set: Set<string>) => { for (let n = o; n && n !== model; n = n.parent) if (set.has(n.name)) return true; return false; };
      const leaves: THREE.Object3D[] = [];
      model.traverse((o) => { if (o.name && o !== model && !o.children.some((c) => { let inner = false; c.traverse((x) => { if (x.name) inner = true; }); return inner; })) leaves.push(o); });
      for (const b of m.builds) {
        const added = new Set(b.steps.flatMap((st) => st.parts)), omitted = new Set([...Object.keys(b.omits ?? {}), ...(m.states ?? []).flatMap((st) => st.accounts.flatMap((a) => a.changes.flatMap((c) => c.shows ?? [])))]);
        const missing = leaves.filter((o) => !named(o, added) && !named(o, omitted)).map((o) => o.name);
        expect(missing, `${label}: build ${b.ref} never shows these parts and does not list them in omits`).toEqual([]);
      }
      }
    }
  });
  // Build steps fade parts in by fading their materials, so a material shared by two parts would
  // fade a part already shown whenever the other arrives.
  it('no material is shared between two parts of a model', () => {
    for (const m of MODELS) {
      if (m.kind !== 'procedural' || !m.procedural || !m.builds) continue;
      for (const { model, label } of drawings(m)) {
      const owners = new Map<THREE.Material, Set<string>>();
      model.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (!mat) return;
        let n: THREE.Object3D | null = o;
        while (n && !n.name) n = n.parent;
        for (const x of Array.isArray(mat) ? mat : [mat]) owners.set(x, (owners.get(x) ?? new Set()).add(n?.name ?? '(root)'));
      });
      const shared = [...owners.values()].filter((s) => s.size > 1).map((s) => [...s].join(' + '));
      expect(shared, `${label}: materials shared between parts`).toEqual([]);
      }
    }
  });
  // A state changes what was built, so it names real parts, says what it rests on, and falls within
  // the model's verses, its changes in reading order; the parts it shows are alternates, which no build adds.
  it('model states name parts the model has, change in order within their passage, and show only alternates', () => {
    for (const m of MODELS) {
      if (!m.states) continue;
      const names = new Set<string>();
      if (m.kind === 'procedural' && m.procedural) for (const { model } of drawings(m)) model.traverse((o) => { if (o.name) names.add(o.name); });
      const built = new Set((m.builds ?? []).flatMap((b) => b.steps.flatMap((st) => st.parts)));
      expect(new Set(m.states.map((st) => st.id)).size, `${m.id}: duplicate state ids`).toBe(m.states.length);
      for (const st of m.states) {
        expect(st.basis.length, `${m.id} ${st.id}: no basis`).toBeGreaterThan(20);
        for (const a of st.accounts) {
          const range = parseRef(a.ref)!;
          expect(m.verses.some((v) => contains(v, range.start) && contains(v, range.end)), `${m.id} ${st.id}: ${a.ref} is outside the model's verses`).toBe(true);
          let prev = range.start;
          for (const c of a.changes) {
            const r = parseRef(c.ref)!;
            expect(contains(a.ref, r.start) && contains(a.ref, r.end), `${m.id} ${st.id}: change ${c.ref} is outside ${a.ref}`).toBe(true);
            expect(compareLoc(r.start, prev), `${m.id} ${st.id}: change ${c.ref} is out of order`).toBeGreaterThanOrEqual(0);
            prev = r.start;
            expect((c.hides ?? []).length + (c.shows ?? []).length, `${m.id} ${st.id}: change ${c.ref} changes nothing`).toBeGreaterThan(0);
            for (const p of [...(c.hides ?? []), ...(c.shows ?? [])]) expect(names.has(p), `${m.id} ${st.id}: unknown part '${p}'`).toBe(true);
            for (const p of c.shows ?? []) expect(built.has(p), `${m.id} ${st.id}: '${p}' is shown by a state and added by a build`).toBe(false);
          }
        }
      }
    }
  });
  it('a later state changes verse by verse as it is read, and accumulates the states before it', () => {
    const temple = MODELS.find((m) => m.id === 'solomons-temple')!;
    const at = (book: string, chapter: number, verse: number) => ({ book, chapter, verse });
    const hiddenAt = (loc: ReturnType<typeof at>) => modelHiddenIn(temple, modelStateAt(temple, loc)?.state.id ?? null, loc);
    expect(modelStateAt(temple, at('1Kgs', 8, 64))).toBeNull();
    const asBuilt = modelHiddenIn(temple, null);
    expect([asBuilt.has('sea-on-stone'), asBuilt.has('oxen')]).toEqual([true, false]);
    // Ahaz: the altar moves at 16:14, the Sea comes off the oxen at 16:17.
    expect(modelStateAt(temple, at('2Kgs', 16, 10))!.step).toBe(0);
    const v14 = hiddenAt(at('2Kgs', 16, 14)), v17 = hiddenAt(at('2Kgs', 16, 17));
    expect([v14.has('bronze-altar'), v14.has('bronze-altar-north'), v14.has('oxen')]).toEqual([true, false, false]);
    expect([v17.has('oxen'), v17.has('sea-on-stone')]).toEqual([true, false]);
    // Picked whole, a state has all its changes; Hezekiah's temple still has Ahaz's.
    expect(modelHiddenIn(temple, 'ahaz').has('oxen')).toBe(true);
    const hezekiah = hiddenAt(at('2Kgs', 18, 16));
    expect([hezekiah.has('oxen'), hezekiah.has('door-gold')]).toEqual([true, true]);
    // Babylon, as Jeremiah tells it: the house burns at 52:13, the bronzes go at 52:17.
    const j13 = hiddenAt(at('Jer', 52, 13)), j17 = hiddenAt(at('Jer', 52, 17));
    expect([j13.has('roof'), j13.has('pillars'), j17.has('pillars'), j17.has('walls')]).toEqual([true, false, true, false]);
  });
  it('a model builds up through its passage and is whole outside it', () => {
    const ark = MODELS.find((m) => m.id === 'ark-of-the-covenant')!;
    expect(modelBuildAt(ark, { book: 'Exod', chapter: 25, verse: 9 })).toBeNull();
    expect([...modelBuildAt(ark, { book: 'Exod', chapter: 25, verse: 12 })!.parts].sort()).toEqual(['ark-chest', 'ark-moulding', 'ark-overlay', 'ark-rings']);
    expect(modelBuildAt(ark, { book: 'Exod', chapter: 25, verse: 15 })!.step).toBe(4);
    // Bezalel's account never puts the Testimony in; that happens at Exod 40:20.
    expect(modelBuildAt(ark, { book: 'Exod', chapter: 37, verse: 9 })!.parts.has('ark-tablets')).toBe(false);
    // Noah's ark: its size (Gen 6:15) is built in with the hull; the roof, door and decks come at 6:16.
    const noah = MODELS.find((m) => m.id === 'noahs-ark')!;
    expect([...modelBuildAt(noah, { book: 'Gen', chapter: 6, verse: 15 })!.parts].sort()).toEqual(['hull', 'pitch', 'rooms']);
    expect(modelBuildAt(noah, { book: 'Gen', chapter: 7, verse: 1 })).toBeNull();
    // Solomon's temple: Kings sets out one table and no veil; Chronicles ten tables and a veil.
    const temple = MODELS.find((m) => m.id === 'solomons-temple')!;
    const kings = modelBuildAt(temple, { book: '1Kgs', chapter: 8, verse: 8 })!.parts;
    expect([kings.has('table'), kings.has('more-tables'), kings.has('veil')]).toEqual([true, false, false]);
    const chron = modelBuildAt(temple, { book: '2Chr', chapter: 5, verse: 9 })!.parts;
    expect([chron.has('more-tables'), chron.has('veil'), chron.has('side-chambers')]).toEqual([true, true, false]);
    // The high priest's garments: the breastpiece's stones go on a row a verse; Lev 8 dresses Aaron from the tunic outward.
    const ezekiel = MODELS.find((m) => m.id === 'ezekiels-temple')!;
    expect([...modelBuildAt(ezekiel, { book: 'Ezek', chapter: 40, verse: 8 })!.parts].sort()).toEqual(['east-gate-chambers', 'east-gate-inner-threshold', 'east-gate-steps', 'east-gate-threshold', 'outer-wall']);
    expect(modelBuildAt(ezekiel, { book: 'Ezek', chapter: 43, verse: 18 })).toBeNull();

    const garments = MODELS.find((m) => m.id === 'priestly-garments')!;
    const rows = modelBuildAt(garments, { book: 'Exod', chapter: 28, verse: 18 })!.parts;
    expect([rows.has('stones-row-2'), rows.has('stones-row-3'), rows.has('tunic')]).toEqual([true, false, false]);
    const dressed = modelBuildAt(garments, { book: 'Lev', chapter: 8, verse: 7 })!.parts;
    expect([dressed.has('robe'), dressed.has('breastpiece'), dressed.has('turban')]).toEqual([true, false, false]);
  });
  // A step that cuts the model open needs parts that open at a step; otherwise it would do nothing.
  it('a step that cuts a model open names a model with parts cut at steps', () => {
    for (const m of MODELS) {
      const cutting = (m.builds ?? []).flatMap((b) => b.steps.filter((st) => st.cutaway));
      if (!cutting.length) continue;
      for (const { model, label } of drawings(m)) expect(cutParts(model).some(([, how]) => how === 'step'), `${label}: steps cut it open but no part is cut at steps`).toBe(true);
    }
  });
  // While a passage builds or changes a model the camera holds an angle; elsewhere the model turns.
  it('the camera holds an angle while a passage builds or changes a model, and turns outside it', () => {
    const garments = MODELS.find((m) => m.id === 'priestly-garments')!;
    expect(modelViewAt(garments, { book: 'Exod', chapter: 28, verse: 4 }, null)).toBeNull();
    expect(modelViewAt(garments, { book: 'Exod', chapter: 28, verse: 6 }, null)).toEqual([205, 12]);
    expect(modelViewAt(garments, { book: 'Exod', chapter: 28, verse: 8 }, null)).toEqual(garments.view);
    const temple = MODELS.find((m) => m.id === 'solomons-temple')!;
    expect(modelViewAt(temple, { book: '2Kgs', chapter: 25, verse: 9 }, 'babylon')).toEqual(temple.view ?? DEFAULT_MODEL_VIEW);
    expect(modelViewAt(temple, { book: '2Kgs', chapter: 25, verse: 9 }, null)).toBeNull(); // the reader picked the temple as built
    const angles = MODELS.flatMap((m) => [m.view, ...(m.builds ?? []).flatMap((b) => b.steps.map((st) => st.view)), ...(m.states ?? []).flatMap((st) => st.accounts.flatMap((a) => a.changes.map((c) => c.view)))]);
    for (const v of angles) if (v) expect(v.length === 2 && Math.abs(v[1]) < 90, `bad view ${JSON.stringify(v)}`).toBe(true);
  });
  it('every source that names a passage names one that parses', () => {
    expect(bad(citations().flatMap(({ s }) => (s.ref ? [s.ref] : [])))).toEqual([]);
  });
  it('a book beyond the 66 says which churches read it and whose translation it is, and each church cites its own statement', () => {
    for (const b of BEYOND) {
      expect(b.beyond!.canons.length, b.id).toBeGreaterThan(0);
      for (const c of b.beyond!.canons) expect(CANON_BY_ID.has(c), `${b.id}: ${c}`).toBe(true);
      expect(TEXT_BY_ID.has(b.beyond!.text), `${b.id}: ${b.beyond!.text}`).toBe(true);
    }
    for (const c of CANONS) expect(c.sources.some((x) => evidential.has(x.kind)), `${c.id} cites no primary statement`).toBe(true);
  });
  it('the Hebrew books cover the Old Testament once, each a run of English books, and a joined one says what joins it', () => {
    const ot = THE_66.filter((b) => b.testament === 'OT').map((b) => b.id);
    const covered = SCROLLS.hebrew.flatMap((h) => h.books);
    expect([...covered].sort()).toEqual([...ot].sort());
    for (const h of SCROLLS.hebrew) {
      const at = h.books.map((id) => ot.indexOf(id));
      expect(at.every((i, k) => k === 0 || i === at[k - 1] + 1), `${h.id}'s books are not consecutive in the English order`).toBe(true);
      expect(!!h.kind, `${h.id}: a Hebrew book of several English ones says whether it is one book or one scroll`).toBe(h.books.length > 1);
      if (h.kind === 'scroll') expect(h.gap, `${h.id} says how many blank lines lie between its books`).toBeGreaterThan(0);
      if (h.kind) {
        expect(h.summary, h.id).toBeTruthy();
        expect(h.sources?.some((s) => evidential.has(s.kind)), `${h.id} cites no primary source for the join`).toBe(true);
      }
    }
    for (const id of Object.keys(SCROLLS.greek)) expect(SCROLLS.hebrew.find((h) => h.books.includes(id))?.kind, `a Greek name for ${id}, which the Hebrew does not join to another book`).toBe('book');
    for (const x of [SCROLLS, ...SCROLLS.overlaps, ...SCROLLS.numbering]) {
      expect(x.sources.length, x.id).toBeGreaterThan(0);
      if (x.confidence === 'interpretation') expect((x as { traditions?: string[] }).traditions?.length, x.id).toBeGreaterThan(0);
    }
    expect(SCROLLS.sources.some((s) => evidential.has(s.kind))).toBe(true);
  });
  it('words repeated across a book\'s end are the same words in the BSB, and end one book and open another', () => {
    const first = (ref: string) => {
      const { start } = parseRef(ref)!;
      const b = JSON.parse(readFileSync(new URL(`${start.book}.json`, bibleDir), 'utf8')) as BibleBook;
      return { text: b.chapters[start.chapter - 1].find((v) => v.v === start.verse)!.t, last: start.chapter === b.chapters.length, opens: start.chapter === 1 && start.verse === 1 };
    };
    for (const o of SCROLLS.overlaps) {
      const a = first(o.a), b = first(o.b);
      expect(a.text, o.id).toBe(b.text);
      expect(a.last && b.opens, `${o.id}: ${o.a} should end its book and ${o.b} open its own`).toBe(true);
    }
  });
  it('an echo, which is a judgement and not a quotation, cites who records it', () => {
    for (const q of QUOTES.filter((q) => q.allusion)) expect(q.sources?.length, q.id).toBeGreaterThan(0);
  });
  it('a prophecy is fulfilled away from where it is foretold, and names an event only where it is told apart from the note', () => {
    for (const p of PROPHECIES) {
      expect(p.fulfilled.length, p.id).toBeGreaterThan(0);
      for (const f of p.fulfilled) {
        expect(f.event, `${p.id}: ${f.ref} gives itself as its event`).not.toBe(f.ref);
        for (const r of [f.ref, ...(f.event ? [f.event] : [])]) expect(contains(p.foretold, parseRef(r)!.start), `${p.id}: ${r} is inside ${p.foretold}`).toBe(false);
      }
    }
  });
  it.skipIf(!existsSync(bibleDir))('the books beyond the 66 are built whole, and what the content cites in them is there', () => {
    const texts = new Map(BEYOND.map((b) => [b.id, JSON.parse(readFileSync(new URL(`${b.id}.json`, bibleDir), 'utf8')) as BibleBook]));
    for (const [id, t] of texts) {
      expect(t.chapters.length, id).toBe(BEYOND.find((b) => b.id === id)!.chapters);
      t.chapters.forEach((ch, i) => expect(ch.length, `${id} ${i + 1}`).toBeGreaterThan(0));
    }
    const cited = [...QUOTES.flatMap((q) => [q.quoted, q.quoting]), ...INSIGHTS.flatMap((i) => i.verses), ...citations().flatMap(({ s }) => (s.ref ? [s.ref] : []))];
    for (const ref of cited) {
      const r = parseRef(ref)!;
      for (const end of [r.start, r.end]) {
        const t = texts.get(end.book);
        if (!t || end.verse === 999) continue;
        const v = t.chapters[end.chapter - 1]?.find((x) => x.v === end.verse);
        expect(v && (v.t || v.f), `${ref}: ${end.book} ${end.chapter}:${end.verse} is not in the text`).toBeTruthy();
      }
    }
  });
  it('rulers with estimated dates say so, and writers name real books', () => {
    for (const r of RULERS) expect(r.from <= r.to, r.id).toBe(true);
    for (const w of WRITERS) for (const b of w.books) expect(BOOKS.some((x) => x.id === b.book), `${w.id}: ${b.book}`).toBe(true);
  });
  // The People tab says who wrote every verse, so no book (and no psalm) may be left without an entry.
  it('every book and every psalm has a writer entry', () => {
    for (const b of BOOKS) expect(WRITERS.some((w) => w.books.some((x) => x.book === b.id)), `no writer for ${b.id}`).toBe(true);
    for (const w of WRITERS) for (const b of w.books) for (const r of b.refs ?? []) expect(parseRef(r)?.start.book, `${w.id}: ${r}`).toBe(b.book);
    for (let ch = 1; ch <= 150; ch++) {
      const loc = { book: 'Ps', chapter: ch, verse: 1 };
      expect(WRITERS.some((w) => w.books.some((b) => b.book === 'Ps' && b.refs?.some((r) => contains(r, loc)))), `no writer for Psalm ${ch}`).toBe(true);
    }
  });
  // A psalm's writer is whoever its heading names, so each list is checked against the BSB's headings both ways:
  // every psalm listed carries the heading, and every psalm carrying it is listed.
  it.skipIf(!existsSync(bibleDir))('psalm writers are the ones the headings name', () => {
    const ps = JSON.parse(readFileSync(new URL('Ps.json', bibleDir), 'utf8')) as BibleBook;
    const NOT_A_HEADING: Record<number, string> = { 132: "'remember on behalf of David' is the psalm's first line, not its heading" };
    for (const w of WRITERS.filter((x) => x.heading)) for (let ch = 1; ch <= 150; ch++) {
      const listed = w.books.some((b) => b.refs?.includes(`Ps.${ch}`));
      const headed = !NOT_A_HEADING[ch] && ps.chapters[ch - 1][0].t.toLowerCase().includes(w.heading!.toLowerCase());
      expect(listed, `Psalm ${ch}: ${w.id} is ${listed ? 'listed but not in its heading' : 'in its heading but not listed'}`).toBe(headed);
    }
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
  // The project has no voice of its own: a summary that speaks in the first person or argues
  // is BibleProject's, quoted and marked as theirs (checked against its source when added).
  it('video summaries are either quoted from BibleProject or only say what the video covers', () => {
    for (const v of VIDEOS) {
      if (!v.summary || v.summaryFrom) continue;
      expect(v.summary, `${v.id}: first person in the project's voice`).not.toMatch(/\b(we|us|our|you|your)\b/i);
      expect(v.summary.length, `${v.id}: an unquoted summary should only name what the video covers`).toBeLessThan(100);
    }
  });
  it('ranks a video about the passage above book overviews, and finds word studies by Strong\'s number', () => {
    const atPrayer = videosFor({ book: 'Matt', chapter: 6, verse: 9 });
    expect(atPrayer[0].verses?.some((r) => r.startsWith('Matt.6.9'))).toBe(true);
    expect(atPrayer.findIndex((v) => v.kind === 'overview')).toBeGreaterThan(0);
    expect(videosForStrongs('H2617').map((v) => v.title)).toContain('Khesed / Loyal Love');
  });
});

describe('the model the text is working on', () => {
  // The Models tab scrolls to this model's card when it changes; where builds overlap, the latest step leads.
  const lead = (book: string, chapter: number, verse: number) => modelLeadAt({ book, chapter, verse })?.id ?? null;
  it('follows 1 Kings 7 from the temple to the House of the Forest of Lebanon and back', () => {
    expect(lead('1Kgs', 6, 2)).toBe('solomons-temple');
    expect(lead('1Kgs', 7, 2)).toBe('forest-of-lebanon');
    expect(lead('1Kgs', 7, 5)).toBe('forest-of-lebanon');
    expect(lead('1Kgs', 7, 15)).toBe('solomons-temple');
    expect(lead('1Kgs', 10, 17)).toBe('forest-of-lebanon');
  });
});
