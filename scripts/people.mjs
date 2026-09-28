// Everyone the Bible names, from STEPBible's TIPNR (Translators Individualised Proper Names with all References,
// Tyndale House / STEPBible.org, CC BY 4.0): each person with their own disambiguated Strong's number, every verse
// where each form of their name stands, and their parents, siblings, partners and children. Used by build-data.mjs.
//
// TIPNR's @Brief, @Short and @Article descriptions were drafted by an AI model and are not read here; only the
// structured fields are.

/** TIPNR's book abbreviations, in the order of the 66 in books.json. */
const STEP_BOOKS = ('Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk '
  + 'Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit '
  + 'Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev').split(' ');

/** "H0175" → "H175", "H2148a" → "H2148": the plain Strong's number the BSB interlinear carries. */
export const plainStrongs = (s) => s.replace(/^([HG])0*(\d+)[a-z]?$/, '$1$2');

/** Where a person's record is stored: people/<H|G>/<hundreds>.json, as Strong's are. */
export const personShard = (id) => `${id[0]}/${Math.floor(parseInt(id.slice(1), 10) / 100)}`;

/**
 * Forms of a name that are not the person being named: a gentilic ("Levite", "Israelite") is filed under its
 * ancestor as a Group, a verb or adjective ("to become a Jew") as a Form, and someone the text leaves unnamed as
 * Mentioned. A name only the Septuagint has is not in the BSB.
 */
const NOT_A_NAMING = /^(Group|Form|Mentioned|LXX)/;

/**
 * Parses the TIPNR text. Returns every record that names a Strong's number in some verse (people, places and
 * the rest, which the tagger needs to tell a person from a place of the same name), and the people among them.
 * A form's refs are { ref, occ }, `occ` being which occurrence of that Strong's number in the verse it is (0 for
 * TIPNR's "a", 1 for "b") when the verse has more than one, else null.
 */
export function parseTipnr(text, the66) {
  const bookOf = Object.fromEntries(STEP_BOOKS.map((s, i) => [s, the66[i]]));
  const records = [];
  for (const chunk of text.replace(/\r/g, '').split(/^\$==========\s*/m).slice(1)) {
    const lines = chunk.split('\n');
    const section = lines[0].split('\t')[0].trim();
    const head = lines[1]?.split('\t') ?? [];
    const [unique, uStrong] = (head[0] ?? '').split('=');
    if (!uStrong) continue;
    const rec = {
      unique: unique.trim(), id: uStrong.trim(), section,
      // In a person's header: description, parents, siblings, partners, offspring, tribe, summary, type.
      type: section.startsWith('PERSON') || section.startsWith('PLACE+PERSON') ? (head[8] ?? '').trim() : section.startsWith('PLACE') ? 'Place' : 'Other',
      parents: head[2] ?? '', siblings: head[3] ?? '', partners: head[4] ?? '', offspring: head[5] ?? '', tribe: (head[6] ?? '').trim(),
      forms: [],
    };
    for (const line of lines.slice(2)) {
      if (!line.startsWith('–') || line.startsWith('– Total')) continue;
      const f = line.split('\t');
      const sig = f[0].replace(/^–\s*/, '').trim();
      const [dStrong, rest] = (f[2] ?? '').split('«');
      if (!rest) continue;
      const refs = [];
      for (const raw of (f[4] ?? '').split(/;\s*/)) {
        const m = /^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)([a-z])?$/.exec(raw.trim());
        if (!m || !bookOf[m[1]]) continue; // "LXX.Est.3.1": the Septuagint only
        refs.push({ ref: `${bookOf[m[1]]}.${m[2]}.${m[3]}`, occ: m[4] ? m[4].charCodeAt(0) - 97 : null });
      }
      const alt = (f[1] ?? '').includes('|') ? [(f[1] ?? '').split('|')[0].trim()] : [];
      rec.forms.push({ sig, dStrong, strongs: plainStrongs(rest.split('=')[0]), names: [...alt, ...namesOf(f[3] ?? '')], naming: !NOT_A_NAMING.test(sig), refs });
    }
    records.push(rec);
  }
  const people = records.filter((r) => (r.type === 'Male' || r.type === 'Female') && r.forms.some((f) => f.naming) && !/^[HG]0+$/.test(r.id));
  return { records, people };
}

/**
 * The other names someone goes by: from the forms that are names of them (not a word some versions translate,
 * "mankind" for Adam), what looks like a name, less gentilics and titles ("Jews" under Judah, "Pharaoh" under Neco).
 */
export function otherNames(rec, name) {
  const seen = new Set([name.toLowerCase()]);
  return rec.forms.filter((f) => /^(Named|Spelled|Aramaic|Greek)$/.test(f.sig)).flatMap((f) => f.names)
    .filter((n) => /^[A-Z][\p{L}’'-]+(?: [A-Z][\p{L}’'-]+)*$/u.test(n) && !/ites?$|itess$|^Jew(s|ish)?$|^Pharaoh$/.test(n))
    .filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

