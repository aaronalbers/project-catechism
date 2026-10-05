# Ideas

Features that could be added. Nothing here is missing from what the app already shows: leaving an idea out
does not make anything wrong or incomplete. (Gaps of that kind go in `FOLLOWUPS.md`.) Each entry says what the idea
rests on, so whoever picks it up knows how much of it the text supports. Remove an entry when it ships, and move
it to **Declined** with the reason if it is turned down, so it is not proposed again.

## Models

In order of priority.

- **Throne room (Rev 4–5).** A build: the throne (4:2), the rainbow (4:3), the 24 elders (4:4), the lamps (4:5), the
  sea of glass (4:6), the living creatures (4:6–8), the scroll (5:1) and the Lamb (5:6). The text gives no
  dimensions, so every part is an estimate. Still to be decided: whether to draw the one seated, or leave
  the figure undrawn and show only the light of 4:3, as `sealed-scroll` leaves the One seated undrawn.
- **Asherah.** The text gives no dimensions or shape, so this would be an `interpretation` model with `readings`:
  - a living tree (Deut 16:21, "plant");
  - a trimmed pole (2 Kgs 17:10, "set up");
  - a carved, stylised tree after the Taanach cult stand and the Lachish ewer (2 Kgs 21:7, "carved image").

  Evidence:
  - it was wood, cut down and burned (Judg 6:25–26, Deut 12:3, 2 Kgs 23:6);
  - it stood beside an altar (Judg 6:25, Deut 16:21);
  - hangings were woven for it (2 Kgs 23:7);
  - the Kuntillet ʿAjrud and Khirbet el-Qom inscriptions show the cult, not the object's form, and no object survives.

  Scholarship: Hadley 2000, Olyan 1988, Day, JBL 1986. A height of ≈2–3 m is a pure estimate: enough wood to burn a
  bull (Judg 6:26).

  Two possible settings:
  - Gideon's scene (Judg 6:25–28) as a small model with `states`: Baal's altar and the asherah torn down, YHWH's
    altar built, the bull burned on the asherah's wood. The closer fit, since the asherah is that passage's subject.
  - Manasseh's and Josiah's states on `solomons-temple` (2 Kgs 21:7, 23:6–7), which would also give the temple a
    Josiah state.

  The setting is still to be decided.
- **Tower of Babel.** Scripture gives no dimensions, so it would rest entirely on Etemenanki (the Esagila tablet).
- **Herod's Temple.** Josephus and Mishnah Middot (primary sources). No builds.

Additions to existing models:
- **Galilee boat:** telling preserved parts from reconstructed ones.
- **House of the Forest of Lebanon:** the other halls of 1 Kgs 7:6–8 (the colonnade, the throne room, the palaces).
- **Priestly garments:** the tunics, sashes and headbands of Aaron's sons (Exod 28:40).
- **Nebuchadnezzar's statue:** Dan 2's statue of gold, silver, bronze, iron and clay would suit a 2:31–33 build, but
  the text gives no dimensions.
- **Solomon's Temple:** a Josiah state (2 Kgs 23). None of the parts drawn now change there; see Asherah above.

## Counts

- On a tally bar, ticks marking the earlier rows.

## Word studies

BibleProject word-study videos that still have no dotted (`narrows`) card, and why each was not written. Check each
against BDB (Sefaria) or Thayer, and against the BSB's renderings (`r` in `public/data/strongs`), before writing one.

- **Khata / Sin** (H2398, H2403, G264, G266): "miss the mark" (Judg 20:16, slingers who do not miss). Plausible, but
  check BDB before claiming the "miss" sense governs the moral uses.
- **Khen / Grace** (H2580): favour shown by a superior. Check whether the BSB's "grace"/"favor" really narrows it.
- **Emet / Faithfulness** (H571): truth and reliability in one word. The BSB already varies between "truth" and
  "faithfulness".
- **Ahavah / Love** (H157, H160) and **Agape / Love** (G26, G25): "love" is not obviously narrower. A card could cover
  covenant loyalty, or love as choosing, but as a narrowing it is a weak case.
- **Chara / Joy** (G5479): "joy" is a fair rendering. Weak.
- **Martus / Witness** (G3144, G3141): the BSB's "witness" is accurate; "martyr" is a later sense. It could be a plain,
  undotted card about the shift.

A card whose marks would get noisy can use `narrows.only` (commands, or before a given word), as shāmaʿ does.

## Scrolls

