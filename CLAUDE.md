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

**Generated data** (`public/data/`) is built by `scripts/build-data.mjs` from public-domain
sources, is gitignored, and is **fetched lazily at runtime** through `src/lib/data.ts`
(which memoises promises per path). It is sharded so a chapter costs one or two small
requests: `bible/<Book>.json`, `interlinear/<Book>/<ch>.json`, `strongs/<H|G>/<shard>.json`
(100 entries each), `xrefs/<Book>.json`, `places/by-book/<Book>.json`.

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
one `Engine` interface — Kokoro (neural, runs in a Web Worker, fp32/WebGPU ≈330 MB or
q8/WASM ≈90 MB, user's choice) and the Web Speech API as a no-download fallback.

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
