# Project Catechism

**Read the Bible with the evidence beside it.**
A free, open-source reader that shows — verse by verse — the word studies, cultural
context, money and wages, places, people, timelines, manuscripts and 3D models that
make a passage mean what it meant to its first hearers. Every claim is cited to
Scripture, to a physical find, or to a primary source, and every card says how
firm it is.

Live: https://aaronalbers.github.io/project-catechism/

## What it does

The reader sits in the middle; a context panel follows the current verse.

| Tab | What it shows | Where it comes from |
|---|---|---|
| **Insights** | Money & wages, cultural context, archaeology, history, geography, word studies | `content/insights/*.json` (curated, cited) |
| **Words** | Hebrew/Greek interlinear with morphology, Strong's lexicon | BSB interlinear tables, Strong's dictionaries |
| **Places** | Map of every identifiable place in the passage, with confidence and photos | OpenBible.info geocoding (CC-BY) on OpenStreetMap |
| **People** | Family graph and lifespans for people in the chapter | `content/people.json` (genealogies, cited per person) |
| **Links** | Speaker, prophecy → fulfilment, quotations, chiastic structure, earliest manuscripts, rulers, cross-references, authorship | `content/*.json` + OpenBible.info cross-references |
| **Models** | Rotatable 3D models built to published dimensions | `content/models.json` (procedural or glTF) |
| **Videos** | Every BibleProject video for the passage — book overviews, themes, word studies, visual commentaries, podcast episodes and Shorts — plus the whole library by series; word studies also appear on their Hebrew/Greek word in **Words** | `content/videos.json` (YouTube, click-to-load; site-only videos link to bibleproject.com) |

Press play and the whole page reads along in your browser's own voice, highlighting
each verse and updating every panel as it goes. A neural voice (Kokoro-82M) that runs
in the browser is one click away; it downloads a model first and is slower to start.

### Every card carries a confidence badge

| Badge | Meaning |
|---|---|
| **Evidence** | Stated in the text or shown by physical evidence |
| **Consensus** | Reconstructed, but broadly agreed among scholars |
| **Interpretation** | One reading among several — the card lists which traditions hold it |
| **Estimate** | A guess or approximation — the card says what it is based on |

Dates and numbers that are approximations are marked with **≈**.

## Design goals

1. Reference tracking — every interpretation and piece of evidence shows its origin
2. Tradition tracking — which belief systems hold an interpretation
3. Location tracking — people, objects and borders in space
4. Timeline tracking — people, objects and writings in time, and their generation
5. Genealogy tracking — relationships between biblical figures
6. Royalty tracking — succession of kings and judges and when they ruled
7. Prophecy tracking — when prophecies were made and when they were fulfilled
8. Quote tracking — earlier writings quoted by later writings
9. Fragment tracking — discovered manuscripts and which verses they contain
10. Writer tracking — who wrote which verses
11. Speaker tracking — who is being quoted in the text
12. 3D models — objects described in the Bible rendered in 3D
13. Bible reading — verse-by-verse audio that drives every other module
14. Chiastic structure — highlighting of literary mirror structures
15. Interesting comparisons — e.g. a denarius was a fair day's pay, and the flask of
    nard poured on Jesus was worth 300 of them: about a year's wages
16. Everything backed by references — Scripture, archaeology, or primary sources
17. Word studies — original-language context for every verse
18. Cultural context — e.g. why "the right cheek" means a backhanded slap
19. Free text-to-speech — no API keys, no accounts, no cost to run

## Zero-cost by design

Everything is public domain, Creative Commons, or runs in the visitor's browser.
There are no API keys and nothing to pay for.

| Component | Source | License |
|---|---|---|
| Bible text | [Berean Standard Bible](https://berean.bible/) | Public domain |
| Interlinear (Hebrew/Greek, Strong's, morphology) | [BSB tables](https://bereanbible.com/) | Public domain |
| Strong's dictionaries | [Open Scriptures](https://github.com/openscriptures/strongs) | Public domain text; JSON CC-BY-SA |
| Cross references | [OpenBible.info](https://www.openbible.info/labs/cross-references/) | CC-BY |
| Place data | [OpenBible.info Bible Geocoding](https://github.com/openbibleinfo/Bible-Geocoding-Data) | CC-BY 4.0 |
| Place photos | Wikimedia Commons (credited per image) | CC / public domain |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL |
| Text-to-speech | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via [kokoro-js](https://github.com/hexgrad/kokoro) | Apache-2.0 |
| Videos | [BibleProject](https://bibleproject.com/) on YouTube and bibleproject.com; Streetlights remixes on YouTube | © BibleProject / STREETLIGHTS, embedded or linked |
| Hosting | GitHub Pages via GitHub Actions | free |

The curated content in `content/` is released under the same MIT license as the code.

## Running it

```sh
npm install
npm run data:fetch   # downloads the source datasets into .cache/ (~80 MB, once)
npm run data         # builds public/data/ (~70 MB of static JSON, lazy-loaded per chapter)
npm run dev          # http://localhost:5173
```

`npm run build` produces a static site in `dist/`. The GitHub Actions workflow in
`.github/workflows/deploy.yml` does all of the above and deploys to Pages on every
push to `master`. Generated data is not committed.

## Contributing content

The interesting work is in `content/`. Each file is JSON validated against the
types in `src/lib/types.ts`:

- `insights/*.json` — cards for the Insights tab. Each needs `verses`, a
  `confidence`, and at least one `source` of an evidential kind — `scripture`,
  `archaeology`, `primary`, `lexicon` or `data` (a `scholarship` citation alone
  does not satisfy the check). If the card is an interpretation, list the
  `traditions` that hold it. If anything is an estimate, say so and say what it is
  based on.
- `people.json` — genealogy. `bornAM`/`diedAM` are years from creation summed from
  Genesis 5 and 11; anything derived by further assumptions gets `estimated: true`
  and a `notes` explanation. Disagreeing sources (Matthew 1 vs Luke 3) go in
  `altParents` and are drawn as dashed edges.
- `prophecies.json`, `quotes.json`, `fragments.json`, `writers.json`,
  `speakers.json`, `chiasms.json`, `rulers.json`, `models.json`, `videos.json`.

References use OSIS-style ids: `Matt.5.39`, `Mark.14.3-9`, `Gen.6.9-9.19`.

Media must be freely licensed and credited. Verify every video id belongs to the
channel you say it does (`https://www.youtube.com/oembed?url=...`).

## License

MIT — see [LICENSE](LICENSE). Data sources retain their own licenses as listed above.
