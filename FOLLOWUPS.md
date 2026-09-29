# Follow-ups

Known gaps in what the app already shows, where it falls short of complete or correct: a source that could
not be found or verified, a claim dropped or left vague for want of one, a citation not checked against the
work, or part of a feature that is missing where its neighbours have it. Each entry says what is missing, why,
and what would be needed to fix it. Remove an entry when it is done. Once a feature is built it should be as
complete as it can be: anything the text describes of it that it leaves out belongs here.

Ideas for new things (another model, another word study, another view) are not follow-ups: leaving one out
does not make anything here wrong or incomplete. They go in `IDEAS.md`.

## Scrolls (`content/scrolls.json`, the Scrolls tab), 2026-09-29

### Sources not yet cited

- **Jerome's *Prologus Galeatus*.** It is a Latin witness that Samuel, Kings, Chronicles, Ezra–Nehemiah and the Twelve
  were each counted as one book. *Left out because* no working link was found: New Advent's Jerome pages
  (`fathers/3006`–`3010`) are other works. *Needed:* a public-domain translation online (CCEL's NPNF series 2,
  vol. 6, is a likely place), checked for the wording on each book, then cited on the `samuel`, `kings`,
  `chronicles`, `ezra` and `twelve` entries.
- **A Dead Sea Scroll holding both halves of Samuel (4QSam-a, 4Q51).** This would be archaeological evidence to go
  with the Talmud and Origen, which are texts. *Left out because* the Leon Levy library URL tried
  (`deadseascrolls.org.il/explore-the-archive/manuscript/4Q51-1`) opens a different manuscript ("4Q Multiple
  Compositions"). *Needed:* the right catalogue page, and a check that the scroll really preserves text from both 1
  and 2 Samuel, before adding it as an `archaeology` source on `samuel`.
- **When printed Hebrew Bibles took up the splits.** The Bomberg Rabbinic Bible (1516–17) is the usual answer, but no
  source for it has been verified. The content says only that Hebrew Bibles
  kept the splits "in time", with no date. *Needed:* a public-domain source (the 1906 Jewish Encyclopedia or the
  1911 Britannica's "Bible" articles), then a date in the summary and in `SeamNote`'s wording.
- **Mur 88's description is from memory, not from its page.** "One scroll holding Joel through Zechariah, 2nd century
  AD" could not be read off the cited page, which loads its text by script. *Needed:* confirm the contents and date
  (DJD II, 1961, or the IAA record) and adjust the note if they differ.
- **Japhet (1968) and Williamson (1977)** are cited on the Cyrus-decree overlap without URLs, from knowledge of the
  literature rather than a checked copy. *Needed:* confirm the titles and years and add a link where one exists.
- **Chapters "≈1200s".** Langton made his chapters at Paris before becoming archbishop in 1207, but no sourced year was
  found. *Needed:* a source for a narrower date before tightening it.
- **Old Testament verse numbers.** Only Estienne's 1551 New Testament is sourced. The Old Testament's verse divisions
  are older (the Masoretic verse ends), and the numbering has its own history, so the "Verses" entry says nothing
  about the Old Testament rather than guess. *Needed:* a source on both, then a sentence in `numbering.verses`.

### Incomplete

- **Greek division of Ezra–Nehemiah.** The strip has a Greek row for Samuel, Kings and Chronicles but none for
  Ezra–Nehemiah. How the Greek divides it is more tangled: Esdras A (1 Esdras) is a different book, and Esdras B is said
  to hold Ezra and Nehemiah together, which has not been checked. It was left out rather than drawn wrongly. *Needed:* a source on the
  Septuagint's Esdras books, then `greek` entries for Ezra and Nehemiah.

## Models (`content/models.json`), recorded 2026-09-29

Each model's summary already says what it leaves undrawn. Those parts are listed here so they get drawn.
Parts a build leaves out because that account does not mention them (`omits`) are correct as they are and are not
listed.

- **Solomon's Temple (`solomons-temple`)**: the carvings of gourds, flowers, palms and cherubim (1 Kgs 6:18, 29,
  32, 35); the lions, oxen and cherubim on the stands (7:29, 36); the smaller vessels (7:40, 45, 50).
- **Ezekiel's temple (`ezekiels-temple`)**: the carved cherubim and palms of the house (41:17–20, 25); the hooks of
  40:43; the kitchens of 46:19–24, which lie outside the current build (40:1–43:17), so they need a build or a step
  of their own.
- **New Jerusalem (`new-jerusalem`)**: the angels at the gates (Rev 21:12); the names of the tribes on the gates (21:12)
  and of the apostles on the foundations (21:14); the twelve kinds of fruit (22:2). The glory of God and the throne
  are also undrawn, as is the One seated in `sealed-scroll`. That looks like a deliberate choice rather than a gap;
  it needs a decision either way.
- **House of the Forest of Lebanon (`forest-of-lebanon`)**: the vessels (1 Kgs 10:21) and where the house stood.
- **Widow's lepta (`widows-lepta`)**: the legend round the star (Aramaic or Paleo-Hebrew, "Yehonatan the King") is not
  drawn. The coin type carries it, and the model's sources describe it.
- **Readings the text allows but the model does not draw.** CLAUDE.md asks a model the text allows more than one
  reading of to list `readings`. These models were built before readings existed and describe the other reading only
  in their summaries:
  - `goliath`: 4 cubits and a span, as 4QSam-a, the Septuagint and Josephus give it (1 Sam 17:4);
  - `nebuchadnezzars-statue`: a stele carved with a figure only at the top;
  - `forest-of-lebanon`: Keil and Delitzsch's 45 side rooms in three storeys round a court.
- **Galilee boat (`galilee-boat`)**: the model is the boat of Mark 4:38, but it is not shown being swamped as 4:37
  tells it. A `state` would draw that.
- **Framing of tall, narrow parts** is tight: at Exod 39:29 the sash's band sits at the top edge of the view. Fixing it
  means changing the step framing of every model, so check the visibility test afterwards.
- **Tabernacle lampstand branches (`tabernacle`)**: the estimate for `lampstand-branches` says the curved branches
  follow the Arch of Titus relief and that Maimonides drew them straight. Both claims were written from memory and
  are not cited. *Needed:* a source for each, added to the model's `sources`.
- **The common cubit, ≈44.5 cm**, used by most models, is cited to R. B. Y. Scott, "Weights and Measures of the
  Bible" (1959). The article's details were confirmed, but the article itself was not read, so the figure is from
  memory. *Needed:* check it against the article (JSTOR, doi 10.2307/3209306).

## Citations not checked against the work, recorded 2026-09-29

These works are cited for what they say, but the citations were made from secondary summaries or from memory,
not from reading the work. Each needs checking against a copy, and correcting or removing if it doesn't say what
the card attributes to it.

- **Insight cards** (`content/insights/`): Ussishkin's Lachish excavation reports (1982); Lemaire's 1994 *BAR* article
  on "House of David" on the Mesha Stele; Finkelstein, Na'aman and Römer (2019); Weidner (1939) on the Jehoiachin
  ration tablets; Mendelsohn (1949) on slave prices; Bailey (1986).
- **The three days** (`content/passion.json`): Rusk, "The Day He Died" (*Christianity Today*, 1974); Torrey (1907);
  Bullinger's *Companion Bible*, whose appendices are cited without numbers because they weren't confirmed.
- **Reigns** (`content/monarchy.json`):
  - Kitchen's c. 925 BC for Shishak's campaign: the date was confirmed as the conventional one, but no page
    quoting Kitchen's book giving it was found.
  - Galil's reading flags four synchronisms his dates miss (Ahaziah, Uzziah, Jotham, Hezekiah) without saying
    why, because his arguments (1996) couldn't be read online. His dates come from a site transcribing his tables.
    *Needed:* his book, for his own explanation of each, as the Thiele and Young readings have.

## Profiles and people, recorded 2026-09-29

- **Notes about Theographic's records may be out of date.** Four profiles have a "later" note on what Theographic's
  record for the person wrongly includes: `lydia` (Timna's verses), `demetrius-silversmith` (3 John 12),
  `james-brother-of-jesus` (James son of Mary) and `jesus` (Old Testament titles). The People tab now takes each
  person's verses from TIPNR, not Theographic, so these notes may describe data the app no longer shows. *Needed:*
  check each against TIPNR's record, then correct or remove the note.
- **No profile for Ben-hadad.** Profiles were written for everyone the data has enough story for. Ben-hadad was left
  out because Theographic merged two or three Aramean kings of that name. TIPNR may tell them apart. *Needed:*
  check TIPNR's records, then write a profile for each king.
- **Seven name words untagged.** Where two people of the same name share a verse and TIPNR doesn't say which is
  which, the word names no one. *Needed:* identify each from the text and add an override in `scripts/people.mjs`.

## Chiasms (`content/chiasms.json`), recorded 2026-09-29

The chiasms aim to include every known chiastic structure. These are left out for want of a checkable source for
their levels:
- **The Tower of Babel (Gen 11:1–9)**: Wenham's palistrophe, centred on 11:5. His exact levels haven't been confirmed
  from any accessible source.
- **Matthew 13, Jonah 1, Luke's travel narrative (Kenneth Bailey), and whole-book structures**: proposals whose
  levels weren't verified. Each can go in once there's a source to check its levels against.

## Videos (`content/videos.json`), recorded 2026-09-29

The list aims to include every BibleProject video, wherever it applies.
- **Two collections not covered**: the Streetlights "Old Testament Explainer" playlist (probably BibleProject remixes,
  but bibleproject.com doesn't list them) and the separate BibleProject Podcast channel. *Needed:* confirm each is
  BibleProject's, then add them.
- **Verse tags are partly judgement.** Where a video's page has study questions, its passages come from them.
  Otherwise the passages were tagged from knowledge of the video, not checked against its content. *Needed:* check
  the tags of each video without study questions against what it covers.

## Books beyond the 66, recorded 2026-09-29

- **No interlinear, Strong's or word studies.** No open tagged Greek text of these books exists yet. STEPBible's TAGOT
  is announced as "coming soon". *Needed:* when it is released, build their interlinear from it. The panels say
  why they're empty until then.
