import type { ProceduralKind } from './models';

/** OSIS-style reference: "Matt.1.1", a range "Matt.1.1-Matt.1.5", or a chapter "Matt.1". */
export type Ref = string;

export interface Book { id: string; name: string; bsbName?: string; chapters: number; testament: 'OT' | 'NT'; beyond?: Beyond }

/** The churches that read a book outside the 66 as scripture (content/canons.json), and whose translation the reader shows. */
export type CanonId = 'catholic' | 'orthodox' | 'ethiopian' | 'anglican';
export interface Beyond { canons: CanonId[]; text: string; note?: string }
export interface ChurchCanon { id: CanonId; name: string; summary: string; sources: Source[] }
export interface TextSource { id: string; name: string; license: string; url: string; summary: string }

/** A verse; `l` labels one that stands for several ("15-16"), and `h` and `f` are a book beyond the 66's heading above it and footnotes (the BSB's are in the interlinear). */
export interface Verse { v: number; t: string; l?: string; h?: string; f?: string[] }
/** `intro` is what a book beyond the 66 prints before chapter 1: Sirach's prologue, its translator's notes. */
export interface BibleBook { id: string; name: string; chapters: Verse[][]; intro?: string[] }

/** [original, transliteration, morph code, morph long, strongs, gloss, original-order index, punctuation] */
/**
 * [original, transliteration, morphology code, morphology long, Strong's, BSB gloss, original-order index, punctuation,
 * the gloss's place among the word's renderings (`StrongsEntry.r`; -1 where the BSB gives it no English of its own),
 * 1 on a noun or adjective the BSB renders here in a way it rarely does elsewhere].
 */
/**
 * [original, transliteration, morphology code, morphology long, Strong's, gloss, original-order index, punctuation,
 * rendering's index among the word's renderings, 1 on a rare rendering (0 when only a person follows),
 * the id of the person a name names (TIPNR's Strong's number for them)].
 */
export type InterlinearWord = [string, string, string, string, string, string, number, string, number?, (0 | 1)?, string?];
export interface InterlinearVerse { v: number; w: InterlinearWord[]; h?: string; f?: string[] }

export interface StrongsEntry {
  lemma: string; xlit?: string; pron?: string; derivation?: string; def: string; kjv?: string;
  /** How the BSB renders the word across the Bible, commonest first, as [rendering, uses]. */
  r?: [string, number][];
  /** Its uses in all, and how many of them the BSB gives no English of their own (carried by the words round it). */
  n?: number; bare?: number;
}

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
  /** The passage cited: always for scripture, and for a primary text the reader holds (1 Enoch, the Maccabees). */
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

export type InsightKind = 'money' | 'culture' | 'archaeology' | 'history' | 'geography' | 'medicine' | 'word';
export interface Insight {
  id: string; title: string; kind: InsightKind; verses: Ref[]; summary: string; body: string[];
  sources: Source[]; traditions?: string[]; confidence: Confidence; media?: Media[]; related?: string[];
  /** A word card's Strong's numbers, when it studies more than the one its id is named for (`word-h7307-…`). */
  strongs?: string[];
  /**
   * Where the English is narrower than the word: the BSB renderings that narrow it ("earth", not "land"), in the
   * singular, and what the word covers. The reader marks the word wherever the BSB renders it so, not only in the
   * card's verses.
   */
  narrows?: {
    rendered: string[]; means: string;
    /**
     * Mark only some uses of a common word: where it is a command ("Hear, O Israel"), or where the next word in
     * the original is this Strong's number carrying a preposition (shāmaʿ before "to the voice of", H6963: obey).
     * Either one marks it.
     */
    only?: { command?: boolean; before?: string };
  };
}

