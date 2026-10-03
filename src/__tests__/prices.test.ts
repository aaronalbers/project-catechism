// Prices: every sum the text names, in days of a labourer's wage. The figures must be the BSB's words in their
// verses, every unit and good must be valued, and every verse that names a sum of money must be priced or say why not.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { INSIGHT_BY_ID, PRICES, WORTH } from '@/lib/content';
import { eraOf, exact, formatDays, goodOf, priceDays, priceParts, priceSources, quotedAmount, unitIn } from '@/lib/prices';
import { contains, parseRef, THE_66 } from '@/lib/refs';
import type { BibleBook, InterlinearVerse } from '@/lib/types';

const bibleDir = new URL('../../public/data/bible/', import.meta.url);
const interlinearDir = new URL('../../public/data/interlinear/', import.meta.url);
const evidential = new Set(['scripture', 'archaeology', 'primary', 'lexicon', 'data']);
const byId = (id: string) => PRICES.find((p) => p.id === id)!;

const books = new Map<string, BibleBook>();
function verseText(ref: string) {
  const { book, chapter, verse } = parseRef(ref)!.start;
  if (!books.has(book)) books.set(book, JSON.parse(readFileSync(new URL(`${book}.json`, bibleDir), 'utf8')));
  return books.get(book)!.chapters[chapter - 1].find((v) => v.v === verse)?.t ?? '';
}

describe('quotedAmount', () => {
  it.each([
    ['four hundred shekels of silver', 400], ['a hundred and fifty', 150], ['1,775 shekels', 1775], ['eleven hundred shekels', 1100],
    ['two thousand four hundred shekels', 2400], ['twenty-four bulls', 24], ['a third of a shekel', 1 / 3], ['a half shekel', 0.5],
    ['a quarter shekel of silver', 0.25], ['the other fifty', 50], ['a hundred thousand lambs', 100000], ['a four-drachma coin', 1],
    ['the last penny', 1], ['over three hundred denarii', 300], ['up to a hundred talents of silver', 100], ['valued at 1,000 darics', 1000],
  ])('%s → %d', (q, n) => expect(quotedAmount(q)).toBeCloseTo(n, 9));
});

