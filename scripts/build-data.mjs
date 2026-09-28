// Builds public/data/ from the cached sources. Output layout:
//   bible/<Book>.json            BSB text, one file per book; the books beyond the 66 from the World
//                                English Bible and R. H. Charles (scripts/beyond.mjs)
//   parallels.json               Charles's cross references from 1 Enoch to the 66, [1 Enoch ref, ref]
//   interlinear/<Book>/<ch>.json Hebrew/Greek words with Strong's, morphology and BSB gloss
//                                (and where each word's rendering stands among its renderings, and
//                                the person a name names)
//   strongs/H/<n>.json, G/<n>.json  Strong's dictionary in shards of 100 entries, with how the BSB renders each word
//   xrefs/<Book>.json            cross references keyed by "ch.v"
//   circle.json                  verse counts per chapter, plus the better-attested cross
//                                references as running verse indices, for the Links circle
//   places/index.json, places/by-book/<Book>.json
//   people/by-book/<Book>.json  who each verse names ("ch.v" → ids), with each one's name, kin title and sex
//   people/families.json         every family, the curated tree and TIPNR's merged, laid out with dagre
//   people/<H|G>/<n>.json        everyone named in the Bible (STEPBible's TIPNR), keyed by their Strong's
//                                number, in shards of a hundred numbers
//   map.json                     coastlines, rivers, lakes and a few cities round Jerusalem, for the
//                                size reference drawn beside models too big for a figure
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { CACHE, fetchAll } from './fetch-sources.mjs';
import { RARE, core, fold, isContentWord } from './renderings.mjs';
import { families, familyGraph, layout } from './families.mjs';
import { kinList, otherNames, parseTipnr, personShard, tagWords, unnamed } from './people.mjs';
import { USFM_BOOKS, parseEnoch, parseJubilees, parseUsfm, unpackModule } from './beyond.mjs';

const OUT = new URL('../public/data/', import.meta.url);
/** A cached file's path on disk (URL.pathname would keep %20 for a space). */
const cached = (name) => fileURLToPath(new URL(name, CACHE));
const books = JSON.parse(await readFile(new URL('../content/books.json', import.meta.url), 'utf8'));
const byBsbName = new Map(books.map((b) => [b.bsbName ?? b.name, b]));

async function writeJson(rel, data) {
  const url = new URL(rel, OUT);
  await mkdir(new URL('./', url), { recursive: true });
  await writeFile(url, JSON.stringify(data));
}

// ---------- 1. BSB text ----------
// verseIndex[i] = [bookId, chapter, verse] in canonical order; the interlinear
// sheet refers to verses by this same running index.
const verseIndex = [];
/** "Gen.1.1" → BSB text, for the people build to read which name a verse uses. */
const bsbText = new Map();
async function buildBible() {
  const text = await readFile(new URL('bsb.txt', CACHE), 'utf8');
  const lines = text.replace(/^﻿/, '').split('\n').slice(3);
  const bible = new Map();
  for (const line of lines) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const ref = line.slice(0, tab);
    const verseText = line.slice(tab + 1).trim();
    const m = /^(.*) (\d+):(\d+)$/.exec(ref);
    if (!m) continue;
    const book = byBsbName.get(m[1]);
    if (!book) throw new Error('Unknown book: ' + m[1]);
    const ch = +m[2], v = +m[3];
    if (!bible.has(book.id)) bible.set(book.id, []);
    const chapters = bible.get(book.id);
    (chapters[ch - 1] ??= []).push({ v, t: verseText });
    verseIndex.push([book.id, ch, v]);
    bsbText.set(`${book.id}.${ch}.${v}`, verseText);
  }
  for (const [id, chapters] of bible) {
    const book = books.find((b) => b.id === id);
    await writeJson(`bible/${id}.json`, { id, name: book.name, chapters });
  }
  console.log('bible   ', verseIndex.length, 'verses');
}

