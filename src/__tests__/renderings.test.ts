// How the data build counts the BSB's renderings of each word (scripts/renderings.mjs).
import { describe, expect, it } from 'vitest';
import { core, fold, isContentWord } from '../../scripts/renderings.mjs';
import { inRendering } from '@/lib/words';

const counts = (o: Record<string, number>) => new Map(Object.entries(o));

describe('renderings', () => {
  it('reduces a gloss to the word’s own English', () => {
    expect(core('and let birds')).toBe('birds');
    expect(core('the LORD’s')).toBe('lord');
    expect(core('the LORD’s', true)).toBe('LORD');
    expect(core('[it was] very')).toBe('very');
    expect(core('. . .')).toBe('');
    expect(core('vvv')).toBe('');
    // A gloss of nothing but small words is itself the rendering.
    expect(core('who')).toBe('who');
    expect(core('For')).toBe('for');
  });
  it('folds phrases into the rendering they contain, and plurals into the singular', () => {
    const { list, at } = fold(counts({ birds: 46, bird: 16, flying: 4, 'every kind of bird': 1, 'fluttering birds': 1 }));
    expect(list).toEqual([['bird(s)', 64], ['flying', 4]]);
    expect(at.get('every kind of bird')).toBe(0);
    expect(at.get('fluttering birds')).toBe(0);
    expect(at.get('flying')).toBe(1);
  });
  it('folds irregular plurals and shows the BSB’s casing', () => {
    const { list } = fold(counts({ life: 124, lives: 37, soul: 175, souls: 20 }), new Map([['soul', 'Soul']]));
    expect(list).toEqual([['Soul(s)', 195], ['life/lives', 161]]);
  });
  it('does not fold a phrase into a rarer rendering it contains', () => {
    const { list } = fold(counts({ 'loving devotion': 171, devotion: 1 }));
    expect(list).toEqual([['loving devotion', 171], ['devotion', 1]]);
  });
  it('counts only nouns and adjectives other than names as content words', () => {
    expect(isContentWord('Conj-w | N-ms', 'H5775')).toBe(true);
    expect(isContentWord('N-proper-ms', 'H4872')).toBe(false);
    expect(isContentWord('V-Qal-Perf-3ms', 'H1696')).toBe(false);
    expect(isContentWord('N-NFS', 'G5590')).toBe(true);
    expect(isContentWord('V-PAI-3S', 'G3004')).toBe(false);
  });
  it('underlines the rendering, not the words round it', () => {
    expect(inRendering('birds', 'and let birds')).toBe(true);
    expect(inRendering('let', 'and let birds')).toBe(false);
    expect(inRendering('souls,', 'for your souls')).toBe(true);
  });
});