export interface Person {
  id: string; name: string;
  /** Their id in the generated people data (TIPNR's Strong's number for them), for the few the text leaves unnamed none. */
  tipnr?: string;
  sex?: 'male' | 'female'; father?: string; mother?: string; spouses?: string[];
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

/**
 * One of a named person's kin, as TIPNR gives them: an id to open (none for someone the text leaves unnamed,
 * "husband of Zeruiah") and a name to show. `uncertain` is TIPNR's own "(?)": its reading of a passage that could
 * be read another way.
 */
export interface Kin { id?: string; name: string; uncertain?: true }
/**
 * Someone the Bible names, from STEPBible's TIPNR (public/data/people/): their id is TIPNR's Strong's number for
 * them ("H0175", Aaron), with the verses naming them, their kin, and their Easton's Bible Dictionary entry (from
 * Theographic), whose verse links are written `[[Judg.4.6|Judg. 4:6]]`. `title` tells namesakes apart by their
 * kin ("son of Jesse").
 */
export interface BiblePerson {
  id: string; name: string; title?: string; sex: 'male' | 'female'; also?: string[];
  father?: Kin[]; mother?: Kin[]; spouses?: Kin[]; children?: Kin[]; siblings?: Kin[];
  refs: Ref[]; easton?: string[];
}
/** Who each verse of a book names ("ch.v" → ids), and each one's [name, title, 'm' | 'f']. */
/** One speaker of a verse, from Glyssen: the name it casts them by, their TIPNR id, how the words come (`alt`: one
 *  reading of who speaks; `quoted`: their words quoted by another) and the delivery it marks ("praying"). */
export interface VerseSpeaker { n: string; p?: string; k?: 'alt' | 'quoted'; d?: string }
/** speakers/<Book>.json: "ch.v" → who speaks the verse. */
export type SpeakersInBook = Record<string, VerseSpeaker[]>;
export interface PeopleInBook { verses: Record<string, string[]>; people: Record<string, [string, string, 'm' | 'f']> }
/**
 * A family link: `parent`, `alt` (the curated tree's other parentage, Matthew 1 against Luke 3), `uncertain`
 * (TIPNR's "(?)"), `differs` (TIPNR reading a curated person's parent otherwise), `spouse`; the note says so on hover.
 */
export type FamilyEdge = [string, string, 'parent' | 'alt' | 'uncertain' | 'differs' | 'spouse', string?];
/**
 * A family (people/families.json, laid out at build time by scripts/families.mjs): each person as [id (their TIPNR
 * id, or the curated id of someone the text leaves unnamed), name, 'm' | 'f', x, y, their curated id when it differs].
 */
export interface Family { n: [string, string, 'm' | 'f', number, number, string?][]; e: FamilyEdge[] }
/** A moment in a curated profile: a verse and what happens there, in our words. */
export interface ProfileMoment { ref: Ref; text: string }
/** What a later tradition, a find or a reading adds to the text, with its own confidence and sources. */
export interface ProfileNote { text: string; confidence: Confidence; traditions?: string[]; sources: Source[] }
/**
 * A hand-written profile of someone the Bible names (content/profiles/<id>.json). `people` are the TIPNR ids of
 * the generated people it covers, the first the main one (more than one for a group, such as Job's three friends);
 * `genealogy` is their id in people.json when the family tree has them. The body keeps to what the text
 * says; `later` holds what tradition, archaeology or scholarship adds, each with its own badge. `when`
 * is always ≈ and `whenBasis` says what it rests on. A picture, where a fitting one exists, is a depiction, credited in `media`.
 */
/** What the lists and the index show of a profile (`?index`, scripts/vite-profile-index.mjs); the rest loads when it is opened. */
export type ProfileIndex = Pick<Profile, 'id' | 'name' | 'role' | 'people' | 'genealogy'> & { moments: { ref: Ref }[]; thumb?: string };
export interface Profile {
  id: string; name: string; role: string; people: string[]; genealogy?: string;
  when?: string; whenBasis?: string;
  summary: string; body: string[]; moments: ProfileMoment[]; later?: ProfileNote[];
  confidence: Confidence; traditions?: string[]; sources: Source[]; media?: Media[];
  /** Set when the Easton's entry matched to this person is the wrong one (Lot to the lots that were cast): what the entry is about instead. */
  eastonWrong?: string;
}
/**
 * One place a prophecy is fulfilled: `ref` is where the text says so (Matthew's "to fulfill what was spoken"),
 * `event` the passage telling what happened, when that is somewhere else (the birth, Matt 1:18-25).
 */
export interface Fulfilment { ref: Ref; event?: Ref }
export interface Prophecy { id: string; title: string; foretold: Ref; fulfilled: Fulfilment[]; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
/** `allusion` marks an echo rather than a quotation: a phrase or an image taken up, not words cited. */
export interface Quote { id: string; quoting: Ref; quoted: Ref; summary: string; sources?: Source[]; allusion?: true }
export interface Fragment { id: string; siglum: string; name: string; date: string; contents: Ref[]; held: string; summary: string; sources: Source[]; media?: Media[] }
/** Who wrote a book, or the chapters `refs` name (the Psalms, by their headings). `person` is the TIPNR id the
 *  People tab links to; `heading` is the words a psalm's heading names them by, checked against the BSB. */
export interface Writer { id: string; name: string; person?: string; heading?: string; books: { book: string; refs?: Ref[] }[]; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
/** Who speaks a passage; `person` is their TIPNR id, absent for a speaker the people data has no entry for (God, an angel, a crowd). */
export interface Speaker { id: string; ref: Ref; speaker: string; person?: string; summary?: string; sources?: Source[] }
/**
 * One member of a chiasm. `text` is its label; `quote` is the exact BSB wording it covers, which
 * lets the reader lay a phrase-level chiasm out in the verse itself. Passage-level chiasms, whose
 * levels are verse ranges, leave `quote` off.
 */
export interface ChiasmLevel { label: string; ref: Ref; text: string; quote?: string }
export interface Chiasm { id: string; title: string; ref: Ref; levels: ChiasmLevel[]; centre: string; summary: string; sources: Source[]; traditions?: string[]; confidence: Confidence }
/**
 * One group in a tally: `quote` is the BSB's own words for its count, in the one verse `ref` names.
 * `same` is the label of this group in the compared tally, when the two lists name it differently
 * (Nehemiah's Hariph, Ezra's Jorah).
 */
export interface TallyRow { ref: Ref; label: string; count: number; quote: string; same?: string }
/** A subtotal the text gives for some of the rows (a camp of three tribes): its verse, words and count, and the rows it sums. */
export interface TallyGroup extends TallyRow { members: string[] }
/**
 * Numbers the text lists one group after another (a census, a muster), drawn as bars on one scale that
 * fill as each verse is read. `total` is the text's own sum; the rows must add up to it unless
 * `discrepancy` says why they do not. `compare` names a tally of the same groups taken earlier (the
 * census of Numbers 1 for Numbers 26), whose figures are drawn behind each bar, matched by label; `alone`
 * names the groups, in either list, that the other does not have.
 * `groups` are subtotals the text gives along the way, each stacked from its members under its verse.
 */
export interface Tally {
  id: string; title: string; ref: Ref; unit: string; summary: string; rows: TallyRow[];
  groups?: TallyGroup[]; total?: TallyRow; discrepancy?: string; compare?: string; alone?: string[];
  sources: Source[]; traditions?: string[]; confidence: Confidence;
}
/** A sum of money in a price: the BSB's words for it in its verse (`ref`, the price's own verse unless given), and `gold` for a weight of gold, reckoned in silver. */
export interface PriceSum { quote: string; n: number; unit: string; gold?: true; ref?: Ref }
/** Something given in kind (livestock, years of work), valued by `content/prices.json`'s `goods`. */
export interface PriceGood { quote: string; n: number; good: string; ref?: Ref }
export type PriceKind = 'wage' | 'purchase' | 'gift' | 'offering' | 'valuation' | 'tribute' | 'debt' | 'bribe' | 'treasure';
/**
 * A sum the text names, drawn under `ref` and under each verse in `also` that names it again. `sums` and `goods`
 * add up to its worth in days of a labourer's wage, reckoned in the money of its `era` (by default, its book's).
 * `uncounted` is what was also given that nothing here can price; `estimate` says what the reading of the sum
 * itself rests on, when the text does not name its unit.
 *
 * Context, each only where the text or a cited source gives the second number: `per`, how many shared the sum
 * (the text's own count, quoted from its verse, and `who` they were); `every`, a sum paid each day or year, and
 * `times`, how many times the text says it was paid; `compare`, a whole the sum is measured against, in a unit of
 * its era, with the source that gives it.
 */
export interface Price {
  id: string; ref: Ref; also?: Ref[]; kind: PriceKind; what: string; era?: string;
  sums?: PriceSum[]; goods?: PriceGood[]; uncounted?: string; estimate?: string; note?: string; insight?: string;
  per?: { n: number; quote: string; ref: Ref; who: string };
  every?: 'day' | 'year';
  times?: { n: number; quote: string; ref: Ref };
  compare?: { n: number; unit: string; what: string; source: Source };
}
/** A unit of money in one era: what it is worth in the era's `base` unit, and what that rests on. `coin` marks a gold coin valued as it is, not by weight. */
export interface MoneyUnit { id: string; name: string; plural: string; value: number; coin?: true; estimated?: true; basis: string }
/** A stretch of the Bible's history with its own money and its own day's wage: one `base` unit buys `days` days of work. */
export interface MoneyEra { id: string; label: string; base: string; days: number; basis: string; books?: string[]; units: MoneyUnit[]; sources: Source[] }
export interface PriceGoodKind { id: string; name: string; days: number; basis: string }
/** `content/prices.json`: every sum the text names, and the yardstick it is measured with. */
export interface Worth {
  id: string; title: string; confidence: Confidence; summary: string;
  /** Hours in a working day, and working days in a year. */
  hours: number; year: number; yardstick: { hours: string; year: string };
  gold: { ratio: number; basis: string };
  eras: MoneyEra[]; goods: PriceGoodKind[]; goodsSources: Source[];
  kinds: { id: PriceKind; label: string }[];
  sources: Source[]; prices: Price[];
  /** Verses that name money without a sum that can be priced, and why. */
  unpriced: { why: string; refs: Ref[] }[];
}
export interface Ruler { id: string; name: string; realm: string; title: string; from: number; to: number; estimated?: boolean; refs: Ref[]; sources: Source[]; notes?: string; predecessor?: string; reign?: Reign }
export type Kingdom = 'israel' | 'judah';
/**
 * What a book says of a king: `right` or `evil`, in the BSB's own words at `ref`, with `but` the
 * qualification it adds (the high places not removed), or no verdict at all (`none`, saying so in `note`).
 */
export interface Verdict { kind: 'right' | 'evil' | 'none'; ref?: Ref; quote?: string; but?: { ref: Ref; quote: string }; note?: string }
/**
 * A king of the divided kingdoms as Kings tells his reign. `ref` is where the reader draws the chart (his
 * accession, or the reign formula), and `chronicles.ref` the same in Chronicles, with Chronicles' own verdict.
 * `length` and `synchronism` quote the text ("twenty-two years", Asa's "thirty-eighth year"). `overlap` is a
 * coregency or rival reign in the reconstruction, from the ruler's `from` to `until`, saying what it rests on.
 */
export interface Reign {
  kingdom: Kingdom; ref: Ref;
  length: { ref: Ref; quote: string; years: number };
  synchronism?: { king: string; year: number; ref: Ref; quote: string };
  verdict: Verdict;
  chronicles?: { ref: Ref; verdict: Verdict };
  overlap?: { until: number; kind: 'coregency' | 'rival'; with: string; basis: string };
  dynasty?: string; note?: string; discrepancy?: string;
}
/** How a kingdom counted its kings' years over a span: whether a king's first part-year was his year one, and the month its year began. */
export interface Reckoning { kingdom: Kingdom; from: number; to: number; method: 'accession' | 'non-accession'; year: 'Nisan' | 'Tishri'; basis: string }
/** A year fixed outside the Bible (an Assyrian or Babylonian record) that names or dates one of the kings. */
export interface MonarchyAnchor { id: string; year: number; label: string; kings: string[]; ref?: Ref; estimated?: boolean; note: string; sources: Source[] }
/**
 * A prophet the text sets in named reigns; `from`–`to` are the years that puts him in, and `basis` says how.
 * `sentTo` is the kingdom he spoke to, shown by the verse `sent` (one of his `refs`); `both` is drawn with
 * Judah. `origin` is where he came from, when that is not the kingdom he spoke to (Amos, from Tekoa).
 */
export interface MonarchyProphet {
  id: string; name: string; from: number; to: number; kings: string[]; sentTo: Kingdom | 'both'; sent: Ref; origin?: string;
  refs: Ref[]; basis: string; note?: string;
}
/** One king's years in a reading: `from`–`to`, and an `overlap` with another's reign where the reading has one. */
export interface ReadingDates { from: number; to: number; overlap?: Reign['overlap'] }
/**
 * A reconstruction of the kings' dates. The first is Thiele's, whose dates are the rulers' own `from`–`to`;
 * the others give `dates` for every king, and say in `basis` how they differ.
 */
export interface MonarchyReading { id: string; label: string; basis: string; dates?: Record<string, ReadingDates>; notes?: Record<string, string>; sources: Source[] }
/**
 * The chart of the divided kingdoms drawn under each king's accession: `kings` and `chronicles` are the
 * passages it is drawn in, `from` the division, `stated` what the stated-lengths view shows.
 */
export interface Monarchy {
  id: string; title: string; kings: Ref; chronicles: Ref; from: number; summary: string; stated: string;
  reckoning: Reckoning[]; anchors: MonarchyAnchor[]; prophets: MonarchyProphet[]; readings: MonarchyReading[];
  sources: Source[]; traditions?: string[]; confidence: Confidence;
}
/**
 * A moment of the three days: `day` counts civil days from the crucifixion's (0; −1 is the evening before),
 * or 'sunday' for the first day of the week, whatever the reading; `hour` is on the clock (a negative hour
 * on 'sunday' is Saturday evening). `basis` says what it rests on.
 */
export interface PassionTime { day: number | 'sunday'; hour: number; basis?: string }
/** A verse of an account that says when something happened, in its own words (`quote`), drawn as a pin; `until` ends a span that day. */
export interface PassionEvent { ref: Ref; label: string; quote: string; at: PassionTime; until?: number; basis: string }
/** A saying about the three days ("on the third day"), where the chart is drawn whole. */
export interface PassionSaying { ref: Ref; quote: string }
/**
 * A reading of the weekday: `weekday` of the crucifixion (0 Sunday … 6 Saturday), `high` the day after it
 * that is John's High Sabbath, when the resurrection fell (`rose`, a range when the text leaves it open),
 * how it counts 'the third day' and 'three nights', and `moves` for an event it places elsewhere, by ref.
 */
export interface PassionReading {
  id: string; label: string; weekday: number; high: number;
  rose: { from: PassionTime; to: PassionTime; basis: string };
  basis: string; thirdDay: string; nights: string;
  moves?: Record<Ref, PassionTime>;
  sources: Source[]; traditions: string[]; confidence: Confidence;
}
/** The days from the Last Supper to the empty tomb, drawn under each verse that dates them, in each gospel. */
export interface Passion {
  id: string; title: string; summary: string; clock: string;
  died: PassionTime; buried: PassionTime;
  sayings: PassionSaying[];
  accounts: { id: string; label: string; ref: Ref; events: PassionEvent[] }[];
  readings: PassionReading[];
  sources: Source[]; confidence: Confidence;
}
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
 * `summaryFrom` marks a summary quoted word for word from BibleProject's own description, and
 * where; the card shows it as theirs. A summary without it is this project's, and says only
 * what the video covers.
 */
export interface Video {
  id: string; title: string; provider: 'youtube' | 'bibleproject'; videoId?: string; channel: string; url: string; page?: string;
  series: string; kind: VideoKind; books?: string[]; verses?: Ref[]; strongs?: string[]; summary?: string; summaryFrom?: 'youtube' | 'bibleproject.com'; duration?: number;
}

/**
 * One of the Hebrew Bible's twenty-four books (content/scrolls.json), in the Talmud's order (Bava Batra 14b), and the
 * English books it covers. `kind` is set when it covers more than one: `book` for one book the Greek split (Samuel),
 * `scroll` for separate books copied on one scroll with `gap` blank lines between them (the Torah, the Twelve).
 */
export interface HebrewBook {
  id: string; name: string; part: 'Torah' | 'Prophets' | 'Writings'; books: string[];
  kind?: 'book' | 'scroll'; gap?: number; summary?: string; sources?: Source[];
}
/** The same words at the end of one book and the start of another (Cyrus's decree), and what is made of it. */
export interface ScrollOverlap { id: string; a: Ref; b: Ref; summary: string; confidence: Confidence; traditions?: string[]; sources: Source[] }
/** When chapters and verse numbers were added. */
export interface Numbering { id: string; label: string; when: string; summary: string; confidence: Confidence; sources: Source[] }
export interface Scrolls {
  id: string; title: string; summary: string; confidence: Confidence; sources: Source[];
  hebrew: HebrewBook[];
  /** The Greek names of the books the Greek split, where they differ from the English. */
  greek: Record<string, string>;
  overlaps: ScrollOverlap[]; numbering: Numbering[];
}

/** A body the sky computes: a planet, the Sun or the Moon (astronomy-engine's names), or a star the sky names ("Regulus"). */
export type SkyBody = string;
/**
 * A claim an event makes about the sky that the test suite checks against astronomy-engine: two bodies closest on a
 * day (`conjunction`), or a planet turning between direct and retrograde (`station`, in ecliptic longitude), within
 * `within` days of `on`; or the Moon covering a body, seen from the event's place, on the local date `on`
 * (`occultation`).
 */
export type SkyCheck =
  | { kind: 'conjunction'; a: SkyBody; b: SkyBody; on: string; within: number }
  | { kind: 'station'; body: SkyBody; on: string; within: number }
  | { kind: 'occultation'; body: SkyBody; on: string };
/**
 * One moment of a reading's sky, shown at the verse `ref`. `when` is the local mean time at `place` (an OpenBible
 * slug), in the Julian calendar with astronomical years ("-0001-12-25T05:15" is 25 December 2 BC). `look` is what
 * the view centres on, a body or [azimuth, altitude] in degrees, and `fov` how wide it is. `track` draws a body's
 * path among the stars day by day (and the bodies in `with` beside it), with `marks` labelled; `toward` marks on the
 * horizon the direction of another place. `dark` draws the stars as though the sky were dark, for a moment the
 * reading holds was reckoned rather than seen (an occultation at noon). A time the reading does not give is
 * `estimated`, and `basis` says why that hour or day.
 */
export interface SkyEvent {
  id: string; ref: Ref; title: string; when: string; place: string;
  look: SkyBody | [number, number]; fov?: number;
  /** Bodies labelled besides the planets and named stars. */
  label?: SkyBody[];
  track?: { body: SkyBody; with?: SkyBody[]; from: string; to: string; every?: number; marks?: { on: string; text: string }[] };
  toward?: string; dark?: boolean;
  estimated?: boolean; basis?: string;
  /** What the reading says of this moment, attributed. */
  text: string;
  checks?: SkyCheck[];
  sources: Source[];
}
/**
 * A reading of the star of the Magi: who holds it, what they argue (`body`), and the moments of its sky. Every one is
 * an interpretation. A reading no sky can show (a miracle) has no `events`.
 */
export interface SkyReading {
  id: string; label: string; summary: string; body?: string[];
  confidence: Confidence; traditions: string[];
  sources: Source[];
  events: SkyEvent[];
}
/** `public/data/sky.json`: stars as [ra, dec, V mag, B−V, pmRA, pmDec] (J2000, degrees and mas/yr), names by star index, constellation lines as runs of star indices, and where each constellation's name goes. */
export interface SkyData {
  stars: [number, number, number, number, number, number][];
  names: Record<string, string>;
  lines: Record<string, number[][]>;
  labels: [string, number, number][];
}
