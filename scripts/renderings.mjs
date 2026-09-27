// How the BSB renders each Hebrew and Greek word across the whole Bible, from the interlinear's glosses.
// A gloss carries the English round the word ("according to your loving devotion", "the birds"), so
// glosses are reduced to the word's own rendering before they are counted:
//   1. the small words at either end (articles, prepositions, pronouns) dropped, and a possessive's 's;
//   2. a phrase folds into the commonest rendering it contains ("every kind of bird" → "bird");
//   3. a plural folds into its singular, shown "bird(s)" (or "life/lives").
// Renderings are compared in lower case and shown in the case the BSB uses most ("LORD").
// Used by build-data.mjs; src/__tests__/renderings.test.ts pins the folding.

const EDGE = new Set(('the a an and of to for by in with from on at or but both let like so that as into upon unto then even ' +
  'when while all this these those be is was were are shall will not no you he she it they we i his her its their our your ' +
  'my me him them us who whom which what o').split(' '));

/**
 * A gloss reduced to the word's own English, or '' where the BSB gives the word no English of its own. A
 * gloss made only of small words ("who", "For") is the word's rendering, and is kept whole. `cased` keeps
 * the BSB's capitals, for showing; otherwise it is lower case, for counting.
 */
export function core(gloss, cased = false) {
  const all = (cased ? gloss : gloss.toLowerCase()).replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ').replace(/[^A-Za-z'’\- ]/g, ' ').split(/\s+/).filter((x) => x && x !== '-' && x.toLowerCase() !== 'vvv');
  const small = (x) => EDGE.has(x.toLowerCase());
  const t = [...all];
  while (t.length && small(t[0])) t.shift();
  while (t.length && small(t[t.length - 1])) t.pop();
  const out = t.length ? t : all;
  if (out.length) out[out.length - 1] = out[out.length - 1].replace(/['’]s$/i, '');
  return out.join(' ');
}

/** The singulars a plural could have: "birds" → "bird", "lives" → "life", "cities" → "city", "men" → "man". */
const singulars = (k) => [
  ...(k.endsWith('s') ? [k.slice(0, -1)] : []),
  ...(k.endsWith('ves') ? [k.slice(0, -3) + 'fe', k.slice(0, -3) + 'f'] : []),
  ...(k.endsWith('ies') ? [k.slice(0, -3) + 'y'] : []),
  ...(k.endsWith('men') ? [k.slice(0, -3) + 'man'] : []),
  ...(k === 'children' ? ['child'] : []),
];

const within = (phrase, k) => ` ${phrase} `.includes(` ${k} `);

/**
 * Folds the cores one Strong's number is glossed with. `counts` maps each core to its uses, and `faces` a
 * core to the casing to show it in. Returns the renderings, commonest first, as [label, uses], and a map
 * from each core to its rendering's index.
 */
export function fold(counts, faces = new Map()) {
  const face = (k) => faces.get(k) ?? k;
  const keys = [...counts.keys()].filter(Boolean);
  const to = new Map(keys.map((k) => [k, k]));
  for (const k of keys) {
    if (!k.includes(' ')) continue;
    let best = null;
    for (const j of keys) if (j !== k && within(k, j) && counts.get(j) > counts.get(k) && (!best || counts.get(j) > counts.get(best))) best = j;
    if (best) to.set(k, best);
  }
  const root = (k) => { for (let n = 0; to.get(k) !== k && n < 10; n++) k = to.get(k); return k; };
  const totals = new Map();
  for (const k of keys) { const r = root(k); totals.set(r, (totals.get(r) ?? 0) + counts.get(k)); }
  const label = new Map([...totals.keys()].map((k) => [k, k]));
  const shown = (k) => label.get(k) === k ? face(k) : label.get(k);
  for (const k of totals.keys()) {
    const one = singulars(k).find((s) => totals.has(s) && label.get(s) === s);
    if (one) {
      totals.set(one, totals.get(one) + totals.get(k));
      totals.delete(k);
      label.set(k, one);
      label.set(one, k === `${one}s` ? `${face(one)}(s)` : `${face(one)}/${face(k)}`);
    }
  }
  const rendering = (k) => { const r = root(k); return totals.has(r) ? r : label.get(r); };
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  const index = new Map(sorted.map(([k], i) => [k, i]));
  const at = new Map(keys.map((k) => [k, index.get(rendering(k))]));
  const list = sorted.map(([k, n]) => [shown(k), n]);
  return { list, at };
}

/** Nouns and adjectives other than names: the words whose rare renderings are worth a look. */
export function isContentWord(morph, strongs) {
  const code = strongs.startsWith('H') ? morph.split(' | ').pop() : morph;
  return /^(N-|Adj|A-)/.test(code) && !/proper|^N-[A-Z]{3}-[PLT]/.test(code);
}

/** A rendering is rare when a noun or adjective used 20 times or more is rendered this way under 3% of the time. */
export const RARE = { minUses: 20, share: 0.03 };
