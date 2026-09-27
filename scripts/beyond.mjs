// Books beyond the 66: the text of each, in the shape of the BSB's bible/<Book>.json, from
//   the World English Bible's deuterocanon (USFM, public domain), and
//   R. H. Charles's 1 Enoch and Jubilees (1913, public domain), from CrossWire's SWORD modules.
// Each verse is { v, t } with `l` for a verse that stands for several ("15-16"), `h` for a heading
// printed above it and `f` for its footnotes; a book may have `intro`, what it prints before chapter 1.
// Charles's 1 Enoch also carries his cross references, returned as [1 Enoch ref, other ref] pairs.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/** USFM book codes of the World English Bible's deuterocanon, to our book ids. */
export const USFM_BOOKS = {
  TOB: 'Tob', JDT: 'Jdt', ESG: 'EsthGr', WIS: 'Wis', SIR: 'Sir', BAR: 'Bar', DAG: 'DanGr', '1MA': '1Macc', '2MA': '2Macc',
  '1ES': '1Esd', MAN: 'PrMan', PS2: 'AddPs', '3MA': '3Macc', '4MA': '4Macc', '2ES': '2Esd',
};

const tidy = (s) => s.replace(/\\\+?[a-z]+\d*\*?/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;:!?’”)])/g, '$1').replace(/([‘“(])\s+/g, '$1').trim();

/** Parses one USFM book of the World English Bible. */
export function parseUsfm(src) {
  const chapters = [];
  const intro = [];
  let chapter = null, verse = null, heading = null;
  // Footnotes and cross references come out first: a footnote is kept with its verse, without its "1:2" anchor.
  const lines = src.replace(/\r/g, '').split('\n');
  for (const raw of lines) {
    const m = /^\\([a-z]+\d*)\s?(.*)$/.exec(raw.trim());
    if (!m) { if (verse && raw.trim()) verse.t += ' ' + raw.trim(); continue; }
    const [, marker, rest] = m;
    if (['id', 'ide', 'h', 'toc1', 'toc2', 'toc3', 'mt1', 'mt2', 'mt3', 'cp'].includes(marker)) continue;
    if (marker === 'ip' || marker === 'is1') { if (!chapter) intro.push(tidy(stripNotes(rest).text)); continue; }
    if (marker === 'c') { chapter = []; chapters[+rest.trim() - 1] = chapter; verse = null; continue; }
    if (marker === 's1' || marker === 'd') { heading = tidy(stripNotes(rest).text); continue; }
    // Paragraph and poetry markers only break lines; what follows them belongs to the verse in hand or the next \v.
    let text = rest;
    const vm = /^\\v (\d+)(?:-(\d+))?\s?(.*)$/.exec(marker === 'v' ? `\\v ${rest}` : rest);
    if (vm) {
      verse = { v: +vm[1], t: '' };
      if (vm[2]) verse.l = `${vm[1]}-${vm[2]}`;
      if (heading) { verse.h = heading; heading = null; }
      chapter.push(verse);
      text = vm[3];
    }
    if (verse) verse.t += ' ' + text;
  }
  for (const ch of chapters) for (const v of ch ?? []) {
    const { text, notes } = stripNotes(v.t);
    v.t = tidy(text);
    if (notes.length) v.f = notes;
  }
  // WEB opens most books with one sentence on who reads it as scripture; the reader says that itself, with its sources.
  return { chapters, intro: intro.filter((p) => p && !/^[^.]*\bis recognized as Deuterocanonical Scripture by\b[^.]*\.$/.test(p)) };
}

function stripNotes(s) {
  const notes = [];
  const text = s
    // A note can sit between two words ("hell\f …\f*will"), so it leaves a space; tidy() takes it out before punctuation.
    .replace(/\\x .*?\\x\*/g, ' ')
    .replace(/\\f .*?\\f\*/g, (f) => { notes.push(tidy(f.replace(/^\\f \S+/, '').replace(/\\fr [^\\]*/, '').replace(/\\f\*$/, ''))); return ' '; });
  return { text, notes: notes.filter(Boolean) };
}

/**
 * Reads a SWORD RawGenBook module: `.idx` holds each node's offset into `.dat`, which holds the node's
 * parent, sibling and child, its name, and where its text lies in `.bdt`.
 */
export function readGenBook(base) {
  const idx = readFileSync(`${base}.idx`), dat = readFileSync(`${base}.dat`), bdt = readFileSync(`${base}.bdt`);
  const nodes = [];
  for (let i = 0; i < idx.length; i += 4) {
    let o = idx.readUInt32LE(i) + 12; // parent, next sibling, first child
    const end = dat.indexOf(0, o);
    const name = dat.toString('utf8', o, end);
    o = end + 1;
    const size = dat.readUInt16LE(o);
    const text = size >= 8 ? bdt.toString('utf8', dat.readUInt32LE(o + 2), dat.readUInt32LE(o + 2) + dat.readUInt32LE(o + 6)) : '';
    nodes.push({ name, text });
  }
  return nodes;
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const plain = (s) => unescape(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.;:!?’”)])/g, '$1').trim();