// ---------- 1b. Books beyond the 66 ----------
/** [bookId, verses per chapter] for each, in books.json order, for the Links circle. */
const beyondChapters = [];
async function buildBeyond() {
  const texts = new Map();
  const web = fileURLToPath(new URL('engwebu/', CACHE));
  execFileSync('unzip', ['-o', '-q', cached('engwebu_usfm.zip'), '-d', web]);
  for (const file of (await readdir(web)).filter((f) => f.endsWith('.usfm'))) {
    const id = USFM_BOOKS[/^\d+-(\w+?)engwebu/.exec(file)?.[1]];
    if (id) texts.set(id, parseUsfm(await readFile(`${web}${file}`, 'utf8')));
  }
  const sword = fileURLToPath(new URL('sword/', CACHE));
  const enoch = parseEnoch(unpackModule(cached('sword-enoch.zip'), sword, 'enoch'));
  texts.set('1En', enoch);
  texts.set('Jub', parseJubilees(unpackModule(cached('sword-jubilees.zip'), sword, 'jubilees')));
  let verses = 0;
  for (const book of books.filter((b) => b.beyond)) {
    const { chapters, intro } = texts.get(book.id) ?? {};
    if (!chapters) throw new Error(`No text for ${book.id}`);
    if (chapters.length !== book.chapters || chapters.some((c) => !c?.length)) throw new Error(`${book.id}: ${chapters.length} chapters, books.json says ${book.chapters}`);
    await writeJson(`bible/${book.id}.json`, { id: book.id, name: book.name, chapters, ...(intro?.length ? { intro } : {}) });
    beyondChapters.push([book.id, chapters.map((c) => c.length)]);
    verses += chapters.reduce((n, c) => n + c.length, 0);
  }
  // Charles's references run from a verse of 1 Enoch to one of the 66 (a few to other books he cites, dropped here).
  const the66 = new Set(books.filter((b) => !b.beyond).map((b) => b.id));
  const parallels = enoch.refs.filter(([, to]) => the66.has(to.split('.')[0]));
  await writeJson('parallels.json', parallels);
  console.log('beyond  ', beyondChapters.length, 'books,', verses, 'verses,', parallels.length, 'of Charles\'s', enoch.refs.length, 'references');
}

// ---------- 2. Interlinear (streamed from the xlsx) ----------
function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function stripTags(s) { return unescapeXml(s).replace(/<[^>]+>/g, '').trim(); }

async function loadSharedStrings() {
  const sst = execFileSync('unzip', ['-p', cached('bsb_tables.xlsx'), 'xl/sharedStrings.xml'], { maxBuffer: 1 << 28 }).toString();
  const strings = [];
  const re = /<si>(.*?)<\/si>/gs; let m;
  while ((m = re.exec(sst))) strings.push([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''));
  return strings;
}

