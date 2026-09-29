import { describe, expect, it } from 'vitest';
import { BEYOND, bookByName, contains, formatRef, locFromHash, neighbourBook, parseRef, touchesChapter } from '@/lib/refs';

describe('parseRef', () => {
  it('parses single verses, ranges and chapters', () => {
    expect(parseRef('Matt.5.39')).toEqual({ start: { book: 'Matt', chapter: 5, verse: 39 }, end: { book: 'Matt', chapter: 5, verse: 39 } });
    expect(parseRef('Mark.14.3-9')?.end).toEqual({ book: 'Mark', chapter: 14, verse: 9 });
    expect(parseRef('Gen.6.9-9.19')?.end).toEqual({ book: 'Gen', chapter: 9, verse: 19 });
    expect(parseRef('Isa.9.6-Isa.9.7')?.end).toEqual({ book: 'Isa', chapter: 9, verse: 7 });
    expect(parseRef('Matt.1')?.end.verse).toBe(999);
    expect(parseRef('Nope.1.1')).toBeNull();
    expect(parseRef('Gen.1-2')).toEqual({ start: { book: 'Gen', chapter: 1, verse: 1 }, end: { book: 'Gen', chapter: 2, verse: 999 } });
    expect(parseRef('Gen.1-2.5')?.end).toEqual({ book: 'Gen', chapter: 2, verse: 5 });
  });
  it('formats readably', () => {
    expect(formatRef('Matt.5.39')).toBe('Matthew 5:39');
    expect(formatRef('Mark.14.3-9')).toBe('Mark 14:3-9');
    expect(formatRef('Gen.6.9-9.19')).toBe('Genesis 6:9-9:19');
    expect(formatRef('Ps.23')).toBe('Psalms 23');
    expect(formatRef('Gen.1-2')).toBe('Genesis 1-2');
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
    expect(locFromHash('#/Jude/9/0')).toEqual({ book: 'Jude', chapter: 1, verse: 1 });
  });
});

describe('books beyond the 66', () => {
  it('parse, format and route like any other book', () => {
    expect(parseRef('2Macc.6.18-7.42')).toEqual({ start: { book: '2Macc', chapter: 6, verse: 18 }, end: { book: '2Macc', chapter: 7, verse: 42 } });
    expect(formatRef('1En.1.9')).toBe('1 Enoch 1:9');
    expect(locFromHash('#/EsthGr/1/1')).toEqual({ book: 'EsthGr', chapter: 1, verse: 1 });
    expect(bookByName('Ecclesiasticus')?.id).toBe('Sir');
    expect(bookByName('1 Enoch')?.id).toBe('1En');
  });
  it('lie outside every range between books of the 66', () => {
    expect(contains('Mal.4.5-Matt.1.2', { book: 'Tob', chapter: 1, verse: 1 })).toBe(false);
    expect(contains('Mal.4.5-Matt.1.2', { book: 'Matt', chapter: 1, verse: 1 })).toBe(true);
    expect(touchesChapter('Mal.4-Matt.1', 'Jub', 1)).toBe(false);
  });
  it('are read on among themselves, never into the 66', () => {
    expect(neighbourBook('Mal', 1)?.id).toBe('Matt');
    expect(neighbourBook('Matt', -1)?.id).toBe('Mal');
    expect(neighbourBook(BEYOND[0].id, -1)).toBeUndefined();
    expect(neighbourBook(BEYOND[0].id, 1)?.id).toBe(BEYOND[1].id);
    expect(neighbourBook(BEYOND.at(-1)!.id, 1)).toBeUndefined();
  });
});
