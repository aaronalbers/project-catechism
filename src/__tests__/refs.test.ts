import { describe, expect, it } from 'vitest';
import { contains, formatRef, locFromHash, parseRef, touchesChapter } from '@/lib/refs';

describe('parseRef', () => {
  it('parses single verses, ranges and chapters', () => {
    expect(parseRef('Matt.5.39')).toEqual({ start: { book: 'Matt', chapter: 5, verse: 39 }, end: { book: 'Matt', chapter: 5, verse: 39 } });
    expect(parseRef('Mark.14.3-9')?.end).toEqual({ book: 'Mark', chapter: 14, verse: 9 });
    expect(parseRef('Gen.6.9-9.19')?.end).toEqual({ book: 'Gen', chapter: 9, verse: 19 });
    expect(parseRef('Isa.9.6-Isa.9.7')?.end).toEqual({ book: 'Isa', chapter: 9, verse: 7 });
    expect(parseRef('Matt.1')?.end.verse).toBe(999);
    expect(parseRef('Nope.1.1')).toBeNull();
  });
  it('formats readably', () => {
    expect(formatRef('Matt.5.39')).toBe('Matthew 5:39');
    expect(formatRef('Mark.14.3-9')).toBe('Mark 14:3-9');
    expect(formatRef('Gen.6.9-9.19')).toBe('Genesis 6:9-9:19');
    expect(formatRef('Ps.23')).toBe('Psalms 23');
  });
  it('tests containment', () => {
    expect(contains('Mark.14.3-9', { book: 'Mark', chapter: 14, verse: 5 })).toBe(true);
    expect(contains('Mark.14.3-9', { book: 'Mark', chapter: 14, verse: 10 })).toBe(false);
    expect(contains('Gen.6.9-9.19', { book: 'Gen', chapter: 8, verse: 1 })).toBe(true);
    expect(touchesChapter('Gen.6.9-9.19', 'Gen', 7)).toBe(true);
    expect(touchesChapter('Gen.6.9-9.19', 'Gen', 10)).toBe(false);
  });
  it('reads route hashes', () => {
    expect(locFromHash('#/1Cor/13/4')).toEqual({ book: '1Cor', chapter: 13, verse: 4 });
    expect(locFromHash('#/Matt')).toEqual({ book: 'Matt', chapter: 1, verse: 1 });
    expect(locFromHash('#/foo')).toBeNull();
  });
});
