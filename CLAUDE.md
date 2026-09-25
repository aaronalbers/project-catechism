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
(100 entries each), `xrefs/<Book>.json`, `places/by-book/<Book>.json`, and `map.json` (Natural Earth coasts, rivers and
lakes round Jerusalem, for the models' map scale).

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

### References are strings, parsed everywhere

An OSIS-ish `Ref` is `"Matt.1.1"`, a range `"Matt.5.29-30"` or `"2Kgs.18.13-19.37"`, or a
whole chapter `"Matt.1"`. `src/lib/refs.ts` owns parsing (`parseRef`), display
(`formatRef`), and the two containment predicates the panels rely on: `contains(ref, loc)`
and `touchesChapter(ref, book, ch)`. Book ids come from `content/books.json`; `refs.ts` also
maps common abbreviations onto them. Any ref appearing in content must parse — the test
suite enforces it.

### Panels

`src/components/ContextPanel.tsx` owns the tab strip and shows per-tab counts derived from
`loc`. Places, People and Models are `lazy()` imports so Leaflet, the graph library and
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

- Itineraries and boundaries (`content/journeys.json`; `kind: 'border'` for a boundary, drawn
  a stretch per verse and filled when `closed`) take each station's position from OpenBible unless
  it has an `estimate` (an `at` point, or none to be spaced evenly between its neighbours);
  estimates and `via` waypoints need a `basis` saying what they rest on, and the map marks
  them ≈. The build flags OpenBible's "within 50 km of X" placeholders as `approx`.

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
