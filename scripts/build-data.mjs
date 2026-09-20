// Builds public/data/ from the cached sources. Output layout:
//   bible/<Book>.json            BSB text, one file per book
//   interlinear/<Book>/<ch>.json Hebrew/Greek words with Strong's, morphology and BSB gloss
//   strongs/H/<n>.json, G/<n>.json  Strong's dictionary in shards of 100 entries
//   xrefs/<Book>.json            cross references keyed by "ch.v"
//   places/index.json, places/by-book/<Book>.json
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { CACHE, fetchAll } from './fetch-sources.mjs';

const OUT = new URL('../public/data/', import.meta.url);
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
  const sst = execSync('unzip -p "' + new URL('bsb_tables.xlsx', CACHE).pathname + '" xl/sharedStrings.xml', { maxBuffer: 1 << 28 }).toString();
  const strings = [];
  const re = /<si>(.*?)<\/si>/gs; let m;
  while ((m = re.exec(sst))) strings.push([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''));
  return strings;
}

async function buildInterlinear() {
  const strings = await loadSharedStrings();
  const proc = spawn('unzip', ['-p', new URL('bsb_tables.xlsx', CACHE).pathname, 'xl/worksheets/sheet5.xml']);
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
      (cells.S ?? '').trim(), +(lang === 'H' ? cells.A : cells.B) || 0, (cells.T ?? '').trim(),
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
    proc.stdout.on('end', resolve);
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
  execSync('unzip -o -q "' + new URL('cross-references.zip', CACHE).pathname + '" -d "' + CACHE.pathname + '"');
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
    const place = {
      id: a.id, name: a.friendly_id.replace(/ \d+$/, ''), slug: a.url_slug,
      types: a.types, lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      description: stripTags(ident.description ?? ''),
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

await fetchAll();
await buildBible();
await Promise.all([buildInterlinear(), buildStrongs(), buildXrefs(), buildPlaces()]);
await writeJson('manifest.json', { builtAt: new Date().toISOString(), sources: JSON.parse(await readFile(new URL('SOURCES.json', CACHE), 'utf8')) });
console.log('done');
