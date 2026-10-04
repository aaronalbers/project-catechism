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
  (`fathers/3006`–`3010`) are other works. *Found since:* CCEL has it as the Preface to the Books of Samuel and
  Kings (https://www.ccel.org/ccel/schaff/npnf206.vii.iii.iv.html), which `writers.json` now cites for Tobit and
  1 Maccabees. *Needed:* a check of its wording on each book, then a citation on the `samuel`, `kings`,
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
- **Insight cards added 2026-10-02** (`content/insights/`): the primary texts were all read (Oracc, Perseus, Sefaria,
  New Advent, Cowley on archive.org), but these were not:
  - Parpola, "The Murderer of Sennacherib" (1980), for Adrammelech = Arda-Mulišši (`sennacherib-murder`).
  - Metzger's *Textual Commentary* (1994) on 1 John 5:7-8, for the manuscript evidence and Erasmus's editions
    (`comma-johanneum`). The Codex Sinaiticus link goes to the site, not to the page, which the site doesn't
    link directly.
  - Austin, Franz and Frost (2000): only summaries of the paper were read, for the six sites, ≈750 BC and magnitude
    ≈8 (`amos-earthquake`). The Hazor details come from Williams's earthquake catalogue, not Yadin's reports.
  - Torczyner, *Lachish I* (1938), cited as the first publication; the wording quoted is Noegel's (2006).
  - From memory, not checked: Aretas IV's death ≈AD 40 and what dates it (`aretas-and-antipas`); Botta's start at
    Khorsabad in 1843 (`sargon-samaria`); Rawlinson's 1863 identification of Pul, which rests on the Jewish
    Encyclopedia, an article that also misdates Pul's Babylonian reign (`tiglath-pileser-menahem-pul`).
  - The Great Isaiah Scroll's reading yirʾeh ʾor at 53:11 is stated from memory and not checked against a
    transcription (`great-isaiah-scroll-light`). The Septuagint and Masoretic readings were checked.
  - Whiting's "Jerusalem's Locust Plague" (*National Geographic*, December 1915) is the written eyewitness account
    behind the photographs. archive.org has only its cover, so `joel-locusts-1915` cites the photographs alone.
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

## Writers and speakers (`content/writers.json`, `content/speakers.json`, the People tab), recorded 2026-10-01

### Incomplete

- **No speakers in the books beyond the 66.** Glyssen covers only the 66, so Tobit to Jubilees show who wrote them
  but no one speaking. *Needed:* a source for them (none is known), or curated passages for their dialogues.
- **Glyssen's speakers are a casting, not checked verse by verse.** About 13,800 of its 22,300 speakers are linked
  to people; the links were reviewed by speaker (408 pairs) and the mistakes fixed or pinned in `people.test.ts`,
  but the casting itself (who speaks, and its alternative readings) is Glyssen's and has only been spot-checked.
  *Needed:* a review of the books with the most dialogue (Genesis, Samuel, the Gospels, Acts) against the text.
- **Some speakers have no person link.** "'Some of those present' — John 12:4 names Judas Iscariot" (Mark 14:4–5),
  "The narrator (Matthew)", and from Glyssen the disciple whom Jesus loved in John and a speaker its matching
  cannot place (Jesus as "the Lord" in Acts 9:10, the voice like a trumpet in Revelation 1:10) are left unlinked. *Needed:* a
  decision on whether a row may link to someone a parallel passage or tradition names, and how it would say so.

### Citations not checked against the work

Cited from memory without a link to the text: the Muratorian Fragment (lines 69–71, on Wisdom), the Septuagint's
opening sentence of Lamentations, Jerome's Commentary on Daniel (on Porphyry), the Didascalia Apostolorum (on the
Prayer of Manasseh), Josephus' Antiquities book 11 (on 1 Esdras), the British Museum number of the Amenemope
papyrus (EA 10474), and the Dead Sea Scroll numbers (Tobit 4Q196–200, 7Q2, 11Q5 column 28, 4Q201–212, 4Q216,
Mas1h, 1QpHab). *Needed:* each checked against a public-domain translation or the museum's or library's catalogue
page, with a `url` added.


## Red letters (`src/lib/redletter.ts`, the reader), 2026-10-03

