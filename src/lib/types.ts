/** OSIS-style reference: "Matt.1.1", a range "Matt.1.1-Matt.1.5", or a chapter "Matt.1". */
export type Ref = string;

export interface Book { id: string; name: string; bsbName?: string; chapters: number; testament: 'OT' | 'NT' }

export interface Verse { v: number; t: string }
export interface BibleBook { id: string; name: string; chapters: Verse[][] }

/** [original, transliteration, morph code, morph long, strongs, gloss, original-order index, punctuation] */
export type InterlinearWord = [string, string, string, string, string, string, number, string];
export interface InterlinearVerse { v: number; w: InterlinearWord[]; h?: string; f?: string[] }

export interface StrongsEntry { lemma: string; xlit?: string; pron?: string; derivation?: string; def: string; kjv?: string }

export type Xrefs = Record<string, [Ref, number][]>;

export interface Place {
  id: string; name: string; slug: string; types: string[]; lat: number; lon: number; description: string;
  confidence: { score: number | null; yes: number; likely: number; possible: number };
  verses: number; wikidata: string | null;
  /** Set when OpenBible only places it relative to somewhere else ("within 50 km of Haradah"), so the point is not a site. */
  approx?: string;
  image: { url: string; credit: string; creditUrl: string; license: string; description: string } | null;
}

/** Every claim in the curated content points at one or more of these. */
export type SourceKind = 'scripture' | 'archaeology' | 'primary' | 'scholarship' | 'lexicon' | 'image' | 'video' | 'data';
export interface Source {
  kind: SourceKind;
  /** Scripture reference (kind = scripture). */
  ref?: Ref;
  title?: string; author?: string; year?: string | number; url?: string; note?: string; license?: string;
}

/**
 * How firmly the claim rests on evidence — shown as a badge on every card.
 *  evidence        stated in the text or shown by physical evidence
 *  consensus       reconstructed, but broadly agreed among scholars
 *  interpretation  one reading among several (list the traditions that hold it)
 *  estimate        a guess or approximation — always say what it is based on
 */
export type Confidence = 'evidence' | 'consensus' | 'interpretation' | 'estimate';

export interface Media {
  type: 'image' | 'video' | 'model';
  src: string; caption: string; credit?: string; creditUrl?: string; license?: string;
}

export type InsightKind = 'money' | 'culture' | 'archaeology' | 'history' | 'geography' | 'word';
export interface Insight {
  id: string; title: string; kind: InsightKind; verses: Ref[]; summary: string; body: string[];
  sources: Source[]; traditions?: string[]; confidence: Confidence; media?: Media[]; related?: string[];
}

export interface Person {
  id: string; name: string; sex?: 'male' | 'female'; father?: string; mother?: string; spouses?: string[];
  /** Where two passages give different parents (e.g. Matthew 1 vs Luke 3), the other one goes here and is drawn dashed. */
  altParents?: { id: string; note: string }[];
  generation: number;
  /** Anno Mundi years summed straight from Genesis 5 / 11 (no gap assumptions). */
  bornAM?: number; diedAM?: number;
  /** BC/AD years (negative = BC) for people whose dates are anchored by external history. */
  born?: number; died?: number;
  /** True when any of the years above are approximations rather than figures stated in a source. */
  estimated?: boolean;
  refs: Ref[]; notes?: string; sources?: Source[];
}

export interface Prophecy { id: string; title: string; given: Ref; fulfilled: Ref[]; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
export interface Quote { id: string; quoting: Ref; quoted: Ref; summary: string; sources?: Source[] }
export interface Fragment { id: string; siglum: string; name: string; date: string; contents: Ref[]; held: string; summary: string; sources: Source[]; media?: Media[] }
export interface Writer { id: string; name: string; books: { book: string; refs?: Ref[] }[]; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
export interface Speaker { id: string; ref: Ref; speaker: string; summary?: string; sources?: Source[] }
export interface ChiasmLevel { label: string; ref: Ref; text: string }
export interface Chiasm { id: string; title: string; ref: Ref; levels: ChiasmLevel[]; centre: string; summary: string; sources: Source[]; confidence: Confidence }
export interface Ruler { id: string; name: string; realm: string; title: string; from: number; to: number; estimated?: boolean; refs: Ref[]; sources: Source[]; notes?: string; predecessor?: string }
/** One camp in an itinerary. Its position is OpenBible's identification of `place` unless `estimate` overrides it. */
export interface Station {
  verse: Ref; name: string; place?: string;
  /** Our own position: `at` when given, otherwise spaced evenly between the fixed stations either side. */
  estimate?: { at?: [number, number]; basis: string };
  /** Waypoints on the leg from the previous station, where geography rather than evidence decides the path. */
  via?: { points: [number, number][]; basis: string };
}
export interface Journey { id: string; title: string; ref: Ref; summary: string; stations: Station[]; sources: Source[]; confidence: Confidence }
export interface Model3D {
  id: string; title: string; verses: Ref[]; summary: string;
  kind: 'procedural' | 'gltf'; procedural?: 'denarius' | 'alabastron' | 'tetradrachm'; src?: string;
  dimensions?: string; sources: Source[]; media?: Media[]; confidence: Confidence;
}
export type VideoKind = 'overview' | 'series' | 'theme' | 'word' | 'insight' | 'commentary' | 'how-to-read' | 'podcast' | 'class' | 'short' | 'remix';
/**
 * A BibleProject video. `youtube` videos embed; `bibleproject` ones are only published on
 * bibleproject.com and open there. `page` is the bibleproject.com page when there is one.
 * `strongs` lists the Hebrew/Greek words a word study is about, for the Words panel.
 */
export interface Video {
  id: string; title: string; provider: 'youtube' | 'bibleproject'; videoId?: string; channel: string; url: string; page?: string;
  series: string; kind: VideoKind; books?: string[]; verses?: Ref[]; strongs?: string[]; summary?: string; duration?: number;
}