- **Other orders.** A toggle in the order diagram between the Talmud's order and the orders of printed Hebrew Bibles,
  the Septuagint and the Vulgate. Each needs a primary or public-domain source.
- **Origen's 22 books.** Origen (Eusebius 6.25) joins Judges with Ruth, and Jeremiah with Lamentations and the Letter.
  It could be a second reading in the order diagram.
- **A scroll ring on the Links circle.** An outer ring on `LinkCircle` grouping the books into their Hebrew books and
  scrolls.
- **The New Testament.** Luke–Acts as two volumes by one author (Acts 1:1), and the New Testament's chapter and verse
  history. The Scrolls tab shows only in the Old Testament at present.

## Acrostics

- **Alphabet poems.** Show where an acrostic stands in the Hebrew alphabet, which the English loses. Inline, a thin
  strip of the 22 letters beside the poem, with the current verse's letter lit (and following the audio); in a tab,
  each letter's name, the line's first Hebrew word, and the notes on gaps and swaps. Like the chiasms, it would be
  checkable: a test could fail the build if a claimed letter is not the first letter of its line in the
  interlinear.

  Candidates (each to be checked against the Hebrew and a cited source before it is added):
  - by verse: Pss 25, 34, 145, Prov 31:10–31, Lam 1, 2, 4;
  - by stanza: Ps 119 (eight verses a letter), Lam 3 (three), Ps 37 (about two);
  - by half-line: Pss 111, 112, which would need the Hebrew split within a verse;
  - irregular: Ps 145 lacks a nun line in the Masoretic text, which 11QPs^a and the Septuagint have;
    Lam 2–4 put pe before ayin, where Lam 1 does not;
  - disputed, so `interpretation` with named holders: Pss 9–10 as one broken acrostic (one psalm in the
    Septuagint), and how far Nahum 1's partial acrostic runs.

  Lam 5 has 22 verses but is not an acrostic, and could say so. Sir 51:13–30 is an acrostic only in the Hebrew,
  and the project's Ben Sira is the WEB from the Greek, so it could at most be noted.

  Still to be decided: the data shape (a verse range per letter, sometimes part of a verse), and whether the
  interlinear follows the Hebrew or the English verse numbers where a psalm's heading is verse 1 in Hebrew
  (Ps 34). Which poems are undisputed is itself a claim needing a source.

## Reading aloud

- **Recorded audio.** The BSB has free human recordings (narrators including Bob Souer, linked from openbible.com).
  Playback would need verse timings for each chapter. Neither the timings nor the recordings' licence has been
  checked.
- **Faster synthesis.** Queue two or three verses ahead instead of one, and split long verses into sentences so the
  first clause plays sooner. Piper would be a lighter neural option beside Kokoro. Its speed and size are the
  project's own claims, not measured here.

## Models and cities

- **Ezekiel's city (Ezek 48:30–35)** as its own model at its true 4,500 cubits a side, to set beside the New
  Jerusalem's 2,220 km. A short comparison of Ezekiel's, Zechariah's and John's cities could go on the card.

## Translations

- **Compare translations**, as an optional pane loaded only when opened. YouVersion's React SDK (Apache-2.0,
  github.com/youversion/platform-sdk-react) fetches a passage in any of its versions by a reference such as
  `JHN.3.16`. It needs an app key and a live third-party API, where everything else is static and free, and its
  texts are copyrighted, so they could not be bundled or checked at build time: the BSB would stay the text every
  quote is checked against. YouVersion's platform terms have not been read.

## Layout

- **A "follow" pane**, which switches to whichever tab has content for the current verse, in a set priority. Pinned
  panes would never change on their own.

## Tooling

- **Video catalogue refresh.** The scripts that pulled and merged BibleProject's catalogue are not in the repo.
  Adding them to `scripts/` would let the list be refreshed when BibleProject publishes more.

## Declined

- **Model "eras"**: a changed state shown beyond its own passage (Hezekiah's temple in 2 Kgs 19). Not needed:
  outside a state's passage a model shows as built, by design.
- **A separate wearer, or a hand, for the priestly garments.** Out of place; the size figure wears them.
- **Undotted on purpose:**
  - ḥesed: the BSB's "loving devotion" is already broad.
  - YHWH → LORD: it would put ≈6,500 marks on the text, and the capitals already signal it.
  - ʾErek ʾappayim, "slow to anger" (H750, H639): the English is a fair rendering of the idiom.
  - "What Is Passover?" (H6453): a name, not a narrowed word.