- **Words of Jesus that Glyssen gives to someone else, or that the BSB leaves unquoted.** Acts 20:35 (“It is more
  blessed to give than to receive,” which Paul quotes as the Lord's) is Paul's in Glyssen, so it stays black.
  Glyssen gives Rev 22:14-15 to Jesus, but the BSB closes his words at 22:13, so they stay black too. Red-letter
  editions differ on both. *Needed:* a short curated list of passages to add or leave out, citing a red-letter
  edition for each, read by `wordsOfJesus` alongside Glyssen.

## The apostles' deaths (`content/insights/history.json`), 2026-10-03

The primary texts (1 Clement, Ignatius, Polycarp, Irenaeus, Tertullian, Clement of Alexandria and Eusebius on New
Advent; Tacitus on LacusCurtius; Paley on Gutenberg), Guarducci's *Tomb of St. Peter*, van der Horst's review of
Zwierlein and the Ehrman interview were read for every quotation. These were not, or not fully:

- **McDowell's article was read only through a fetch tool.** equip.org refuses scripted downloads, so the quotations
  and ratings in `argument-from-the-apostles-suffering` and `what-became-of-the-twelve` come from a fetched rendering of
  the page. *Needed:* a check of each quotation against the page in a browser, or against the book (2015).
- **Zwierlein is cited through his reviewer.** The Peter card summarises *Petrus in Rom* (2009) as van der Horst does in
  BMCR 2010.03.25, and attributes it so. *Needed:* the book itself, and a published reply to it (Heid's *Petrus und
  Paulus in Rom*, 2011, or Bockmuehl, 2012), so the Roman tradition's modern defenders are given in their own words as
  well as its ancient sources.
- **No sceptical voice on the martyrdom traditions themselves.** The argument card gives Ehrman, who accepts the
  witnesses' sincerity. A writer who questions the persecution accounts (Candida Moss, *The Myth of Persecution*, 2013)
  was not read. *Needed:* that position in its own words, if it bears on the apostles, as a third tradition.
- **Papias on John's death.** A fragment ascribed to Papias (through Philip of Side and George Hamartolos) says John was
  killed by the Jews. It is not on the Twelve card because no text of it was read. *Needed:* the fragment (Holmes's
  Apostolic Fathers, or ANF 1) and a sentence on it beside Irenaeus and Polycrates.
- **The Acts of Andrew and Acts of Thomas are cited without a text.** *Needed:* public-domain translations (M. R. James,
  *The Apocryphal New Testament*, 1924), the chapters for Andrew's death at Patras and Thomas's in India, and their dates.
- **Heracleon's negative not checked in the Greek.** The Twelve card gives both the New Advent translation and Salmon's
  reading. *Needed:* the Greek (Stählin's GCS edition), and the card reduced to one reading if the Greek settles it.
- **Dates of the fathers are standard ones, not checked.** Dionysius of Corinth ≈170, Tertullian's *Prescription* ≈200
  and *Scorpiace* ≈210, Irenaeus ≈180 and Heracleon ≈170–180 (Salmon) are given with ≈ but without saying what each
  rests on. *Needed:* a source for each (Eusebius's placing of Dionysius under Soter, say).
- **The aedicula's dating comes from a secondary page.** The stamped tiles of 146–161 are from stpetersbasilica.info,
  which cites Guarducci and Toynbee and Ward-Perkins (1956). *Needed:* the page in the excavation report, and a Commons
  photograph credited from the Commons API.
- **"Most historians accept" in `james-death-josephus`** (written before these rules) has no source for the majority.
  *Needed:* a source that says so, or the holders named.
- **Paul's tomb.** The 2002–06 excavation at St Paul Outside the Walls and the 2009 dating of its sarcophagus's contents
  are left out for want of a published report. *Needed:* the report, before adding it to `paul-death-rome`.

## Medicine cards on the passion (`content/insights/medicine.json`), 2026-10-03

- **Edwards, Gabel & Hosmer (JAMA 1986) quoted from a reprint.** The quotations ("serous pleural and pericardial
  fluid", "exhaustion asphyxia", the closing sentence) were read from the catholicculture.org reprint, because JAMA's
  page refuses scripted requests. Volume, issue and page are confirmed by Crossref. *Needed:* a check of the quotations
  against the JAMA PDF.
- **Zugibe (2005) not read.** His pleural-effusion reading of the "water", the right atrium, and his suspension
  experiments come from Maslen & Mitchell's review and Geberth's 2008 AAFS abstract, not from the book. The cards leave
  out the arm angles and hanging times for that reason. *Needed:* the book (M. Evans, 2005), with page numbers, and the
  experiments' figures if the card should give them.
- **Barbet named without a page.** *A Doctor at Calvary* is cited from Maslen & Mitchell (they list a 1963 edition). *Needed:*
  the passage on asphyxia, and a source entry for it.
- **Luke 22:43–44's manuscripts from memory.** P75 and Vaticanus omitting, Sinaiticus' first hand and Bezae including,
  are standard but were not read off Metzger's *Textual Commentary* (no link given). *Needed:* the entry's page and
  wording, or an NA28 apparatus, to confirm the list.
- **Who reads Jesus' beating as one, and who as two, is unnamed** (`flogged-and-crucified` in `history.json`). The card
  gives both readings without naming who holds them, because no commentator's position was checked. It stays
  `consensus` for the Roman practice, which three primary texts attest. *Needed:* named holders (Raymond Brown's
  *Death of the Messiah* on John 19:1; an evangelical commentary on John that reads it as two beatings), then a line
  naming each.
- **Sherwin-White's three grades cited without a page.** The scale is widely credited to *Roman Society and Roman Law
  in the New Testament* (1963), and the Digest passage behind it was checked, but his wording was not. *Needed:* the
  page and his own terms.

## What things cost (`content/prices.json`, the Worth tab), 2026-10-03

### Sources not yet found

- **A wage from Persian Judah.** The after-the-exile day of a drachma rests on Athens (the Erechtheion accounts,
  408/7 BC) and on Tobit, not on Judah or Babylonia. *Needed:* a cited wage from the Elephantine papyri, the
  Persepolis fortification or treasury tablets, or Neo-Babylonian hire contracts. The shekel, mina and talent of that
  era should then be checked against it.
- **An Iron Age wage for Israel and Judah.** The before-the-exile day of 1/30 shekel comes from Hammurabi (§273,
  Babylon, c. 1750 BC), checked against Judges 17:10. Applied to the ninth-century prices of 2 Kings 7:1, it makes a
  seah of flour cost a month's wages even on the day the famine ended, which suggests the wage is too low for that
  period. *Needed:* a Neo-Assyrian or Levantine wage, and then perhaps a separate era for the monarchy.
- **A gold-to-silver ratio before the Persian period.** Every gold sum uses Herodotus's 13:1 (Histories 3.95). The
  ratio varied by period, and no Near Eastern figure has been cited. *Needed:* a cited ratio for the second and early
  first millennium (Powell's "Money in Mesopotamia", JESHO 39, 1996, is a starting point, not yet checked).
- **Livestock prices from Israel's own world.** Sheep, goats, oxen, bulls and cows are priced from the Hittite laws
  (§178, Fordham's translation, in half-shekels), turned into days by Hammurabi's wage. Goats are priced as sheep
  because the list gives no goat. *Needed:* Neo-Assyrian or Ugaritic livestock prices, and a check of §178 against
  Hoffner's edition, whose figures may differ from the Fordham translation.

### Incomplete

- **Things given in kind with no price.** Grain, flour, oil, wine, wool, camels, donkeys, garments, spices, precious
  stones, bronze and iron are listed as "not counted" wherever the text gives them (Hiram's wheat, 1 Kgs 5:11, is
  left out because nothing else in it can be priced). *Needed:* cited prices. Eshnunna §1's barley, or 2 Kings 7:1's
  flour and barley read as market prices, would price the grain; a source is still needed for the rest.
- **The kesitah** (Gen 33:19; Josh 24:32; Job 42:11) is unpriced because its value is unknown (BSB note). It should
  stay that way unless a source gives one.
- **Books beyond the 66.** Only Tobit's wage and deposit are priced. The sums in 1–2 Maccabees, Judith and Sirach are
  not, and the coverage test checks only the 66. *Needed:* entries checked against the WEB wording, and a coverage
  check for those books with an English pattern only, since they have no interlinear.
- **The mina before the exile** is taken as 50 shekels. Ezekiel 45:12 makes it 60, and 1 Kgs 10:17 with 2 Chr 9:16
  implies 100. The unit's basis says so, but nothing shows how far the three readings move each sum.

## Holders named from memory, and views still without one, recorded 2026-10-04

The review of all curated content against "the project has no opinions of its own" replaced majority words and the
project's own readings with named holders. Some holders were named from knowledge of the literature, not from a copy
read in the session. Each needs checking against the work, and correcting or removing if the work does not say it.

### Named from memory

- **Insight cards:** Richard Pervo (*Dating Acts*, 2006) on Luke placing Josephus's Theudas too early
  (`theudas-and-judas`); William Horbury questioning the Caiaphas ossuary on the spelling (`caiaphas-ossuary`, and the
  `caiaphas` profile); Hayim Tadmor's reconstruction of Samaria's fall under Shalmaneser and Sargon (`sargon-samaria`);
  John Kent dating the Erastus pavement to the mid-first century (`erastus-inscription`); J. B. Lightfoot, G. S. Duncan
  and Gerald Hawthorne for Rome, Ephesus and Caesarea (`praetorium-philippians`); E. Randolph Richards reading 1 Peter
  5:12 as naming the carrier (`amanuensis-dictation`); Robert Hubbard reading Ruth 4 as a court and the book's theme as
  hesed (`sandal-at-the-gate`); Wink's soldier punished for exceeding his allowance (`extra-mile-angareia`); the
  Douay-Rheims wording of Genesis 4:13 (`word-h5771-avon`); Frank Yurco on the determinative (`merneptah-stele`).
- **Profiles:** Kenneth Kitchen as a holder of the 13th-century exodus (the `whenBasis` of Moses, Aaron, Miriam,
  Joshua and Caleb); R. T. France on the Bethlehem infants (`herod-the-great`); Raymond Brown doubting it; H. G. M.
  Williamson for the 458 BC order (`ezra`, `artaxerxes`); Louis Hartman and Alexander Di Lella seeing an error in
  "father" (`belshazzar`); Keil and Delitzsch dating Joel under Joash (`joel-prophet`, and `writers.json`); Davies and
  Allison on Matthew's authorship (`matthew`, `writers.json`); John Collins on Daniel 4 and the Prayer of Nabonidus
  (`nebuchadnezzar`, and `rulers.json` on Antiochus IV); Raymond Brown's later view of the beloved disciple
  (`john-son-of-zebedee`); Jack Sasson on Jonah as a didactic story (`jonah`); J. B. Lightfoot placing Philemon at
  Colossae (`philemon`, and the `luke` note on Colossians 4:11); Jerome identifying Thaddaeus with Judas son of James
  (`thaddaeus`); I. Howard Marshall on the Pastorals (`timothy`, `writers.json`); Carol and Eric Meyers on Second
  Zechariah (`zechariah-prophet`); Daniel Schwartz for AD 19 as Pilate's start (`pontius-pilate`, `rulers.json`);
  Julius Wellhausen as the holder for the Torah's composition (`moses`).
- **Other files:** Leopold Zunz (1832) for one Chronicler (`scrolls.json`); Robert Gundry reading Hosea 11:1 in
  Matthew as typology and Rashi reading Isaiah's Servant as Israel (`prophecies.json`); Kenneth Kitchen's ≈925 BC for
  Shishak (`models.json`, already listed above under Reigns).

### Views still held by an unnamed group

- **`writers.json`** names the critical view as "critical scholarship" or "modern scholarship" for most books, after
  its majority words ("most", "near-universal", "virtually everyone") were cut. *Needed:* a survey that reports the
  field (Raymond Brown's *Introduction to the New Testament*; John J. Collins's *Introduction to the Hebrew Bible*),
  cited for what it says, or named scholars for each book.
- **Profiles** whose traditions still read "some commentators", "other readers" or "traditional readers":
  `adam`, `ahithophel` (Bathsheba's grandfather), `cleopas`, `james-brother-of-jesus` (a later writer of James),
  `john-mark` (the young man in Gethsemane), `joseph-husband-of-mary` (Luke's line as Mary's), `judas-barsabbas`,
  `nathanael`, `nicodemus`, `simon-of-cyrene`, `vashti`, `zechariah-prophet`, `zephaniah-prophet`, `zerubbabel`,
  `elihu` (the speeches as integral), `herod-the-great` (the Herodium tomb doubted).
- **Insight cards:** the one-beating and two-beating readings of Jesus' flogging (`flogged-and-crucified`); who first
  claimed a council at Jamnia closed the canon (`canon-books-beyond-the-66`); who reads Ketef Hinnom in the Persian
  period (dropped from `ketef-hinnom-scrolls`); who reads Joel's locusts as four species or as stages
  (`joel-locusts-1915`); who reads the Song of Ascents heading as pilgrims' songs or as step-parallelism
  (`going-up-to-jerusalem`); who holds 586 BC for Obadiah besides Hirsch and Barton.
- **The mechanism of the Galilee squalls** (`galilee-squalls`, `consensus`) is not cited to any meteorological source;
  only the survey figures are. *Needed:* a limnological or meteorological study of the lake's winds, or the badge
  lowered.
