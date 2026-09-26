// Builds public/data/ from the cached sources. Output layout:
//   bible/<Book>.json            BSB text, one file per book
//   interlinear/<Book>/<ch>.json Hebrew/Greek words with Strong's, morphology and BSB gloss
//   strongs/H/<n>.json, G/<n>.json  Strong's dictionary in shards of 100 entries
//   xrefs/<Book>.json            cross references keyed by "ch.v"
//   circle.json                  verse counts per chapter, plus the better-attested cross
//                                references as running verse indices, for the Links circle
//   places/index.json, places/by-book/<Book>.json
//   map.json                     coastlines, rivers, lakes and a few cities round Jerusalem, for the
//                                size reference drawn beside models too big for a figure
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { CACHE, fetchAll } from './fetch-sources.mjs';

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
  }
  for (const [id, chapters] of bible) {
    const book = books.find((b) => b.id === id);
    await writeJson(`bible/${id}.json`, { id, name: book.name, chapters });
  }
  console.log('bible   ', verseIndex.length, 'verses');
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
  const pending = [];

  const flushChapter = () => {
    if (!current) return;
    pending.push(writeJson(`interlinear/${current.book}/${current.ch}.json`, current.verses));
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
  await Promise.all(pending);
  console.log('interlin', count, 'words');
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
  await writeJson('circle.json', { minVotes: CIRCLE_MIN_VOTES, chapters, xrefs });
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

await fetchAll();
await buildBible();
await Promise.all([buildInterlinear(), buildStrongs(), buildXrefs().then(buildCircle), buildPlaces().then(buildMap)]);
await writeJson('manifest.json', { builtAt: new Date().toISOString(), sources: JSON.parse(await readFile(new URL('SOURCES.json', CACHE), 'utf8')) });
console.log('done');