/** "Joash =ESV,KJV; Jehoash =NIV" → ["Joash", "Jehoash"]; "[ ]" (not translated as a name) → []. */
function namesOf(s) {
  return [...new Set(s.split(';').flatMap((part) => part.replace(/=.*$/, '').split(',')).map((n) => n.trim()).filter((n) => n && !/^\[/.test(n)))];
}

/**
 * One of a person's kin from a TIPNR list ("Amram@Exo.6.18-1Ch + Jochebed@Exo.6.20-Num", "Moses@Exo.2.10-Rev,
 * Miriam@Exo.15.20-Mic"): the record it names, and whether TIPNR marks the link "(?)", its reading of a passage
 * that could be read another way. "(a)", an ancestor rather than a parent, and "(d)", a people descended from
 * someone, are not kin in the family's sense and are left out.
 */
export function kinList(s) {
  return s.split(/[,+]/).map((x) => x.trim()).filter(Boolean)
    .filter((x) => !/\((a|d|f)\)/.test(x))
    .map((x) => ({ unique: x.replace(/\([a-z?]\)/g, '').trim(), uncertain: /\(\?\)/.test(x) }));
}

/** An unnamed person TIPNR adds to link a family ("husband_of_Zeruiah@1Sa.26.6"), as words: "husband of Zeruiah". */
export const unnamed = (unique) => unique.replace(/@.*$/, '').replace(/^.*\|/, '').replace(/Unnamed#\d+/, 'unnamed').replace(/_/g, ' ');

/** A word the interlinear marks as a proper name: "proper" in the Hebrew's morphology, a capital in the Greek. */
const isName = (w) => /proper/.test(w[2]) || (w[4].startsWith('G') && /^\p{Lu}/u.test(w[0].normalize('NFD')));

/**
 * Tags each word of the interlinear that names someone with that person's id (word[10]). A word is claimed by
 * the records listing its Strong's number in its verse: TIPNR's "a", "b" say which occurrence belongs to which
 * record, in the order of the original, and otherwise one claimant takes every occurrence. Where two records
 * claim a verse without saying which occurrence is whose, the words are left untagged. TIPNR's lists have gaps
 * (Zibeon's leave out Genesis 36:20–29), so a name no record claims in its verse is given to the one record whose
 * number it is, when only one record, a person, has that number ("son" is H1121, which only Ben's record has, so
 * only a word marked as a name counts). `keep(person, ref, word)` can refuse a tag (a
 * tribe named for its ancestor). Returns ref → Set of person ids tagged there.
 */
export function tagWords(chapters, records, people, keep) {
  const isPerson = new Set(people.map((p) => p.id));
  const claims = new Map(); // "H3101|2Kgs.14.1" → [{ id, occ }]
  for (const r of records) for (const f of r.forms) for (const { ref, occ } of f.refs) {
    const k = `${f.strongs}|${ref}`;
    const list = claims.get(k) ?? claims.set(k, []).get(k);
    // A gentilic form ("the Levites") still claims its word, so the word is not handed to another record.
    const id = isPerson.has(r.id) && f.naming ? r.id : `-${r.id}`;
    if (!list.some((c) => c.id === id && c.occ === occ)) list.push({ id, occ });
  }
  const owners = new Map(); // Strong's number → the records with a form of it
  for (const r of records) for (const f of r.forms) (owners.get(f.strongs) ?? owners.set(f.strongs, new Set()).get(f.strongs)).add(r.id);
  const sole = (s) => { const o = owners.get(s); if (o?.size !== 1) return undefined; const [id] = o; return isPerson.has(id) ? id : undefined; };
  const tagged = new Map();
  let words = 0, ambiguous = 0, filled = 0;
  for (const c of chapters) for (const v of c.verses) {
    const ref = `${c.book}.${c.ch}.${v.v}`;
    const byStrongs = new Map();
    v.w.forEach((w, i) => { if (w[4] && claims.has(`${w[4]}|${ref}`)) (byStrongs.get(w[4]) ?? byStrongs.set(w[4], []).get(w[4])).push(i); });
    v.w.forEach((w, i) => {
      const id = w[4] && isName(w) && !claims.has(`${w[4]}|${ref}`) && sole(w[4]);
      if (!id || !keep(id, ref, w)) return;
      w[9] ??= 0;
      w[10] = id;
      (tagged.get(ref) ?? tagged.set(ref, new Set()).get(ref)).add(id);
      words++; filled++;
    });
    for (const [s, idx] of byStrongs) {
      const list = claims.get(`${s}|${ref}`);
      const order = [...idx].sort((a, b) => v.w[a][6] - v.w[b][6]);
      const lettered = list.filter((x) => x.occ !== null), bare = [...new Set(list.filter((x) => x.occ === null).map((x) => x.id))];
      const owner = new Map();
      for (const x of lettered) if (order[x.occ] !== undefined) owner.set(order[x.occ], x.id);
      for (const i of order) if (!owner.has(i)) { if (bare.length === 1) owner.set(i, bare[0]); else if (bare.length > 1) ambiguous++; }
      for (const [i, id] of owner) {
        if (id.startsWith('-') || !keep(id, ref, v.w[i])) continue;
        v.w[i][9] ??= 0; // word[9] is 1 on a rare rendering; it is filled so the person can follow at [10]
        v.w[i][10] = id;
        (tagged.get(ref) ?? tagged.set(ref, new Set()).get(ref)).add(id);
        words++;
      }
    }
  }
  return { tagged, words, ambiguous, filled };
}
