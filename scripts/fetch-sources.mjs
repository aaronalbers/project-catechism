// Downloads the public-domain / CC-BY source datasets into .cache/.
// Run once (`npm run data:fetch`), then `npm run data` to build public/data/.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';

export const CACHE = new URL('../.cache/', import.meta.url);

const GEO = 'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/';
export const SOURCES = {
  // Berean Standard Bible — public domain. https://berean.bible/
  'bsb.txt': 'https://bereanbible.com/bsb.txt',
  // BSB interlinear tables (Hebrew/Greek, Strong's, morphology) — public domain.
  'bsb_tables.xlsx': 'https://bereanbible.com/bsb_tables.xlsx',
  // OpenBible.info cross references — CC-BY. https://www.openbible.info/labs/cross-references/
  'cross-references.zip': 'https://a.openbible.info/data/cross-references.zip',
  // OpenBible.info Bible geocoding — CC-BY 4.0. https://github.com/openbibleinfo/Bible-Geocoding-Data
  'geo-ancient.jsonl': GEO + 'ancient.jsonl',
  'geo-modern.jsonl': GEO + 'modern.jsonl',
  'geo-image.jsonl': GEO + 'image.jsonl',
  // Strong's dictionaries (Open Scriptures JSON edition) — CC-BY-SA.
  'strongs-hebrew.js': 'https://raw.githubusercontent.com/openscriptures/strongs/master/hebrew/strongs-hebrew-dictionary.js',
  'strongs-greek.js': 'https://raw.githubusercontent.com/openscriptures/strongs/master/greek/strongs-greek-dictionary.js',
};

async function exists(url) {
  try { return (await stat(url)).size > 0; } catch { return false; }
}

export async function fetchAll() {
  await mkdir(CACHE, { recursive: true });
  for (const [name, url] of Object.entries(SOURCES)) {
    const dest = new URL(name, CACHE);
    if (await exists(dest)) { console.log('cached ', name); continue; }
    console.log('fetch  ', name, '<-', url);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  }
  await writeFile(new URL('SOURCES.json', CACHE), JSON.stringify(SOURCES, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAll().catch((e) => { console.error(e); process.exit(1); });
}