describe('prices', () => {
  it('the yardstick cites evidence, and so does every era', () => {
    expect(WORTH.sources.some((s) => evidential.has(s.kind))).toBe(true);
    for (const e of WORTH.eras) expect(e.sources.some((s) => evidential.has(s.kind)), e.id).toBe(true);
    expect(WORTH.goodsSources.some((s) => evidential.has(s.kind))).toBe(true);
    // An era's base unit is worth one of itself.
    for (const e of WORTH.eras) expect(unitIn(e, e.base)?.value, e.id).toBe(1);
  });

  it('every price parses, names a known kind, unit and good, and adds up to a figure', () => {
    const kinds = new Set(WORTH.kinds.map((k) => k.id));
    expect(new Set(PRICES.map((p) => p.id)).size, 'two prices share an id').toBe(PRICES.length);
    for (const p of PRICES) {
      for (const r of [p.ref, ...(p.also ?? [])]) {
        const at = parseRef(r);
        expect(at, `${p.id}: ${r} does not parse`).toBeTruthy();
        expect(at!.start, `${p.id}: ${r} is not one verse`).toEqual(at!.end);
      }
      expect(kinds.has(p.kind), `${p.id}: unknown kind ${p.kind}`).toBe(true);
      if (p.era) expect(WORTH.eras.some((e) => e.id === p.era), `${p.id}: unknown era`).toBe(true);
      expect((p.sums?.length ?? 0) + (p.goods?.length ?? 0), `${p.id} prices nothing`).toBeGreaterThan(0);
      for (const s of p.sums ?? []) expect(unitIn(eraOf(p), s.unit), `${p.id}: no ${s.unit} in ${eraOf(p).id}`).toBeTruthy();
      for (const g of p.goods ?? []) expect(goodOf(g.good), `${p.id}: no good ${g.good}`).toBeTruthy();
      for (const x of [...(p.sums ?? []), ...(p.goods ?? [])]) expect(quotedAmount(x.quote), `${p.id}: "${x.quote}" is not ${x.n}`).toBeCloseTo(x.n, 9);
      if (p.insight) expect(INSIGHT_BY_ID.get(p.insight)?.kind, `${p.id}: ${p.insight} is not a money card`).toBe('money');
      expect(priceDays(p), p.id).toBeGreaterThan(0);
    }
  });

  it.skipIf(!existsSync(bibleDir))('every quote is the BSB wording of its verse', () => {
    for (const p of PRICES) for (const x of priceParts(p)) expect(verseText(x.ref), `${p.id} at ${x.ref}`).toContain(x.quote);
  });

  // The yardstick's own sums come out as the text and its notes say.
  it('reckons the anchors as the text does', () => {
    expect(priceDays(byId('vineyard-wage'))).toBe(1);
    expect(priceDays(byId('nard'))).toBe(300);
    expect(formatDays(priceDays(byId('nard')))).toBe('a year’s wages');
    expect(priceDays(byId('levite-wage')), 'Micah’s ten shekels are a year').toBe(WORTH.year);
    expect(priceDays(byId('ten-thousand-talents'))).toBe(60_000_000);
    expect(formatDays(priceDays(byId('ten-thousand-talents')))).toBe('200,000 years’ wages');
    expect(priceDays(byId('widows-mites'))).toBe(1 / 64);
    expect(formatDays(priceDays(byId('widows-mites')))).toBe('11 minutes of a day’s work');
    // Exodus 38: 603,550 half-shekels are 100 talents and 1,775 shekels, which fixes the talent.
    expect(603550 / 2).toBe(100 * unitIn(WORTH.eras[0], 'talent')!.value + 1775);
    expect(exact(byId('nard'))).toBe(true);
    expect(exact(byId('thirty-pieces')), 'Matthew names no coin').toBe(false);
  });

  // A verse that names money with a figure, in the Hebrew or Greek or in the BSB, is priced or says why not.
  const UNITS = new Set(['H8255', 'H4488', 'H1626', 'H1235', 'H150', 'H1871', 'H7192', 'G1220', 'G1406', 'G3414', 'G5007', 'G3016', 'G2835', 'G787', 'G4715', 'G1323', 'G694']);
  const ENGLISH = /\b(shekels?|talents?|minas?|denarii|denarius|drachmas?|gerahs?|bekas?|darics?|pieces of silver|pieces of gold|copper coins?|silver coins?)\b/i;
  const NUMBER = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|hundred|thousand|half|third|quarter|\d)/i;
  it.skipIf(!existsSync(interlinearDir) || !existsSync(bibleDir))('every verse naming a sum of money is priced, or listed as not', () => {
    const covered = [...PRICES.flatMap(priceSources), ...WORTH.unpriced.flatMap((u) => u.refs)].map((r) => parseRef(r)!.start);
    const missing: string[] = [];
    for (const b of THE_66) {
      if (!existsSync(new URL(`${b.id}/`, interlinearDir))) continue;
      for (let c = 1; c <= b.chapters; c++) {
        const verses = JSON.parse(readFileSync(new URL(`${b.id}/${c}.json`, interlinearDir), 'utf8')) as InterlinearVerse[];
        for (const v of verses) {
          const ref = `${b.id}.${c}.${v.v}`;
          // Kikkar is a talent only where the BSB says so; elsewhere it is a plain, a loaf or a region.
          const money = v.w.some((w) => UNITS.has(w[4]) || (w[4] === 'H3603' && /talent/i.test(w[5])));
          const text = verseText(ref);
          if (!money && !(ENGLISH.test(text) && NUMBER.test(text))) continue;
          if (!covered.some((l) => contains(`${l.book}.${l.chapter}.${l.verse}`, { book: b.id, chapter: c, verse: v.v }))) missing.push(`${ref}: ${text}`);
        }
      }
    }
    expect(missing, 'verses naming money that are neither priced nor in `unpriced`').toEqual([]);
  });

  it('no verse is both priced and listed as not', () => {
    const priced = new Set(PRICES.flatMap(priceSources));
    for (const u of WORTH.unpriced) for (const r of u.refs) expect(priced.has(r), `${r} is priced and unpriced`).toBe(false);
  });
});
