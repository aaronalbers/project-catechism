import type { PanelTab, Reveal } from '@/app/store';
import { CHIASMS, FRAGMENTS, INSIGHTS, JOURNEYS, MODELS, PROPHECIES, QUOTES, TALLIES } from './content';
import { BOOKS, bookIndex, compareLoc, contains, formatRef, parseRef } from './refs';
import type { InsightKind, Ref } from './types';

/**
 * The index of curated features that only some passages have: where the models, chiasms, counts, journeys
 * and the rest are, so a reader can find them without already being on the right verse. Everything
 * here is derived from `content/`, so a new entry there appears in the index with no registration.
 */
export type FeatureKind = 'model' | 'chiasm' | 'tally' | 'journey' | 'prophecy' | 'quote' | 'fragment' | 'insight';

/** A labelled row of references on an entry ("Built in", "Fulfilled"). */
export interface CatalogLine { label?: string; refs: Ref[] }
export interface CatalogEntry {
  id: string; kind: FeatureKind; title: string; summary: string;
  /** Where clicking the entry goes: a model's first build step, a prophecy's giving. */
  go: Ref;
  lines: CatalogLine[];
  /** A sub-heading within the section (an insight's kind). */
  group?: string;
}

/** The element id of an entry's card in its panel, which a link from the index scrolls to. */
export const cardId = (e: { kind: FeatureKind; id: string }) => `${e.kind}-${e.id}`;
export interface CatalogSection {
  id: string; kind: FeatureKind; title: string; blurb: string; tab: PanelTab; entries: CatalogEntry[];
  /** What the reader should bring into view on arrival, beyond the verse. */
  reveal?: Reveal;
}

const byPosition = (a: CatalogEntry, b: CatalogEntry) => compareLoc(parseRef(a.go)!.start, parseRef(b.go)!.start);
const sorted = (entries: CatalogEntry[]) => entries.sort(byPosition);

const INSIGHT_GROUPS: Record<InsightKind, string> = {
  archaeology: 'Archaeology', culture: 'Culture', money: 'Money and measures', word: 'Words', history: 'History', geography: 'Geography',
};

function modelLines(m: (typeof MODELS)[number]): CatalogLine[] {
  const builds = (m.builds ?? []).map((b) => b.ref);
  const states = (m.states ?? []).map((s) => ({ label: s.label, refs: s.accounts.map((a) => a.ref) }));
  const told = [...builds, ...states.flatMap((s) => s.refs)];
  const also = m.verses.filter((v) => !told.some((t) => contains(t, parseRef(v)!.start)));
  if (!told.length) return [{ refs: m.verses }];
  return [
    ...(builds.length ? [{ label: 'Built as you read', refs: builds }] : []),
    ...states,
    ...(also.length ? [{ label: 'Also in', refs: also }] : []),
  ];
}