/**
 * Splits one chapter of Charles's OSIS into verses at its verse markers, lifting footnotes into `f`
 * and cross references into `refs`. Anything before the first marker is his heading for the section.
 * He divides some verses into lettered lines and prints them out of order where he judged the text
 * displaced (5:6a–b, 7c, 6d–j, 7a–b); each verse gathers its own lines, keeping his letters, and says
 * which verse its lines were printed among.
 */
function osisVerses(xml, chapter, refs) {
  const notes = [];
  const body = xml
    .replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<note type="crossReference">([\s\S]*?)<\/note>/g, (_, inner) => { for (const r of inner.matchAll(/osisRef="([^"]+)"/g)) notes.push({ ref: r[1] }); return `\u0003${notes.length - 1}\u0004`; })
    .replace(/<note[^>]*>([\s\S]*?)<\/note>/g, (_, inner) => { notes.push({ f: plain(inner) }); return `\u0003${notes.length - 1}\u0004`; })
    .replace(/<hi type="super">(\d*)([a-z]?)<\/hi>/g, (_, n, letter) => `\u0001${n}|${letter}\u0002`);
  const byVerse = new Map();
  let current = 0, last = 0;
  for (const piece of body.split('\u0001').slice(1)) {
    const [marker, rest] = piece.split('\u0002');
    const [n, letter] = marker.split('|');
    if (n) current = +n;
    if (!byVerse.has(current)) byVerse.set(current, { v: current, parts: [], f: [], among: new Set() });
    const v = byVerse.get(current);
    if (last && last !== current && v.parts.length) v.among.add(last);
    last = current;
    const text = plain(rest.replace(/\u0003(\d+)\u0004/g, (_, i) => {
      const note = notes[+i];
      if (note.f) v.f.push(note.f);
      else refs.push([`1En.${chapter}.${current}`, note.ref]);
      return '';
    }));
    v.parts.push(letter ? `(${letter}) ${text}` : text);
  }
  return [...byVerse.values()].map(({ v, parts, f, among }) => {
    const out = { v, t: parts.join(' ') };
    if (among.size) f.unshift(`Charles prints this verse's lines among those of ${[...among].map((n) => `verse ${n}`).join(' and ')}, where he judged they belong; they are gathered here.`);
    if (f.length) out.f = f;
    return out;
  });
}

/** Unpacks a SWORD module's zip into `dir` and returns its data path. */
export function unpackModule(zip, dir, name) {
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  return `${dir}/modules/genbook/rawgenbook/${name}/${name}`;
}

/**
 * 1 Enoch from Charles. His chapters are the module's nodes ("Chapter 12"); he printed 91:1–11 and 18–19
 * ("Chapter 91a") before 93, and 91:12–17 after it, so the two halves are put back together here.
 */
export function parseEnoch(base) {
  const refs = [];
  const chapters = [];
  for (const node of readGenBook(base)) {
    const m = /^Chapter (\d+)a?$/.exec(node.name);
    if (!m) continue;
    const ch = +m[1];
    const verses = osisVerses(node.text, ch, refs);
    chapters[ch - 1] = [...(chapters[ch - 1] ?? []), ...verses].sort((a, b) => a.v - b.v);
  }
  return { chapters, refs };
}

/** Jubilees from Charles: each chapter's verses are a list, `<item><label>12.</label> …</item>`. */
export function parseJubilees(base) {
  const chapters = [];
  for (const node of readGenBook(base)) {
    const m = /^Jubilees (\d+)$/.exec(node.name);
    if (!m) continue;
    chapters[+m[1] - 1] = [...node.text.matchAll(/<item>\s*<label>(\d+)\.<\/label>([\s\S]*?)<\/item>/g)].map(([, n, t]) => ({ v: +n, t: plain(t) }));
  }
  return { chapters };
}
