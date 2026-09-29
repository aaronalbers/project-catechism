import { describe, expect, it } from 'vitest';
import { hebrewOf, overlapsAt, scrollMarksInChapter, seamsInChapter, strip } from '@/lib/scrolls';

describe('scrolls', () => {
  it('marks a break the Hebrew does not have at both ends of it, and none elsewhere', () => {
    expect(seamsInChapter('1Sam', 31).after?.to).toBe('2Sam');
    expect(seamsInChapter('2Sam', 1).before?.from).toBe('1Sam');
    expect(seamsInChapter('2Sam', 1).after).toBeNull();
    expect(seamsInChapter('1Sam', 30).after).toBeNull();
    // Samuel and Kings are two Hebrew books, so nothing runs on from 2 Samuel into 1 Kings.
    expect(seamsInChapter('2Sam', 24).after).toBeNull();
    expect(seamsInChapter('Ruth', 1)).toEqual({ before: null, after: null });
    expect(seamsInChapter('Matt', 1)).toEqual({ before: null, after: null });
    expect(seamsInChapter('Joel', 1).before?.h.kind).toBe('scroll');
  });
  it('counts the seams and repeated words in a chapter', () => {
    expect(scrollMarksInChapter('Ezra', 1)).toBe(1);
    expect(scrollMarksInChapter('Ezra', 10)).toBe(1);
    expect(scrollMarksInChapter('2Chr', 36)).toBe(1);
    expect(scrollMarksInChapter('Obad', 1)).toBe(2);
    expect(scrollMarksInChapter('Gen', 2)).toBe(0);
  });
  it('finds the repeated words from either end', () => {
    expect(overlapsAt({ book: '2Chr', chapter: 36, verse: 22 })[0]?.there).toBe('Ezra.1.1-3');
    expect(overlapsAt({ book: 'Ezra', chapter: 1, verse: 3 })[0]?.there).toBe('2Chr.36.22-23');
    expect(overlapsAt({ book: 'Ezra', chapter: 1, verse: 4 })).toEqual([]);
  });
  it('lays the English books and chapters of a Hebrew book end to end, with the verse being read on them', () => {
    const verses = new Map([['1Sam', [3, 2]], ['2Sam', [4]]]);
    const s = strip(hebrewOf('1Sam')!, verses, { book: '2Sam', chapter: 1, verse: 2 });
    expect(s.total).toBe(9);
    expect(s.english.map((x) => [x.start, x.end])).toEqual([[0, 5], [5, 9]]);
    expect(s.chapters.map((x) => x.start)).toEqual([0, 3, 5]);
    expect(s.greek?.map((x) => x.label)).toEqual(['1 Kingdoms', '2 Kingdoms']);
    expect(s.at).toBe(6);
    expect(strip(hebrewOf('Isa')!, new Map([['Isa', [5]]]), { book: 'Gen', chapter: 1, verse: 1 })).toMatchObject({ greek: null, at: null });
  });
});
