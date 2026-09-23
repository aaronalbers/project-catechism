import { describe, expect, it } from 'vitest';
import { buildCanon } from '@/lib/circle';
import { BOOKS } from '@/lib/refs';

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