export const CATALOG: CatalogSection[] = [
  {
    id: 'models', kind: 'model', title: '3D models', tab: 'models',
    blurb: 'Drawn from the text’s own measurements. Most build part by part as the passage is read aloud.',
    entries: sorted(MODELS.map((m) => ({
      id: m.id, kind: 'model', title: m.title, summary: m.dimensions ?? '',
      go: m.builds?.[0]?.steps[0]?.ref ?? m.verses[0],
      lines: modelLines(m),
    }))),
  },
  {
    id: 'chiasms', kind: 'chiasm', title: 'Chiasms', tab: 'links', reveal: 'chiasm',
    blurb: 'Mirrored structures drawn on the text itself: a ladder for phrases, a margin rail for passages.',
    entries: sorted(CHIASMS.map((c) => ({
      id: c.id, kind: 'chiasm', title: c.title, summary: c.summary,
      go: c.ref, lines: [{ label: c.levels.some((l) => l.quote) ? 'Phrase' : 'Passage', refs: [c.ref] }],
    }))),
  },
  {
    id: 'counts', kind: 'tally', title: 'Counts', tab: 'links', reveal: 'tally',
    blurb: 'Numbers the text lists group by group, such as a census, drawn as bars on one scale that fill verse by verse.',
    entries: sorted(TALLIES.map((t) => ({
      id: t.id, kind: 'tally', title: t.title, summary: t.summary,
      go: t.ref, lines: [{ label: `${t.rows.length} groups`, refs: [t.ref] }],
    }))),
  },
  {
    id: 'journeys', kind: 'journey', title: 'Journeys and borders', tab: 'places',
    blurb: 'Itineraries and boundaries drawn on the map a stretch per verse as the text names each place.',
    entries: sorted(JOURNEYS.map((j) => ({
      id: j.id, kind: 'journey', title: j.title, summary: j.summary,
      go: j.ref, lines: [{ label: `${j.kind === 'border' ? 'Border' : 'Route'}, ${j.stations.length} places`, refs: [j.ref] }],
    }))),
  },
  {
    id: 'prophecies', kind: 'prophecy', title: 'Prophecies', tab: 'links',
    blurb: 'Where a prophecy is given, and where the text says it is fulfilled.',
    entries: sorted(PROPHECIES.map((p) => ({
      id: p.id, kind: 'prophecy', title: p.title, summary: p.summary,
      go: p.given, lines: [{ label: 'Given', refs: [p.given] }, { label: 'Fulfilled', refs: p.fulfilled }],
    }))),
  },
  {
    id: 'quotes', kind: 'quote', title: 'The Old Testament quoted', tab: 'links',
    blurb: 'Where a New Testament writer quotes an earlier passage.',
    entries: sorted(QUOTES.map((q) => ({
      id: q.id, kind: 'quote', title: `${formatRef(q.quoting)} quotes ${formatRef(q.quoted)}`, summary: q.summary,
      go: q.quoting, lines: [{ refs: [q.quoting, q.quoted] }],
    }))),
  },
  {
    id: 'fragments', kind: 'fragment', title: 'Manuscripts', tab: 'links',
    blurb: 'Early surviving copies, and the verses each one preserves.',
    entries: sorted(FRAGMENTS.map((f) => ({
      id: f.id, kind: 'fragment', title: `${f.siglum} — ${f.name}`, summary: `${f.date}. ${f.held}.`,
      go: f.contents[0], lines: [{ label: 'Preserves', refs: f.contents }],
    }))),
  },
  {
    id: 'insights', kind: 'insight', title: 'Insights', tab: 'insights',
    blurb: 'Cited background cards: archaeology, culture, money, words.',
    entries: (Object.keys(INSIGHT_GROUPS) as InsightKind[]).flatMap((k) => sorted(INSIGHTS.filter((i) => i.kind === k).map((i) => ({
      id: i.id, kind: 'insight' as const, title: i.title, summary: i.summary,
      go: i.verses[0], lines: [{ refs: i.verses }], group: INSIGHT_GROUPS[k],
    })))),
  },
];

export const FEATURE_ORDER: FeatureKind[] = CATALOG.map((s) => s.kind);
export const FEATURE_LABEL = Object.fromEntries(CATALOG.map((s) => [s.kind, s.title])) as Record<FeatureKind, string>;

/** Every chapter a reference touches, across chapter and book boundaries. */
export function chaptersOf(ref: Ref): { book: string; chapter: number }[] {
  const r = parseRef(ref);
  if (!r) return [];
  const out: { book: string; chapter: number }[] = [];
  const first = bookIndex(r.start.book), last = bookIndex(r.end.book);
  for (let bi = first; bi <= last; bi++) {
    const b = BOOKS[bi];
    const from = bi === first ? r.start.chapter : 1, to = bi === last ? Math.min(r.end.chapter, b.chapters) : b.chapters;
    for (let c = from; c <= to; c++) out.push({ book: b.id, chapter: c });
  }
  return out;
}

let byChapter: Map<string, Map<number, Set<FeatureKind>>> | null = null;

/** The features in each chapter of a book, for dots in the chapter picker. */
export function featuresInBook(bookId: string): Map<number, Set<FeatureKind>> {
  if (!byChapter) {
    byChapter = new Map();
    for (const e of CATALOG.flatMap((s) => s.entries)) {
      for (const { book, chapter } of e.lines.flatMap((l) => l.refs).flatMap(chaptersOf)) {
        if (!byChapter.has(book)) byChapter.set(book, new Map());
        const chapters = byChapter.get(book)!;
        if (!chapters.has(chapter)) chapters.set(chapter, new Set());
        chapters.get(chapter)!.add(e.kind);
      }
    }
  }
  return byChapter.get(bookId) ?? new Map();
}

/** In display order. */
export const orderKinds = (kinds: Iterable<FeatureKind>) => { const s = new Set(kinds); return FEATURE_ORDER.filter((k) => s.has(k)); };
