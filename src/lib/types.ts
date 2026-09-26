import type { ProceduralKind } from './models';

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

/**
 * The lands round Jerusalem, for the size reference beside a model too big for a figure (public/data/map.json):
 * lines as flat [lon, lat, lon, lat, …] runs within `km` of `centre`, from Natural Earth, and cities from OpenBible.
 * `near` are places round Jerusalem, also from OpenBible, for a model a few kilometres across; each is named
 * only while the view spans `span` km (from, to), so names close together never crowd a wide view.
 */
export interface MapData {
  centre: [number, number]; km: number;
  coast: number[][]; rivers: number[][]; lakes: number[][];
  cities: { name: string; lon: number; lat: number }[];
  near?: { name: string; lon: number; lat: number; span: [number, number] }[];
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
/**
 * One member of a chiasm. `text` is its label; `quote` is the exact BSB wording it covers, which
 * lets the reader lay a phrase-level chiasm out in the verse itself. Passage-level chiasms, whose
 * levels are verse ranges, leave `quote` off.
 */
export interface ChiasmLevel { label: string; ref: Ref; text: string; quote?: string }
export interface Chiasm { id: string; title: string; ref: Ref; levels: ChiasmLevel[]; centre: string; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
/** One group in a tally: `quote` is the BSB's own words for its count, in the one verse `ref` names. */
export interface TallyRow { ref: Ref; label: string; count: number; quote: string }
/** A subtotal the text gives for some of the rows (a camp of three tribes): its verse, words and count, and the rows it sums. */
export interface TallyGroup extends TallyRow { members: string[] }
/**
 * Numbers the text lists one group after another (a census, a muster), drawn as bars on one scale that
 * fill as each verse is read. `total` is the text's own sum; the rows must add up to it unless
 * `discrepancy` says why they do not. `compare` names a tally of the same groups taken earlier (the
 * census of Numbers 1 for Numbers 26), whose figures are drawn behind each bar, matched by label.
 * `groups` are subtotals the text gives along the way, each stacked from its members under its verse.
 */
export interface Tally {
  id: string; title: string; ref: Ref; unit: string; summary: string; rows: TallyRow[];
  groups?: TallyGroup[]; total?: TallyRow; discrepancy?: string; compare?: string;
  sources: Source[]; traditions?: string[]; confidence: Confidence;
}
export interface Ruler { id: string; name: string; realm: string; title: string; from: number; to: number; estimated?: boolean; refs: Ref[]; sources: Source[]; notes?: string; predecessor?: string }
/** One camp in an itinerary. Its position is OpenBible's identification of `place` unless `estimate` overrides it. */
export interface Station {
  verse: Ref; name: string; place?: string;
  /** Starts a named stretch ("Southern border"); later stations inherit it. */
  segment?: string;
  /** Our own position: `at` when given, otherwise spaced evenly between the fixed stations either side. */
  estimate?: { at?: [number, number]; basis: string };
  /** Waypoints on the leg from the previous station, where geography rather than evidence decides the path. */
  via?: { points: [number, number][]; basis: string };
}
/** An ordered set of points drawn as the text names them: a journey's camps, or a boundary (`kind: 'border'`, `closed` once complete). */
export interface Journey {
  id: string; title: string; ref: Ref; summary: string; stations: Station[]; sources: Source[]; confidence: Confidence;
  kind?: 'route' | 'border'; closed?: boolean;
}
/**
 * Where the camera looks from while a build or a later state is being read: [azimuth, elevation] in
 * degrees, azimuth measured from the model's front (+z) round towards +x, elevation above level.
 */
export type ModelAngle = [number, number];
/**
 * One step of a build: the verse, and the named parts of the model it adds. `basis` is a note on
 * this account's step; what an estimated part rests on belongs in the model's `estimates`. `view`
 * turns the camera for this step, to show a part the model's own view would hide. `cutaway` cuts
 * open the parts the model flags `cutaway: 'step'` while this step is read, for a part put on under
 * them (the high priest's undergarments, under the tunic and robe). The part a step adds is never cut,
 * unless `cuts` names it: a lining added with what it would hide (the temple's gold and its chains).
 * `frame` names what the camera frames instead of what the step adds, drawn yet or not: a part too big
 * to see whole at the scale the text is working at (the New Jerusalem's wall, framed at one gate).
 */
export interface ModelStep { ref: Ref; parts: string[]; basis?: string; view?: ModelAngle; cutaway?: boolean; cuts?: string[]; frame?: string[] }
/**
 * A passage that describes the model piece by piece; while reading it, only the parts reached so
 * far are shown. `omits` names parts this account never adds, and why; every other part must be
 * shown by the last step.
 */
export interface ModelBuild { ref: Ref; steps: ModelStep[]; omits?: Record<string, string> }
/**
 * How long one of the model's units is, in metres, and whether they are cubits or Ezekiel's long
 * cubits of a cubit and a handbreadth (the scale bar is then marked in them). `at` is where the size figure or hand stands, in model units, on the
 * ground; without it the figure stands beside the model. `worn` says the figure wears the model (the
 * high priest's garments): it stays at `at` through a build, and the camera frames the parts being
 * added rather than the whole figure. `map` brings the map in for a model smaller than the New Jerusalem:
 * from `from` metres across (the framed box), with the place named `on` (one of the map's places) at `at`
 * (default the origin) rather than Jerusalem under the box's middle.
 */
export interface ModelScale {
  metres: number; unit?: 'cubit' | 'long cubit'; at?: [number, number, number]; worn?: boolean;
  map?: { from: number; on?: string; at?: [number, number, number] };
}
/** One verse's change to a built model: the parts it removes and the alternates it adds. */
export interface ModelChange { ref: Ref; hides?: string[]; shows?: string[]; view?: ModelAngle }
/** One passage's account of a later state, its changes in reading order (as a build's steps). */
export interface ModelStateAccount { ref: Ref; changes: ModelChange[] }
/**
 * A later state of the model, when the text changes what was built. States are listed in the order
 * they happen and accumulate, so a state includes every change before it. A state may be told in
 * more than one passage (Kings, Jeremiah, Chronicles); while reading one, its changes happen verse
 * by verse, and anywhere else the reader can pick the state whole. A part a change shows is an
 * alternate: it is never drawn as built, and no build adds it. `basis` says what the state rests on.
 */
export interface ModelState { id: string; label: string; basis: string; accounts: ModelStateAccount[] }
/**
 * One way of reading a model's text, when the text allows more than one (the New Jerusalem's wall as the
 * city's face, or as a wall at its foot). The first is the default; the viewer offers the others with a
 * button each. The builder draws each under the same part names, so the model's builds serve all of them.
 * `estimates` adds to, or replaces, the model's own for this reading.
 */
export interface ModelReading { id: string; label: string; basis: string; traditions?: string[]; estimates?: Record<string, string> }
export interface Model3D {
  id: string; title: string; verses: Ref[]; summary: string;
  kind: 'procedural' | 'gltf'; procedural?: ProceduralKind; src?: string;
  dimensions?: string; sources: Source[]; media?: Media[]; confidence: Confidence;
  /** Who holds the reading, when `confidence` is 'interpretation' (what Ezekiel's temple is, say). */
  traditions?: string[];
  scale?: ModelScale;
  /** The camera's angle while a build or state is being read (see `modelViewAt`); elsewhere the model turns. */
  view?: ModelAngle;
  builds?: ModelBuild[];
  states?: ModelState[];
  /** What each estimated part rests on, keyed by part name; shown with every step that adds the part, and listed under the model. */
  estimates?: Record<string, string>;
  readings?: ModelReading[];
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
