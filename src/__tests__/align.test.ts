import { describe, expect, it } from 'vitest';
import { alignVerse, tokenize } from '@/lib/align';
import type { InterlinearVerse } from '@/lib/types';

const verse = (glosses: string[]): InterlinearVerse => ({ v: 1, w: glosses.map((g) => ['', '', '', '', '', g, 0, '']) });

describe('alignVerse', () => {
  it('gives each phrase gloss its own run of words (Lev 24:20)', () => {
    const il = verse(['fracture', 'for', 'fracture', 'eye', 'for', 'eye', 'tooth', 'for', 'tooth', 'Just as', 'he injured', '. . .', 'the other person', 'the same', 'must be inflicted', 'on him']);
    const text = 'fracture for fracture, eye for eye, tooth for tooth. Just as he injured the other person, the same must be inflicted on him.';
    const words = text.split(/\s+/);
    const a = alignVerse(text, il);
    const run = (i: number) => words.filter((_, j) => a[j] === i).join(' ');
    expect(run(12)).toBe('the other person,');
    expect(run(13)).toBe('the same');
    expect(run(14)).toBe('must be inflicted');
    // Repeated words pair off in order, however far the Hebrew and English positions drift apart.
    expect(a.slice(0, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('matches across em-dashes, numbers, hyphens and closing quotes', () => {
    const glosses = (text: string, il: InterlinearVerse) => {
      const a = alignVerse(text, il);
      return tokenize(text).filter((t) => t.trim()).map((w, j) => `${w}=${a[j] === null ? '' : il.w[a[j]!][5]}`);
    };
    expect(glosses('his robe—the robe', verse(['his robe', 'the robe']))).toEqual(['his=his robe', 'robe—=his robe', 'the=the robe', 'robe=the robe']);
    expect(glosses('and 10,000 cubits', verse(['and 10,000 cubits']))).toEqual(['and=and 10,000 cubits', '10,000=and 10,000 cubits', 'cubits=and 10,000 cubits']);
    expect(glosses('in a sun-scorched land', verse(['in a sun-scorched land']))).toEqual(['in=in a sun-scorched land', 'a=in a sun-scorched land', 'sun-scorched=in a sun-scorched land', 'land=in a sun-scorched land']);
    expect(glosses('‘We will not walk in it!’', verse(['We will not', 'walk in it']))).toEqual(['‘We=We will not', 'will=We will not', 'not=We will not', 'walk=walk in it', 'in=walk in it', 'it!’=walk in it']);
  });
  it('falls back to the nearest single-word match', () => {
    const a = alignVerse('for him and for her', verse(['for', 'him', 'and', 'for', 'her']));
    expect(a).toEqual([0, 1, 2, 3, 4]);
  });
});