async function buildInterlinear() {
  const strings = await loadSharedStrings();
  const proc = spawn('unzip', ['-p', cached('bsb_tables.xlsx'), 'xl/worksheets/sheet5.xml']);
  let buf = '';
  let current = null; // { key, chapter: [verse...] }
  let verse = null;
  let count = 0;
  const chapters = [];

  const flushChapter = () => {
    if (!current) return;
    chapters.push(current);
    current = null;
  };

  const handleRow = (cells) => {
    if (!cells.D || cells.D === 'Verse') return;
    const idx = +cells.D - 1;
    const ref = verseIndex[idx];
    if (!ref) return;
    const [book, ch, v] = ref;
    if (!current || current.book !== book || current.ch !== ch) { flushChapter(); current = { book, ch, verses: [] }; }
    if (!verse || verse.v !== v || current.verses[current.verses.length - 1] !== verse) {
      verse = { v, w: [] };
      current.verses.push(verse);
    }
    if (cells.N) verse.h = stripTags(cells.N);
    if (cells.V) (verse.f ??= []).push(stripTags(cells.V));
    if (!cells.F) return; // padding row
    const lang = cells.E === 'Hebrew' || cells.E === 'Aramaic' ? 'H' : 'G';
    const strongs = cells.K ? 'H' + cells.K : cells.L ? 'G' + cells.L : '';
    // [original, transliteration, morphology code, morphology long, strongs, gloss, original-order index, punctuation]
    verse.w.push([
      cells.F, cells.H ?? '', cells.I ?? '', cells.J ?? '', strongs,
      stripTags(cells.S ?? ''), +(lang === 'H' ? cells.A : cells.B) || 0, stripTags(cells.T ?? ''),
    ]);
    count++;
  };

  const parseRow = (xml) => {
    const cells = {};
    for (const c of xml.matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const col = /r="([A-Z]+)/.exec(c[1])[1];
      const v = /<v>(.*?)<\/v>/s.exec(c[2] ?? '')?.[1];
      if (v === undefined) continue;
      cells[col] = /t="s"/.test(c[1]) ? strings[+v] : v;
    }
    handleRow(cells);
  };

  await new Promise((resolve, reject) => {
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      buf += chunk;
      let start = 0, i;
      while ((i = buf.indexOf('</row>', start)) >= 0) {
        const s = buf.lastIndexOf('<row ', i);
        if (s >= start) parseRow(buf.slice(s, i));
        start = i + 6;
      }
      buf = buf.slice(start);
    });
    // A failed unzip still ends its output, so wait for its exit code rather than the end of the stream.
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip sheet5.xml exited with ${code}`))));
    proc.on('error', reject);
  });
  flushChapter();
  countRenderings(chapters);
  await tagPeople(chapters);
  await Promise.all(chapters.map((c) => writeJson(`interlinear/${c.book}/${c.ch}.json`, c.verses)));
  console.log('interlin', count, 'words;', renderings.size, "Strong's numbers rendered");
}

/** Strong's number → { list: [rendering, uses][], uses, bare } for the dictionary, filled by countRenderings. */
const renderings = new Map();

/**
 * Counts how the BSB renders each Strong's number across the Bible and tags every word with its rendering's
 * index in that list (word[8]), or -1 where the BSB gives it no English of its own; word[9] is 1 on a noun
 * or adjective rendered here in a way it rarely is elsewhere.
 */
function countRenderings(chapters) {
  const words = chapters.flatMap((c) => c.verses.flatMap((v) => v.w)).filter((w) => w[4]);
  const counts = new Map();
  // The casings each word's cores are written in, to show each in its commonest ("LORD", not "lord").
  const casings = new Map();
  const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const w of words) {
    const byCore = counts.get(w[4]) ?? counts.set(w[4], new Map()).get(w[4]);
    const k = core(w[5]);
    tally(byCore, k);
    const byId = casings.get(w[4]) ?? casings.set(w[4], new Map()).get(w[4]);
    tally(byId.get(k) ?? byId.set(k, new Map()).get(k), core(w[5], true));
  }
  const commonest = (c) => [...c].sort((a, b) => b[1] - a[1])[0][0];
  const folded = new Map();
  for (const [id, byCore] of counts) {
    const f = fold(byCore, new Map([...casings.get(id)].map(([k, c]) => [k, commonest(c)])));
    folded.set(id, f);
    renderings.set(id, { list: f.list, uses: [...byCore.values()].reduce((a, b) => a + b, 0), bare: byCore.get('') ?? 0 });
  }
  for (const w of words) {
    const { list, at } = folded.get(w[4]);
    const i = at.get(core(w[5])) ?? -1;
    w.push(i);
    const rendered = list.reduce((a, [, n]) => a + n, 0);
    if (i >= 0 && rendered >= RARE.minUses && list[i][1] / rendered < RARE.share && isContentWord(w[2], w[4])) w.push(1);
  }
}

// ---------- 3. Strong's ----------
async function buildStrongs() {
  for (const [lang, file] of [['H', 'strongs-hebrew.js'], ['G', 'strongs-greek.js']]) {
    const js = await readFile(new URL(file, CACHE), 'utf8');
    const start = js.indexOf('{');
    const end = js.lastIndexOf('}');
    const dict = JSON.parse(js.slice(start, end + 1));
    const shards = new Map();
    for (const [key, entry] of Object.entries(dict)) {
      const n = +key.slice(1);
      const shard = Math.floor(n / 100);
      if (!shards.has(shard)) shards.set(shard, {});
      shards.get(shard)[key] = {
        lemma: entry.lemma, xlit: entry.xlit ?? entry.translit, pron: entry.pron,
        derivation: entry.derivation, def: (entry.strongs_def ?? '').trim(), kjv: entry.kjv_def,
        ...(renderings.has(key) && { r: renderings.get(key).list, n: renderings.get(key).uses, bare: renderings.get(key).bare }),
      };
    }
    for (const [shard, data] of shards) await writeJson(`strongs/${lang}/${shard}.json`, data);
    console.log('strongs ', lang, Object.keys(dict).length, 'entries');
  }
}

// ---------- 4. Cross references ----------
async function buildXrefs() {
  execFileSync('unzip', ['-o', '-q', cached('cross-references.zip'), '-d', fileURLToPath(CACHE)]);
  const rl = createInterface({ input: createReadStream(new URL('cross_references.txt', CACHE)) });
  const perBook = new Map();
  for await (const line of rl) {
    const [from, to, votes] = line.split('\t');
    if (!from || from === 'From Verse') continue;
    const [book, ch, v] = from.split('.');
    if (!perBook.has(book)) perBook.set(book, {});
    const key = `${ch}.${v}`;
    ((perBook.get(book)[key]) ??= []).push([to, +votes]);
  }
  for (const [book, refs] of perBook) {
    for (const key of Object.keys(refs)) refs[key] = refs[key].sort((a, b) => b[1] - a[1]).slice(0, 30);
    await writeJson(`xrefs/${book}.json`, refs);
  }
  console.log('xrefs   ', perBook.size, 'books');
}

// ---------- 4b. Whole-Bible circle ----------
// Positions are running verse indices (verseIndex order), so the client can place a verse
// on the circle without loading any book. Only references with at least CIRCLE_MIN_VOTES
// reader votes are kept, and A→B / B→A pairs collapse to one chord with the higher count.
const CIRCLE_MIN_VOTES = 20;
async function buildCircle() {
  const pos = new Map(verseIndex.map(([b, c, v], i) => [`${b}.${c}.${v}`, i]));
  const chapters = [];
  for (const [b, c] of verseIndex) {
    if (chapters.at(-1)?.[0] !== b) chapters.push([b, []]);
    const counts = chapters.at(-1)[1];
    counts[c - 1] = (counts[c - 1] ?? 0) + 1;
  }
  const rl = createInterface({ input: createReadStream(new URL('cross_references.txt', CACHE)) });
  const pairs = new Map();
  for await (const line of rl) {
    const [from, to, votes] = line.split('\t');
    if (!from || from === 'From Verse' || +votes < CIRCLE_MIN_VOTES) continue;
    const a = pos.get(from), b = pos.get(to.split('-')[0]);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}.${b}` : `${b}.${a}`;
    pairs.set(key, Math.max(pairs.get(key) ?? 0, +votes));
  }
  const xrefs = [...pairs].sort((x, y) => x[1] - y[1]).flatMap(([k, v]) => [...k.split('.').map(Number), v]);
  await writeJson('circle.json', { minVotes: CIRCLE_MIN_VOTES, chapters, beyond: beyondChapters, xrefs });
  console.log('circle  ', pairs.size, 'chords');
}

