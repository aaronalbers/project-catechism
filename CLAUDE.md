# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install
npm run data:fetch   # download source datasets into .cache/ (~80 MB, once)
npm run data         # build public/data/ from .cache/ (~70 MB, gitignored)
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # static site into dist/
```

`npm run dev` needs `public/data/` to exist — run `data:fetch` then `data` first, or the
reader loads no text. Both are idempotent; `data:fetch` skips files already in `.cache/`.

Run a single test file or case:

```sh
npx vitest run src/__tests__/content.test.ts
npx vitest run -t 'no claim is cited to Wikipedia'
```

CI (`.github/workflows/deploy.yml`) runs data:fetch → data → typecheck → test → build on
every push to `master`, then deploys to GitHub Pages. The build needs
`GITHUB_PAGES_BASE=/<repo>/` when not served from a domain root; locally the base is `/`.

## Architecture

### Two tiers of data, and the distinction matters

**Curated content** (`content/*.json`) is hand-written, cited, versioned in git, and
**bundled into the JS at build time**. `src/lib/content.ts` imports it — insight cards via
`import.meta.glob('@content/insights/*.json')`, everything else by direct import — and
exposes `xFor(loc)` / `xInChapter(book, ch)` lookup helpers. A new file in
`content/insights/` is picked up by the glob with no registration step; a new top-level
`content/*.json` needs an import and an exported constant.

`src/lib/catalog.ts` derives the index (`#/index`) and the chapter picker's dots from the
same content, for the features only some passages have. New entries appear on their own; a
new *kind* of sparse content needs a section in `CATALOG`.

**Generated data** (`public/data/`) is built by `scripts/build-data.mjs` from public-domain
sources, is gitignored, and is **fetched lazily at runtime** through `src/lib/data.ts`
(which memoises promises per path). It is sharded so a chapter costs one or two small
requests: `bible/<Book>.json`, `interlinear/<Book>/<ch>.json`, `strongs/<H|G>/<shard>.json`
(100 entries each), `xrefs/<Book>.json`, `places/by-book/<Book>.json`, `people/by-book/<Book>.json` and `people/<H|G>/<n>.json` (everyone the Bible names, from STEPBible's TIPNR, keyed by its Strong's number for them, with their Easton's entry), and `map.json` (Natural Earth coasts, rivers and
lakes round Jerusalem, for the models' map scale). The books beyond the 66 get `bible/<Book>.json` too, built by
`scripts/beyond.mjs` from the World English Bible's deuterocanon (USFM) and R. H. Charles's 1 Enoch and Jubilees
(CrossWire's SWORD genbook modules), with `parallels.json` (Charles's cross references from 1 Enoch to the 66) and
their verse counts in `circle.json`'s `beyond`.

Never commit anything under `public/data/` or `.cache/`, and never hand-edit files there —
regenerate with `npm run data`.

### One location drives the whole UI

`src/app/store.ts` is a ~50-line `useSyncExternalStore` — no Redux, no context. The single
field that matters is `loc: { book, chapter, verse }`. Every panel re-derives its contents
from `loc`; nothing else coordinates them. `loc` is mirrored to the URL hash
(`#/Matt/5/3`) and to localStorage, and `hashchange` feeds back in, so a URL is a complete
description of app state. Navigate with `goTo(loc, { openTab })` rather than setting state
directly.

`src/lib/reader.ts` is the reason for that design: verse-by-verse audio playback advances
`loc` as it reads, so pressing play makes every panel follow along. It holds its own small
store for playback settings and calls into `src/lib/tts.ts`, which puts two engines behind
one `Engine` interface — the Web Speech API, the default, which needs no download, and Kokoro
(neural, runs in a Web Worker, fp32/WebGPU ≈330 MB or q8/WASM ≈90 MB, user's choice), which
is slower to start. If Kokoro fails to load, playback falls back to the browser's voice.

### Books beyond the 66

`content/books.json` sets the books some churches read beyond the 66 (Tobit to Jubilees) between Malachi and
Matthew, each with `beyond`: the churches that read it (`canons`, described with their own statements in
`content/canons.json`), whose translation it is (`text`), and a `note` on anything odd about its numbering. `BOOKS`
keeps that order (the picker and the circle); `THE_66` and `BEYOND` split it; `READING_ORDER` puts the 66 first, so a
range from Malachi to Matthew takes in none of them; `neighbourBook` keeps chapter navigation and continuous audio
within one group. They have no interlinear, Strong's, OpenBible cross references, people or places, and each panel
says so rather than showing nothing. Jubilees' verse numbers are CrossWire's editor's, not Charles's (its `note`
says where they drift), so do not cite a Jubilees verse without checking it against Charles's 1913 printing.

### References are strings, parsed everywhere

An OSIS-ish `Ref` is `"Matt.1.1"`, a range `"Matt.5.29-30"` or `"2Kgs.18.13-19.37"`, or a
whole chapter `"Matt.1"`. `src/lib/refs.ts` owns parsing (`parseRef`), display
(`formatRef`), and the two containment predicates the panels rely on: `contains(ref, loc)`
and `touchesChapter(ref, book, ch)`. Book ids come from `content/books.json`; `refs.ts` also
maps common abbreviations onto them. Any ref appearing in content must parse — the test
suite enforces it.

### Panels

`src/components/ContextPanel.tsx` owns the tab strips and shows per-tab counts derived from
`loc`. On a wide screen the panel holds as many panes as fit (`layout` in the store; the rules are
pure functions in `src/lib/panes.ts`), stacked or side by side, resized by grips, each showing one
tab, so never more panes than tabs; a narrow screen shows only the pane in use. When a window holds
fewer panes than the layout has, the ones used least recently are hidden, not closed. A tab is in at
most one pane. Ask for a tab with
`openTab(tab)` or `goTo(loc, { openTab })`, never by setting state: it brings forward the pane
already showing it, or replaces the pane used least recently. The layout lives in localStorage,
not the URL. Places, People and Models are `lazy()` imports so Leaflet, the graph library and
three.js only download when their tab is opened — keep them that way, and keep new heavy
dependencies behind the same boundary.

## Content conventions

These are the project's reason for existing, and `src/__tests__/content.test.ts` enforces
them in CI — read it before adding content.

- Every insight needs `verses`, a `confidence` badge, and at least one source of an
  **evidential** kind: `scripture`, `archaeology`, `primary`, `lexicon` or `data`. A
  `scholarship` citation alone does **not** satisfy the check.
- `confidence: 'interpretation'` requires a non-empty `traditions` array naming who holds
  the reading.
- Anything approximate is marked — `estimate` confidence, `estimated: true`, or a leading
  `≈` — and the card says what the approximation rests on. A derived figure (a calendar
  conversion, a capacity inferred from dimensions) says so in the body.
- **Never cite Wikipedia.** Use it as a finding aid if you like, then trace the claim to the
  museum, primary text or publication and cite that. A test fails the build on any
  `sources[].url` pointing at a `wikipedia.org` host. Wikisource (public-domain primary
  texts) and Wikimedia Commons image credits in `media[]` are fine — the CC licences require
  the latter.
- Verify media URLs with `curl` before adding them, and take image licence and photographer
  from the Commons API rather than guessing. Wikimedia serves a limited set of thumbnail
  widths; 500px is what existing cards use.
- `related` ids must resolve to an existing insight, and links read better added in both
  directions.

- A prophecy (`content/prophecies.json`) runs from where it is `foretold` to each of its `fulfilled`: `ref` is where
  the text says it is fulfilled ("to fulfill what was spoken"), and `event` the passage telling what happened, when
  that is told apart from the note (the birth, Matt 1:18-25, noted at 1:22-23). A claim the text makes without
  narrating the event (Acts 4:11 on the rejected stone) has no `event`. The reader marks a foretelling with a ring
  and a fulfilment with a dot, the card and the link circle draw the same direction, and each `event` is checked
  against the BSB wording before it is added.

- A quote (`content/quotes.json`) marked `allusion` is an echo, not a quotation, and reads "echoes" / "echoed in";
  it cites who records the parallel (the Nestle–Aland index). Links between the 66 and the books beyond them are
  curated here, from that index, each checked against the WEB or Charles numbering of the verse.

- Word cards (`kind: 'word'`) are named for their Strong's number (`word-h5775-oph`), or list several in
  `strongs`. `narrows` marks a word the English is narrower than: `rendered` names the BSB renderings that
  narrow it, in the singular ("earth", not "land"), and `means` says what the word covers. The reader
  underlines the word wherever the BSB renders it so, in every verse, and the Words tab says why. For a very
  common word, `only` limits the marks to commands (`command`) and/or uses followed in the original by
  a word with a preposition (`before`: shāmaʿ before "to the voice of", H6963, the idiom for obey). Only one
  card may narrow a Strong's number, and a test fails the build if a `rendered` is not one of the BSB's
  renderings of the word. Cite a public-domain lexicon: BDB on Sefaria for Hebrew, Thayer for Greek. The
  Words tab links BibleProject videos by the `strongs` in `videos.json`, and the card links them too.
- The data build counts how the BSB renders every Strong's number (`scripts/renderings.mjs`, shared with the
  app through `renderings.d.mts`). Each Strong's entry gets `r`, `n` and `bare`, and each interlinear word
  gets its rendering's index (`w[8]`) and a rare flag (`w[9]`). The flag is set only on nouns and adjectives
  used 20 times or more and rendered this way under 3% of the time; a looser rule marked a fifth of all words.

- Profiles (`content/profiles/<id>.json`, one file per person, the file name its id) are written for people the
  People tab lists from the generated data, keyed by TIPNR id in `people` (more than one for a group the text
  treats as one, such as Job's three friends) and by people.json id in
  `genealogy`. The chapter list and the index bundle only the fields `scripts/vite-profile-index.mjs` picks out
  (`?index`); the full profile is a lazy chunk loaded when opened. The summary, body and moments keep to what the
  text says; what tradition, archaeology or scholarship adds goes in `later`, each with its own confidence and
  sources (and `traditions` when it is an interpretation). A `when` starts with ≈ and `whenBasis` says what it rests
  on; a king's comes from `rulers.json` so it agrees with the Reign tab, and someone the text does not date has none.
  `media` is optional: a Commons painting, credited from the Commons API, shown as a depiction, not a likeness.
  `eastonWrong` hides an Easton's entry matched to the wrong person, saying what it is about instead.
  A test fails the build if a quotation (“…”) in the summary, body or moments is not the BSB wording of a passage
  the profile cites.

- The people data (`scripts/people.mjs`, run by `build-data.mjs`) comes from STEPBible's TIPNR, pinned to a commit
  in `fetch-sources.mjs` (and in the cached file's name), because a person's id is TIPNR's Strong's number for them
  ("H0175", Aaron) and the profiles are keyed on it; a test fails if a profile's id stops resolving. Every name in
  the interlinear carries the person it names (`w[10]`), from TIPNR's verse lists (its "a", "b" say which of two
  namesakes in a verse is which), so the Words tab links a name to its person even where the English says "him".
  Its gentilic forms ("the Levites") never tag the ancestor, and `EPONYMS` keeps a tribe named for him (Judah,
  Israel) to his own story and the genealogies. Kin are TIPNR's, credited to it, with its "(?)" as `uncertain`;
  TIPNR cites no verse for a link, and telling a stated link from an inferred one by the wording proved unreliable,
  so none is claimed. Where TIPNR links people the text does not (Nahash as Jesse's wife, Heli as Mary's father),
  `NOT_KIN` takes the link out of both records, and where it files someone under a person the text does not say
  they are, `SEPARATE` keeps them apart (Cleopas from Alphaeus); `PeopleSources.tsx` lists every such change, as
  TIPNR's licence asks. TIPNR's `@Brief`/`@Short`/`@Article` were drafted by an AI model and are never read. Easton's
  entries come from Theographic, paired with TIPNR's people by the verses naming them. The curated family tree
  (`content/people.json`) gives each entry its `tipnr` id. `scripts/families.mjs` merges it with TIPNR's parents
  and spouses (the curated tree's first; TIPNR's dashed where it is unsure or reads a curated parent otherwise),
  splits the result into families (one of about a thousand, from Adam through David to Jesus) and lays each out
  once with dagre (a build-only dependency) into `people/families.json`. The People tab draws the family of the
  verse's people as laid out, highlights them, outlines the chapter's, and frames as many of them (and their
  parents) as still read; moving verse only glides the view.

- Itineraries and boundaries (`content/journeys.json`; `kind: 'border'` for a boundary, drawn
  a stretch per verse and filled when `closed`) take each station's position from OpenBible unless
  it has an `estimate` (an `at` point, or none to be spaced evenly between its neighbours);
  estimates and `via` waypoints need a `basis` saying what they rest on, and the map marks
  them ≈. The build flags OpenBible's "within 50 km of X" placeholders as `approx`.

- Scrolls (`content/scrolls.json`) lists the Hebrew Bible's twenty-four books in the Talmud's order (Bava Batra 14b),
  each with the English books it covers. One the Greek split (Samuel) is `kind: 'book'`; separate books copied on one
  scroll (the Torah, the Twelve) are `kind: 'scroll'` with the `gap` in blank lines. The reader draws a dashed seam
  where an English book begins or ends inside one, and a note under words repeated across a book's end (`overlaps`:
  Cyrus's decree); the Scrolls tab (Old Testament only) lays the Hebrew, Greek, English and chapter divisions on one
  strip and draws the two orders against each other. A test fails the build if the Hebrew books do not cover the Old
  Testament once in runs of consecutive books, a join cites no primary source, or an overlap's first verses differ.

- Counts (`content/tallies.json`) are numbers the text lists group by group (a census). Each row quotes
  the BSB's own figure in its verse, and the reader draws a bar under that verse on one scale, filled
  once the verse is read. `groups` are subtotals the text gives (Numbers 2's camps), `compare` names an
  earlier count of the same groups drawn behind each bar (Numbers 26 against 1; a row's `same` gives its
  name there when the lists differ, and `alone` lists groups only one list has), and the rows must add
  up to `total` unless `discrepancy` says why not (Numbers 3's Levites). A model can size itself from
  a tally's rows, as the camp of Israel does, so the two never disagree.

- Reigns: each king of Israel and Judah in `content/rulers.json` has a `reign` (the verse his chart stands
  under in Kings, the length and synchronism as the BSB words them, Kings' verdict, and Chronicles' own chart
  verse and verdict for Judah's kings). A verdict is `right`, `evil` or `none`, with `but` for the qualification
  the text adds (the high places not removed). The chart-wide pieces are in `content/monarchy.json`: the
  reckoning Thiele reconstructs, pins dated outside the Bible, and the prophets, each with `sentTo` (the kingdom he
  spoke to, shown by the verse `sent`; `both` is drawn with Judah) and drawn beside that kingdom's lane. A
  prophet's `from`–`to` are Thiele years; each end keeps its place within the reign it falls in, so the band
  moves with the kings in every reading (`prophetSpan` in `src/lib/reign.ts`). The reader draws only the
  chart under each accession verse; the Reign tab (shown only in Kings and Chronicles) holds the date toggle
  (a reading, or the stated lengths laid end to end), the legend and the facts. `readings` in `monarchy.json`
  are reconstructions: Thiele's first, from the rulers' own `from`–`to` and `overlap`, then McFall and Young's
  and Galil's, each dating every king, with overlaps saying what they rest on and `notes` for a synchronism
  the reading explains another way. Dates are rounded to the year and marked ≈. A synchronism a reading's
  dates miss by more than two years is drawn out of line and flagged (Thiele's own admission is the king's
  `discrepancy`); `src/__tests__/reign.test.ts` pins which ones each reading misses. A test fails the build if a quote is
  not verbatim in its verse, a synchronism names a king of the same kingdom, or the stated sums behind Jehu's
  note (98 and 95 years) change.

- Chiasms (`content/chiasms.json`) come in two shapes, and the reader draws each on the text. A
  **phrase-level** chiasm gives every level a `quote`: the exact BSB words it covers, one verse per
  level, in reading order. The reader lays those out as an indented ladder, and a test fails the
  build if a quote is not verbatim in its verse. A **passage-level** chiasm gives no quotes; its
  levels are verse ranges, drawn as a margin rail with a structure strip. `text` is always the label.
  Only one passage-level chiasm may touch a chapter (the reader draws one rail), and an
  `interpretation` chiasm names who proposed it in `traditions`, as insights do.

- Models (`content/models.json`) can build as the text is read. `builds` are passages whose `steps`
  each name the parts a verse adds; within a build only the parts reached so far are drawn, and
  elsewhere the model is whole. Parts are the named nodes of the model and nest: naming one shows
  everything inside it. What an estimated part rests on goes once in the model's `estimates`
  (part → basis), shown with each step that adds it and listed under the model; a step's own `basis`
  is only for a note about that account (where it places a piece, say). A build that never adds a
  part lists it in `omits` with the reason. A test fails the build if a step lies outside its passage,
  runs out of order or names a part the model lacks, if two parts share a name, if a build leaves a
  part out without `omits`, or if two parts share a material (a part fades in by fading its materials).
- A model can also change after it is built: `states` are later events (Ahaz stripping the temple's
  stands, Babylon burning it), listed in the order they happen and cumulative. A state has one
  `accounts` entry per passage that tells it (Kings, Jeremiah, Chronicles), whose `changes`, like a
  build's steps, each `hides` parts or `shows` alternates at a verse: parts drawn only in a state and
  never added by a build (the Sea on its stone base). A part a change must remove on its own has to
  be a part of its own (the doors' gold). Reading an account changes the model verse by verse, removed
  parts fading out; elsewhere the reader can pick any state whole. Each says what it rests on in
  `basis`. A test fails the build if a change names an unknown part, lies outside or out of order in
  its account, or a build adds an alternate.
- Every model gives its `scale`: how many metres one of its units is (`"unit": "cubit"` marks the scale
  bar in cubits), and optionally `at`, where the size figure stands, somewhere that says something (the
  tabernacle's gate, the ark's door). The viewer draws a ≈1.66 m figure beside anything over half a metre
  and a hand, one handbreadth across the palm, beside smaller things; both are built in
  `src/lib/models/scale.ts`, outside the model, so they are never build parts. Something worn (the high
  priest's garments) is cut to fit that figure and sets `at` to its own origin and `worn: true`, so the
  figure wears it: it stays put through a build and the camera closes in on each part, not the whole
  figure. `shoulder()` in `scale.ts` gives the arm's pose, for sleeves.
- Beside anything the camera frames that is 10 km or more across (`MAP_FROM_M`), the figure gives way to
  a map: the coasts, rivers and cities round Jerusalem at the model's scale, flat on the ground with
  Jerusalem under the framed box's middle (`src/lib/models/map.ts`, from `public/data/map.json`, loaded
  only for a model that big). The New Jerusalem is drawn to true scale in metres, so the camera goes from
  a 2,220 km cube to a figure at one gate; the viewer's logarithmic depth buffer and far plane allow it.
  A model a few kilometres across (the camp of Israel) brings the map in sooner with `scale.map`: `from`
  metres, and `on`, the map place set at the model's origin (the tabernacle on Mount Moriah). Close in,
  the map names the places round Jerusalem (`near` in `map.json`, from OpenBible), each only while the
  view spans the kilometres the data build gives it, so names never crowd.
- A model the text allows more than one reading of lists `readings` (id, label, `basis`, `traditions`,
  and `estimates` that add to or replace the model's own); the first is the default and the viewer gives
  each a button. The builder takes the reading's id and draws every reading under the same part names, so
  the model's builds serve all of them; the content and visibility tests run for each reading. States are
  for later events in the story, not for readings. The New Jerusalem is the first to use it (the wall as the
  city's face, or a wall at its foot).
- A step's `frame` names what the camera frames instead of what the step adds, drawn or not, and a step
  may add nothing and only `frame` (the New Jerusalem measured at 21:16). For a view no part fits, a
  model can hold never-drawn boxes named for it (`view-east-gate` in `newjerusalem.ts`).
- While a build or a state's account is being read, the camera holds still at an angle and eases to
  each step; elsewhere the model turns. The angle is `view`, `[azimuth, elevation]` in degrees
  (azimuth from the front, +z, round towards +x), set on the model, or on a step or change that needs
  to show a part the model's angle hides (the ephod's apron, worn behind); without one it is
  `DEFAULT_MODEL_VIEW` in `content.ts`. The size figure stands beside a framed piece, to its right as
  the camera sees it, never between the camera and the piece.
- Procedural models live in `src/lib/models/`: one entry in the `BUILDERS` table in `index.ts`
  registers a model (and its `procedural` id). `kit.ts` has the shared pieces; call the material
  helpers (`gold()` …) once per part, and use `instances()` for many copies of one piece.
  Furniture builders (`furniture.ts`) draw at the origin under a name prefix (`table` →
  `table-body`, `table-bread`), so a model places them and can hold several of one kind. In a
  model, `userData.focus` marks what the camera frames while a step builds inside it, and
  `userData.cutaway` marks parts (or a piece inside one, such as the New Jerusalem's gold inside `city`) the viewer can cut open to show what they enclose. The part a step
  is building (or a state's change is adding or removing) is never cut, so a piece on the near side
  of the section, such as the temple's stair, still shows at its own step. A part flagged
  `cutaway: 'step'` instead is cut only at a step marked `"cutaway": true`, with no button: the high
  priest's garments open only where something is put on under them (the tunic, sash, undergarments).
- Every part a step adds (or a state's change shows) must be seen from the camera the reader gets at that
  step: `src/__tests__/visibility.test.ts` casts rays from it, using the viewer's own logic in
  `src/lib/models/view.ts` (what is drawn, the framing, the cutaway), and fails on a part no ray reaches.
  Fix a failure with the step's `view`, or with `cuts` when the step adds a lining in front of what it
  also adds (the temple's gold and chains). Only a part the text itself hides (Noah's wood under its
  pitch) goes in the test's `HIDDEN_BY_THE_TEXT`, saying why. To find an angle,
  `MODEL=<id> STEP=<ref> npm run models:angles` ranks a grid of views by how much of each part is seen
  (`SORT=mean` for a step that adds many parts, `MIN_ELEVATION=0` to leave out views from below the
  ground); `MODEL=<id>` alone lists the steps with a part less than half seen, and how big its largest
  piece looks. The share of rays says nothing about size or about what a reader can make out, so look
  at a new angle in the app: a view from below can score well and still lose the reader in a large
  model (the temple's stands, seen from under the house). A model whose raised floors the
  size figure should stand on flags them `userData.ground` (Ezekiel's courts).

JSON files use one-space indent with `sources`/`media`/`body` entries one per line — match
the surrounding file.

## Gotchas

- The `@` → `src/` and `@content` → `content/` aliases are declared **three times**:
  `vite.config.ts`, `vitest.config.ts` and `tsconfig.json`. Adding an alias means editing
  all three.
- Vite 8 (rolldown) rejects object-form `manualChunks`; code-splitting is done with dynamic
  imports instead.
- `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters` on, so an unused import
  fails `typecheck` rather than warning.
