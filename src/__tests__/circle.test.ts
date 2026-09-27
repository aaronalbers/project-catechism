import { describe, expect, it } from 'vitest';
import { buildCanon, circleChapters, type CircleData } from '@/lib/circle';
import { BEYOND, BOOKS, THE_66 } from '@/lib/refs';

// A toy canon: every chapter has three verses.
const canon = buildCanon(BOOKS.map((b) => [b.id, Array(b.chapters).fill(3)]));

describe('link circle canon', () => {
  it('round-trips verse positions', () => {
    for (const loc of [{ book: 'Gen', chapter: 1, verse: 1 }, { book: 'Ps', chapter: 119, verse: 2 }, { book: 'Rev', chapter: 22, verse: 3 }]) {
      expect(canon.locAt(canon.indexOf(loc)!)).toEqual(loc);
    }
  });
  it('clamps verses past the end of a chapter into it', () => {
    expect(canon.locAt(canon.indexOf({ book: 'Matt', chapter: 1, verse: 999 })!)).toEqual({ book: 'Matt', chapter: 1, verse: 3 });
  });
  it('runs clockwise from the top and maps angles back to verses', () => {
    const gen = canon.angle(0), rev = canon.angle(canon.total - 1);
    expect(gen).toBeGreaterThan(0);
    expect(rev).toBeLessThan(2 * Math.PI);
    expect(gen).toBeLessThan(rev);
    for (const i of [0, 1234, canon.total - 1]) expect(canon.atAngle(canon.angle(i))).toBe(i);
  });
  it('leaves a gap between books', () => {
    const matt = canon.indexOf({ book: 'Matt', chapter: 1, verse: 1 })!;
    expect(canon.atAngle((canon.angle(matt - 1) + canon.angle(matt)) / 2)).toBeUndefined();
  });
});

describe('the books beyond the 66 on the circle', () => {
  const three = (ids: { id: string; chapters: number }[]) => ids.map((b) => [b.id, Array(b.chapters).fill(3)] as [string, number[]]);
  const data: CircleData = { minVotes: 0, chapters: three(THE_66), beyond: three(BEYOND), xrefs: [] };
  const plain = buildCanon(circleChapters(data, false).chapters);
  const { chapters, shift } = circleChapters(data, true);
  const wide = buildCanon(chapters);
  it('sit between Malachi and Matthew, a testament gap on either side', () => {
    const mal = wide.indexOf({ book: 'Mal', chapter: 4, verse: 3 })!, first = wide.indexOf({ book: BEYOND[0].id, chapter: 1, verse: 1 })!;
    const last = wide.indexOf({ book: BEYOND.at(-1)!.id, chapter: BEYOND.at(-1)!.chapters, verse: 3 })!, matt = wide.indexOf({ book: 'Matt', chapter: 1, verse: 1 })!;
    expect(first).toBe(mal + 1);
    expect(matt).toBe(last + 1);
    const bookGap = wide.angle(wide.indexOf({ book: 'Esth', chapter: 1, verse: 1 })!) - wide.angle(wide.indexOf({ book: 'Neh', chapter: 13, verse: 3 })!);
    expect(wide.angle(first) - wide.angle(mal)).toBeGreaterThan(bookGap);
    expect(wide.angle(matt) - wide.angle(last)).toBeGreaterThan(bookGap);
    expect(wide.books.filter((b) => b.beyond).map((b) => b.id)).toEqual(BEYOND.map((b) => b.id));
  });
  it('move the New Testament\'s cross references along with it, and leave the Old Testament\'s where they were', () => {
    for (const loc of [{ book: 'Gen', chapter: 1, verse: 1 }, { book: 'Mal', chapter: 4, verse: 3 }, { book: 'Matt', chapter: 1, verse: 1 }, { book: 'Rev', chapter: 22, verse: 3 }]) {
      expect(wide.locAt(shift(plain.indexOf(loc)!))).toEqual(loc);
    }
  });
  it('are left out entirely when not drawn', () => {
    expect(plain.indexOf({ book: 'Tob', chapter: 1, verse: 1 })).toBeUndefined();
    expect(plain.books.some((b) => b.beyond)).toBe(false);
  });
});