// ---------- 5. Places ----------
async function readJsonl(name) {
  const text = await readFile(new URL(name, CACHE), 'utf8');
  return text.trim().split('\n').map((l) => JSON.parse(l));
}
async function buildPlaces() {
  const ancient = await readJsonl('geo-ancient.jsonl');
  const images = new Map((await readJsonl('geo-image.jsonl')).map((i) => [i.id, i]));
  const index = [];
  const perBook = new Map();
  for (const a of ancient) {
    // First identification that resolves to coordinates, in score order.
    let best = null, ident = null;
    for (const id of a.identifications ?? []) {
      const r = (id.resolutions ?? []).find((r) => r.lonlat);
      if (r) { best = r; ident = id; break; }
    }
    if (!best) continue;
    const [lon, lat] = best.lonlat.split(',').map(Number);
    const thumb = a.media?.thumbnail ?? ident.media?.thumbnail ?? best.media?.thumbnail;
    const img = thumb && images.get(thumb.image_id);
    const hasPhoto = img?.thumbnail_url_pattern; // satellite tiles are only in the (180 MB) thumbnails.zip, so skip them
    const tags = ident.votes?.tags ?? {};
    // "within 50 km of Haradah": OpenBible copies the neighbour's point, so flag it rather than present it as a site.
    const desc = stripTags(ident.description ?? '');
    const radius = /^(?:within|about) ([\d.]+) km\b/.exec(desc);
    const place = {
      id: a.id, name: a.friendly_id.replace(/ \d+$/, ''), slug: a.url_slug,
      types: a.types, lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      description: desc,
      ...(radius && +radius[1] >= 10 ? { approx: desc } : {}),
      confidence: { score: ident.score?.vote_average ?? null, yes: tags.confidence_yes ?? 0, likely: tags.confidence_likely ?? 0, possible: tags.confidence_possible ?? 0 },
      verses: (a.verses ?? []).length,
      wikidata: a.linked_data?.s7cc8b2?.id ?? null,
      image: hasPhoto ? { url: img.thumbnail_url_pattern.replace('####', '330') /* Wikimedia only serves 120/250/330/500/960/1280 px */, credit: img.credit, creditUrl: img.credit_url, license: img.license, description: stripTags(thumb.description ?? '') } : null,
    };
    index.push(place);
    for (const v of a.verses ?? []) {
      const [book, ch, vv] = v.osis.split('.');
      if (!perBook.has(book)) perBook.set(book, {});
      const key = `${ch}.${vv}`;
      const arr = (perBook.get(book)[key] ??= []);
      if (!arr.includes(a.id)) arr.push(a.id);
    }
  }
  await writeJson('places/index.json', index);
  for (const [book, refs] of perBook) await writeJson(`places/by-book/${book}.json`, refs);
  console.log('places  ', index.length, 'places');
}

