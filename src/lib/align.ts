import type { InterlinearVerse } from './types';

/** Splits text into words and the whitespace between them; an em-dash ends a word, so "robe—the" is two. */
export const tokenize = (s: string) => s.match(/\s+|[^\s—]+—?|—/g) ?? [];
// Apostrophes count only inside a word ("God’s"); at an edge they are quotation marks ("it!’").
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9'’]/g, '').replace(/^['’]+|['’]+$/g, '');
const glossTokens = (g: string) => tokenize(g).map(norm).filter(Boolean);

/**
 * Maps each English word of a BSB verse to the interlinear entry it translates. A multi-word gloss first
 * claims the run of words it spells out (longest glosses first), so "the other person" and "the same" each
 * take their own "the"; then the remaining words match single entries. Wherever a gloss occurs as often in
 * the English as in the Hebrew, occurrences pair off in order — "tooth for tooth" gives each שֵׁן its own
 * "tooth" — and only uneven counts fall back to the nearest entry by relative position.
 */
export function alignVerse(text: string, il: InterlinearVerse | undefined): (number | null)[] {
  const words = tokenize(text).filter((t) => t.trim()).map(norm);
  const out: (number | null)[] = words.map(() => null);
  if (!il) return out;
  const glosses = il.w.map((w) => glossTokens(w[5]));
  // Rows run in English order, so an entry's place in the English is roughly how many gloss words precede it.
  let total = 0;
  const before = glosses.map((g) => (total += g.length) - g.length);
  const rel = (i: number) => total ? before[i] / total : i / il.w.length;
  const pos = (j: number) => j / Math.max(1, words.length);
  const nearest = <T>(xs: T[], at: (x: T) => number, p: number) => xs.reduce((a, x) => Math.abs(at(x) - p) < Math.abs(at(a) - p) ? x : a);
  const used = new Set<number>();

  // Phrases, grouped by identical gloss, longest first.
  const groups = new Map<string, number[]>();
  glosses.forEach((g, i) => { if (g.length > 1) groups.set(g.join(' '), [...(groups.get(g.join(' ')) ?? []), i]); });
  for (const entries of [...groups.values()].sort((a, b) => glosses[b[0]].length - glosses[a[0]].length)) {
    const g = glosses[entries[0]];
    const fits = (j: number) => j + g.length <= words.length && g.every((t, k) => words[j + k] === t && out[j + k] === null);
    const claim = (i: number, j: number) => { for (let k = 0; k < g.length; k++) out[j + k] = i; used.add(i); };
    const runs: number[] = [];
    for (let j = 0; j < words.length; j++) if (fits(j)) { runs.push(j); j += g.length - 1; }
    if (runs.length === entries.length) { entries.forEach((i, k) => claim(i, runs[k])); continue; }
    for (const i of entries) {
      const free = runs.filter(fits);
      if (free.length) claim(i, nearest(free, pos, rel(i)));
    }
  }

  // Single words, grouped by the word.
  const occurrences = new Map<string, number[]>();
  words.forEach((w, j) => { if (w && out[j] === null) occurrences.set(w, [...(occurrences.get(w) ?? []), j]); });
  for (const [w, js] of occurrences) {
    const all = glosses.flatMap((g, i) => g.includes(w) ? [i] : []);
    const free = all.filter((i) => !used.has(i));
    if (free.length === js.length) { js.forEach((j, k) => { out[j] = free[k]; }); continue; }
    const pool = free.length ? free : all;
    if (pool.length) for (const j of js) out[j] = nearest(pool, rel, pos(j));
  }
  return out;
}
