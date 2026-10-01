// Who speaks each verse, from Glyssen's character data (SIL and Faith Comes By Hearing, MIT), which casts every
// speech in the 66 books for dramatised audio. Pure functions; build-data.mjs reads the files and writes the result.

/** Glyssen's USFM book codes, in the order of the 66. */
export const USFM_66 = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
  'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB',
  'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI',
  '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];

/**
 * The quote types read as someone speaking the verse. Glyssen's others are left out: `Potential` (quotation marks
 * some translations use and others do not), `Indirect` and `Hypothetical` (speech reported or imagined, not given),
 * `Rare` (an unlikely reading) and `Interruption` (the narrator's aside inside a quotation).
 */
const SPEAKS = new Set(['Normal', 'Dialogue', 'Implicit', 'ImplicitWithPotentialSelfQuote']);
/** Not speakers: the narrator, the narrator's asides, Scripture quoted as Scripture, and rows Glyssen has not settled. */
const NOT_A_SPEAKER = /^(narrator-|interruption-|scripture$|Needs Review$)/;
/** The psalmists whose voice the Psalms' headings already credit; the People tab lists them as writers, not speakers. */
const PSALMISTS = new Set(['psalmist', 'David', 'Asaph', 'sons of Korah', 'Solomon, king', 'Ethan', 'Heman', 'Moses']);

/** CharacterDetail.txt: character id → how many speak as them (-1 for a group of unknown size). */
export function parseCharacters(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [id, max] = line.split('\t');
    out.set(id, +max);
  }
  return out;
}

/**
 * CharacterVerse.txt: one row per character per verse. Yields { book, ch, v, character, delivery, alias, kind },
 * kind being 'speaks', 'alt' (Glyssen's alternative reading of who speaks) or 'quoted' (words quoted, as a prophet
 * quotes God).
 */
export function* parseCharacterVerse(text, bookOf) {
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('Control File')) continue;
    const f = line.split('\t');
    if (f.length < 7) continue;
    const [code, ch, v, character, delivery, alias, type] = f;
    const book = bookOf.get(code);
    if (!book || NOT_A_SPEAKER.test(character)) continue;
    const kind = SPEAKS.has(type) ? 'speaks' : type === 'Alternate' ? 'alt' : type === 'Quotation' ? 'quoted' : null;
    if (kind) yield { book, ch: +ch, v: +v, character, delivery, alias, kind };
  }
}

/**
 * NarratorOverrides.xml (UTF-16): passages the book's own voice speaks in the first person as a character (the Song
 * of Songs' lovers, Jeremiah's laments, God in Psalm 82). A missing start verse is 1; a missing end chapter the start
 * chapter; a missing end verse the end chapter's last. Blocks within a verse are ignored: a verse split between two
 * voices lists both. In the Psalms, the psalmist's own voice is left to the writer the heading names.
 */
export function* parseOverrides(xml, bookOf, lastVerse) {
  const text = xml.replace(/<!--[\s\S]*?-->/g, '');
  for (const [, code, body] of text.matchAll(/<Book id="([^"]+)">([\s\S]*?)<\/Book>/g)) {
    const book = bookOf.get(code);
    if (!book) continue;
    for (const [, attrs] of body.matchAll(/<Override\s([^>]*?)\/>/g)) {
      const a = Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      if (code === 'PSA' && PSALMISTS.has(a.character)) continue;
      const c0 = +a.startChapter, v0 = +(a.startVerse ?? 1), c1 = +(a.endChapter ?? a.startChapter);
      const v1 = a.endVerse ? +a.endVerse : lastVerse(book, c1);
      for (let ch = c0; ch <= c1; ch++) {
        const last = ch === c1 ? v1 : lastVerse(book, ch);
        for (let v = ch === c0 ? v0 : 1; v <= last; v++) yield { book, ch, v, character: a.character, delivery: '', alias: '', kind: 'speaks' };
      }
    }
  }
}

/**
 * The names a Glyssen character goes by: "Abraham (Abram)" → Abraham, Abram; "Mary, Jesus' mother" → Mary;
 * "Eliphaz the Temanite" → Eliphaz; "Zechariah the prophet, son of Berechiah" → Zechariah. Lower-case words in
 * brackets ("(old)", "(in vision)") describe the scene, not the name.
 */
export function namesOf(character) {
  // "Joseph, people of" is a tribe speaking, not the man.
  if (/,\s*(people|men|sons|daughters|house|tribe) of\b/.test(character)) return [];
  // Only brackets before the first comma are the speaker's own names: "Joash, father of Gideon (Jerubbaal)" is not Jerubbaal.
  const own = character.split(',')[0];
  const brackets = [...own.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).filter((s) => /^[A-Z][a-z]+$/.test(s));
  const base = own.replace(/\([^)]*\)/g, '').replace(/\s+the\s.*$/, '').trim();
  // TIPNR lists "Judas Iscariot" as Judas: a two-word name is tried whole, then by its first word.
  const first = /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(base) ? [base.split(' ')[0]] : [];
  return [base, ...first, ...brackets].filter((n) => /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(n));
}

/** How far from a speech the text must name a speaker for a match: verses before it, and after. */
const BEFORE = 15, AFTER = 3;

/**
 * The TIPNR person a speaker is, or undefined. Only a single speaker (Glyssen's Max Speakers is 1) is matched, so a
 * nation spoken of as one ("Israel") is never taken for its ancestor. The person must go by one of the speaker's
 * names and be named nearby: in the same chapter, from fifteen verses before the speech to three after. A namesake
 * named further off is not matched ("Philip the apostle" in Mark 6:37 is not Herod's brother Philip of 6:17), and
 * where two namesakes are both near, the one named in the verse is taken, and otherwise none. build-data.mjs carries
 * a speaker's usual match through the chapters that do not name them.
 */
export function resolver(people, characters) {
  const byName = new Map();
  for (const p of people) for (const n of new Set([p.name, ...(p.also ?? [])])) (byName.get(n) ?? byName.set(n, []).get(n)).push(p);
  const versesIn = new Map(); // "id|Book.ch" → verse numbers naming them there
  for (const p of people) for (const r of p.refs) {
    const [b, c, v] = r.split('.');
    (versesIn.get(`${p.id}|${b}.${c}`) ?? versesIn.set(`${p.id}|${b}.${c}`, []).get(`${p.id}|${b}.${c}`)).push(+v);
  }
  return (character, book, ch, v) => {
    if (characters.get(character) !== 1) return undefined;
    const candidates = [...new Set(namesOf(character).flatMap((n) => byName.get(n) ?? []))];
    const named = (p, from, to) => (versesIn.get(`${p.id}|${book}.${ch}`) ?? []).some((x) => x >= from && x <= to);
    const near = candidates.filter((p) => named(p, v - BEFORE, v + AFTER));
    const inVerse = near.filter((p) => named(p, v, v));
    return near.length === 1 ? near[0].id : inVerse.length === 1 ? inVerse[0].id : undefined;
  };
}