// ---------- 6. Map ----------
// The size reference for a model tens of kilometres across or more (the New Jerusalem, Rev 21:16):
// Natural Earth's coastlines, the rivers and lakes a reader of the Bible knows, and some cities from
// OpenBible, within MAP_KM of Jerusalem. Lines are [lon, lat, lon, lat, …], thinned to one point
// every ≈ 5 km; the viewer projects them.
const MAP_CENTRE = [35.23417, 31.77667], MAP_KM = 3000;
const MAP_RIVERS = new Set(['Jordan', 'Nile', 'Damietta Branch', 'Rosetta Branch', 'Euphrates', 'Al Furat', 'Firat', 'Tigris', 'Dicle', 'Shatt al Arab']);
const MAP_LAKES = new Set(['Dead Sea', 'Sea of Galilee']);
// Few and far apart, so their names don't overlap at the scale the map is seen at.
const MAP_CITIES = ['a15257a' /* Jerusalem */, 'afc8e7a' /* Rome */, 'a1fe6e7' /* Athens */, 'a217d18' /* Babylon */,
  'a70fd5d' /* Nineveh */];
// Places round Jerusalem for a model a few kilometres across (the camp of Numbers 2), each with the span
// of the view, in km, over which its name is shown, so names near the centre give way as the view widens
// and those further out appear. The cities above show only beyond the widest of these.
const MAP_NEAR = [
  ['aac1fcf' /* Mount Moriah */, 0, 40], ['a84f426' /* City of David */, 0, 5], ['ac2c4c5' /* Mount of Olives */, 0, 5],
  ['abff59d' /* Bethphage */, 0, 5], ['a4f35bc' /* Bethany */, 0, 40], ['ab34789' /* Anathoth */, 2, 40],
  ['ac24f5f' /* Gibeah */, 2, 40], ['ae7274b' /* Emmaus */, 5, 40], ['a112427' /* Bethlehem */, 5, 40],
  ['a6d57ed' /* Ramah */, 5, 40], ['aede336' /* Gibeon */, 5, 40], ['a736f6c' /* Mizpah */, 5, 40],
  ['a9bba61' /* Kiriath-jearim */, 5, 40]];
function kmFromCentre([lon, lat]) {
  const r = Math.PI / 180, [lon0, lat0] = MAP_CENTRE;
  const a = Math.sin((lat - lat0) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(lat0 * r) * Math.sin((lon - lon0) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
/** Splits a line into the runs within MAP_KM, dropping points within ≈ 5 km of the last kept. */
function mapRuns(coords) {
  const runs = [];
  let run = [], last = null;
  const close = () => { if (run.length >= 4) runs.push(run); run = []; last = null; };
  coords.forEach((p, i) => {
    if (kmFromCentre(p) > MAP_KM) { close(); return; }
    const end = i === coords.length - 1;
    if (last && !end && Math.hypot(p[0] - last[0], (p[1] - last[1])) < 0.045) return;
    run.push(+p[0].toFixed(3), +p[1].toFixed(3)); last = p;
  });
  close();
  return runs;
}
async function buildMap() {
  const geo = async (name) => JSON.parse(await readFile(new URL(name, CACHE), 'utf8')).features.filter((f) => f.geometry);
  const lines = (features) => features.flatMap((f) => {
    const g = f.geometry;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    return parts.flatMap(mapRuns);
  });
  const coast = lines(await geo('ne-coastline.geojson'));
  const rivers = lines((await geo('ne-rivers.geojson')).filter((f) => MAP_RIVERS.has(f.properties.name)));
  const lakes = lines((await geo('ne-lakes.geojson')).filter((f) => MAP_LAKES.has(f.properties.name)));
  const index = JSON.parse(await readFile(new URL('places/index.json', OUT), 'utf8'));
  const place = (id) => { const p = index.find((x) => x.id === id); if (!p) throw new Error(`map: no place ${id}`); return { name: p.name, lon: p.lon, lat: p.lat }; };
  const cities = MAP_CITIES.map(place);
  const near = MAP_NEAR.map(([id, from, to]) => ({ ...place(id), span: [from, to] }));
  await writeJson('map.json', { centre: MAP_CENTRE, km: MAP_KM, coast, rivers, lakes, cities, near });
  console.log('map     ', coast.length + rivers.length + lakes.length, 'lines,', cities.length, 'cities,', near.length, 'places near Jerusalem');
}

// ---------- People: TIPNR's persons, with their Easton's entries from Theographic ----------
const TIPNR = 'tipnr-b99716b.txt';
/**
 * Forms TIPNR files under someone the text does not say they are, kept apart as people of their own (the form's
 * number becomes their id). Each is a change to TIPNR's data, and the People tab says so where it credits TIPNR.
 */
const SEPARATE = {
  // Luke names one of the two on the road to Emmaus Cleopas; TIPNR takes him for Alphaeus and for Clopas, as a tradition does.
  G2810: 'Cleopas',
};
/**
 * Links TIPNR makes that the text does not, taken out of both people's records: [person, the people they are not
 * kin to]. Each is a change to TIPNR's data, listed where the People tab credits it.
 */
const NOT_KIN = [
  // 2 Samuel 17:25 names Abigail "daughter of Nahash"; TIPNR makes Nahash Jesse's wife and the mother of all his children.
  ['H5176I', ['H3448', 'H1732', 'H0446I', 'H0041I', 'H8093', 'H5417H', 'H7288', 'H0684G', 'H0453J', 'H6870G']],
  // Luke 3:23 makes Joseph "son of Heli"; TIPNR reads the genealogy as Mary's, making Heli and his wife her parents.
  ['G2242G', ['G3137G', 'G4539']], ['G2242H', ['G3137G', 'G4539']],
  // Ezra 4:5–7 names Darius, Ahasuerus and Artaxerxes as kings in turn, not father and son; Vashti is Ahasuerus's
  // queen, no one's mother. (Daniel 9:1 does make Darius the Mede "son of Ahasuerus".)
  ['H0325', ['H0783A', 'H1867H']], ['H2060', ['H0783A', 'H1867I']], ['H0783A', ['H1867I']],
];
let tipnr;
async function loadTipnr() {
  if (tipnr) return tipnr;
  tipnr = parseTipnr(await readFile(new URL(TIPNR, CACHE), 'utf8'), books.filter((b) => !b.beyond).map((b) => b.id));
  for (const [dStrong, name] of Object.entries(SEPARATE)) {
    const from = tipnr.people.find((r) => r.forms.some((f) => f.dStrong === dStrong));
    if (!from) throw new Error(`SEPARATE: no form ${dStrong} in TIPNR`);
    const forms = from.forms.filter((f) => f.dStrong === dStrong).map((f) => ({ ...f, sig: 'Named', names: [name] }));
    from.forms = from.forms.filter((f) => f.dStrong !== dStrong);
    const rec = { ...from, id: dStrong, unique: `${name}@${dStrong}`, parents: '', siblings: '', partners: '', offspring: '', tribe: '', forms };
    tipnr.records.push(rec);
    tipnr.people.push(rec);
  }
  return tipnr;
}
/**
 * TIPNR files a tribe or nation under the ancestor it is named for: "the tribe of Judah", "all Israel". These
 * ancestors keep only the words about the man himself: his own story in Genesis (Exodus 1 and 6 list the sons who
 * went down to Egypt), the genealogies of 1 Chronicles 1–9, Matthew 1 and Luke 3, and, where a later word is his
 * personal name (Jacob, Esau), that word. Its gentilics ("the Levites") are separate forms and never tag him.
 */
const EPONYMS = {
  H3478: 'Jacob', H6215G: 'Esau', H3063G: null, H1144G: null, H0669G: null, H4519G: null, H7205: null, H8095G: null,
  H3878: null, H1835H: null, H5321G: null, H1410G: null, H0836: null, H3485G: null, H2074: null, H2845: null,
};
/** The name a person is listed under when TIPNR's commonest form is not the one a reader looks for. */
const LISTED_AS = { H3478: 'Jacob' };
function ancestorsOwn(ref, personal, english) {
  const [book, ch] = ref.split('.');
  if (book === 'Gen' || (book === 'Exod' && (+ch === 1 || +ch === 6)) || (book === '1Chr' && +ch <= 9)
    || (book === 'Matt' && +ch === 1) || (book === 'Luke' && +ch === 3)) return true;
  // Outside those, only the New Testament uses the personal name for the man rather than the nation ("the God of Jacob" aside).
  const nt = books.findIndex((b) => b.id === book) >= books.findIndex((b) => b.id === 'Matt');
  return !!personal && nt && new RegExp(`\\b${personal}\\b`).test(english ?? '');
}
/** Word tags from the interlinear build: ref → ids tagged there, and "id|ref" where a tag was refused. */
let peopleTags;
async function tagPeople(chapters) {
  const { records, people } = await loadTipnr();
  const refused = new Set();
  const keep = (id, ref, w) => {
    if (!(id in EPONYMS) || ancestorsOwn(ref, EPONYMS[id], w[5])) return true;
    refused.add(`${id}|${ref}`);
    return false;
  };
  const { tagged, words, ambiguous, filled } = tagWords(chapters, records, people, keep);
  peopleTags = { tagged, refused };
  console.log('names   ', words, 'words tagged with the person they name (', filled, 'where TIPNR leaves the verse out);', ambiguous, 'left untagged where two share a verse unsorted');
}

// The divine names are not people to profile.
const NOT_PEOPLE = new Set(['god_1324', 'holy_spirit_7400']);
/** Easton's links `[Judg. 4:6](/judg#Judg.4.6)` become `[[Judg.4.6|Judg. 4:6]]`, for the app to draw as verse links. */
const eastonText = (t) => t.replace(/\[([^\]]+)\]\(\/?[a-z0-9]*\/?#([1-3]?[A-Za-z]+\.\d+(?:\.\d+)?)\)/g, '[[$2|$1]]').replace(/\s+/g, ' ').trim();
/**
 * Easton's entries, from Theographic, for TIPNR's people. A Theographic person and a TIPNR person are paired when
 * each shares more verses with the other than with anyone else, and either their names agree or they share three
 * verses; Theographic merges some namesakes, so a looser match would hand one man's entry to another.
 */
async function eastonFor(people) {
  const raw = JSON.parse(await readFile(new URL('theo-people.json', CACHE), 'utf8'));
  const verses = JSON.parse(await readFile(new URL('theo-verses.json', CACHE), 'utf8'));
  const osisOf = new Map(verses.map((v) => [v.id, v.fields.osisRef]));
  const theo = raw.map((r) => r.fields).filter((f) => !NOT_PEOPLE.has(f.slug));
  const theoAt = new Map();
  for (const f of theo) for (const v of f.verses ?? []) { const ref = osisOf.get(v); if (ref) (theoAt.get(ref) ?? theoAt.set(ref, []).get(ref)).push(f); }
  const names = new Map(people.map((p) => [p.id, new Set([p.name, ...(p.also ?? [])].map((n) => n.toLowerCase()))]));
  const shared = new Map(); // theo slug → Map(person id → verses shared)
  for (const p of people) for (const ref of p.refs) for (const f of theoAt.get(ref) ?? []) {
    const m = shared.get(f.slug) ?? shared.set(f.slug, new Map()).get(f.slug);
    m.set(p.id, (m.get(p.id) ?? 0) + 1);
  }
  const bySlug = new Map(theo.map((f) => [f.slug, f]));
  const score = (slug, id, n) => n + (names.get(id).has(bySlug.get(slug).name.toLowerCase()) ? 0.5 : 0);
  const bestPerson = new Map(), bestTheo = new Map();
  for (const [slug, m] of shared) for (const [id, n] of m) {
    const s = score(slug, id, n);
    if (s > (bestPerson.get(slug)?.[1] ?? 0)) bestPerson.set(slug, [id, s, n]);
    if (s > (bestTheo.get(id)?.[1] ?? 0)) bestTheo.set(id, [slug, s, n]);
  }
  const out = new Map();
  for (const [id, [slug, , n]] of bestTheo) {
    const f = bySlug.get(slug);
    if (bestPerson.get(slug)?.[0] !== id || !f.dictText?.length) continue;
    if (!names.get(id).has(f.name.toLowerCase()) && n < 3) continue;
    out.set(id, f.dictText.map(eastonText));
  }
  return out;
}

async function buildPeople() {
  const { records, people } = await loadTipnr();
  const { tagged, refused } = peopleTags;
  const order = new Map(verseIndex.map(([b, c, v], i) => [`${b}.${c}.${v}`, i]));
  const byUnique = new Map(records.map((r) => [r.unique, r]));
  const isPerson = new Set(people.map((p) => p.id));
  const listed = (r) => LISTED_AS[r.id] ?? r.unique.replace(/@.*$/, '').replace(/^.*\|/, '').replace(/_/g, ' ');
  const taggedFor = new Map();
  for (const [ref, ids] of tagged) for (const id of ids) (taggedFor.get(id) ?? taggedFor.set(id, new Set()).get(id)).add(ref);
  const refsOf = new Map(people.map((r) => {
    const refs = new Set(taggedFor.get(r.id) ?? []);
    for (const f of r.forms) if (f.naming) for (const { ref } of f.refs) {
      if (refs.has(ref) || refused.has(`${r.id}|${ref}`) || !order.has(ref)) continue;
      if (r.id in EPONYMS && !ancestorsOwn(ref, EPONYMS[r.id], bsbText.get(ref))) continue;
      refs.add(ref);
    }
    return [r.id, [...refs].sort((a, b) => order.get(a) - order.get(b))];
  }));
  const unlinked = (a, b) => NOT_KIN.some(([x, ys]) => (x === a && ys.includes(b)) || (x === b && ys.includes(a)));
  const kin = (self, list) => kinList(list).flatMap(({ unique, uncertain }) => {
    const r = byUnique.get(unique);
    if (r && unlinked(self, r.id)) return [];
    const k = r && isPerson.has(r.id) ? { id: r.id, name: listed(r) } : { name: unnamed(unique) };
    return [uncertain ? { ...k, uncertain: true } : k];
  });
  const out = people.map((r) => {
    const name = listed(r);
    const sex = r.type === 'Female' ? 'female' : 'male';
    const [fa = '', mo = ''] = r.parents.split('+');
    const family = { father: kin(r.id, fa), mother: kin(r.id, mo), spouses: kin(r.id, r.partners), children: kin(r.id, r.offspring), siblings: kin(r.id, r.siblings) };
    // Namesakes are told apart by their kin: "son of Jesse", "wife of Lapidoth". (TIPNR's tribe is often
    // inferred through a parent the text does not name, so it is not used.)
    const sure = (k) => k.id && !k.uncertain;
    const parent = family.father.find(sure) ?? family.mother.find(sure), spouse = family.spouses.find(sure);
    const title = parent ? `${sex === 'female' ? 'daughter' : 'son'} of ${parent.name}` : spouse ? `${sex === 'female' ? 'wife' : 'husband'} of ${spouse.name}` : undefined;
    const also = otherNames(r, name);
    return {
      id: r.id, name, ...(title ? { title } : {}), sex, ...(also.length ? { also } : {}),
      ...Object.fromEntries(Object.entries(family).filter(([, v]) => v.length)),
      refs: refsOf.get(r.id),
    };
  }).filter((p) => p.refs.length);
  const easton = await eastonFor(out);
  const shards = new Map();
  const perBook = new Map();
  for (const p of out) {
    if (easton.has(p.id)) p.easton = easton.get(p.id);
    const shard = personShard(p.id);
    (shards.get(shard) ?? shards.set(shard, {}).get(shard))[p.id] = p;
    for (const ref of p.refs) {
      const [book, ch, v] = ref.split('.');
      if (!perBook.has(book)) perBook.set(book, { verses: {}, people: {} });
      const b = perBook.get(book);
      (b.verses[`${ch}.${v}`] ??= []).push(p.id);
      b.people[p.id] ??= [p.name, p.title ?? '', p.sex === 'female' ? 'f' : 'm'];
    }
  }
  await rm(new URL('people/', OUT), { recursive: true, force: true });
  for (const [shard, data] of shards) await writeJson(`people/${shard}.json`, data);
  for (const [book, data] of perBook) await writeJson(`people/by-book/${book}.json`, data);
  console.log('people  ', out.length, 'people,', easton.size, "with Easton's entries");
  await buildFamilies(out);
}

/**
 * people/families.json: every family (people joined by a parent or a marriage), largest first, laid out once here.
 * Each is { n: [id, name, 'm' | 'f', x, y, curated id?][], e: [from, to, kind, note?][] }.
 */
async function buildFamilies(people) {
  const curated = JSON.parse(await readFile(new URL('../content/people.json', import.meta.url), 'utf8'));
  const start = Date.now();
  const all = families(familyGraph(curated, people)).map((f) => ({
    n: layout(f).map((n) => [n.id, n.name, n.sex === 'female' ? 'f' : 'm', n.x, n.y, ...(n.curated && n.curated !== n.id ? [n.curated] : [])]),
    e: f.edges,
  }));
  await writeJson('people/families.json', all);
  console.log('families', all.length, 'families, the largest', all[0].n.length, 'people, laid out in', ((Date.now() - start) / 1000).toFixed(1), 's');
}

await fetchAll();
await buildBible();
await buildBeyond();
await Promise.all([buildInterlinear().then(() => Promise.all([buildStrongs(), buildPeople()])), buildXrefs().then(buildCircle), buildPlaces().then(buildMap)]);
await writeJson('manifest.json', { builtAt: new Date().toISOString(), sources: JSON.parse(await readFile(new URL('SOURCES.json', CACHE), 'utf8')) });
console.log('done');
