// The words of Jesus, printed in red: Glyssen's speakers (public/data/speakers/) and the BSB's quotation marks.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wordsOfJesus } from '@/lib/redletter';
import type { BibleBook, SpeakersInBook } from '@/lib/types';

const data = new URL('../../public/data/', import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, data), 'utf8')) as T;
const books = new Map<string, Map<string, [number, number][]>>();
/** The red words of a verse, quotation by quotation. */
const red = (book: string, ch: number, v: number) => {
  const bible = read<BibleBook>(`bible/${book}.json`);
  const words = books.get(book) ?? books.set(book, wordsOfJesus(bible, read<SpeakersInBook>(`speakers/${book}.json`))).get(book)!;
  const t = bible.chapters[ch - 1].find((x) => x.v === v)!.t;
  return (words.get(`${ch}.${v}`) ?? []).map(([a, z]) => t.slice(a, z));
};

describe.skipIf(!existsSync(new URL('speakers/', data)))('red letters', () => {
  it('colours his quotations and not the narration round them', () => {
    expect(red('Matt', 4, 4)).toEqual(['“It is written: ‘Man shall not live on bread alone, but on every word that comes from the mouth of God.’”']);
    expect(red('John', 8, 39)).toEqual(['“If you were children of Abraham,”', '“you would do the works of Abraham.']);
  });
  it('tells his words from others’ in a verse of dialogue by the attribution', () => {
    expect(red('Matt', 26, 25)).toEqual(['“You have said it yourself.”']); // Then Judas, who would betray Him, said, …
    expect(red('Matt', 27, 11)).toEqual(['“You have said so,”']); // the governor, who questioned Him: …
    expect(red('Luke', 8, 25)).toEqual(['“Where is your faith?”']); // … they asked one another, “Who is this? He commands …”
    expect(red('Mark', 10, 49)).toEqual(['“Call him.”']); // “Take courage!” they said. “Get up! …”
    expect(red('John', 20, 15)).toEqual(['“Woman, why are you weeping?”', '“Whom are you seeking?”']);
    expect(red('John', 12, 28)).toEqual(['Father, glorify Your name!”']); // not the voice from heaven
  });
  it('gives an unattributed quotation to the speaker whose turn it is', () => {
    expect(red('Luke', 18, 41)).toEqual(['“What do you want Me to do for you?”']); // “Lord,” he said, …
    expect(red('Luke', 22, 67)).toEqual(['“If I tell you, you will not believe.']); // “If You are the Christ, tell us.” Jesus answered, …
    expect(red('Matt', 21, 16)).toEqual(['“Yes,”', '“Have you never read: ‘From the mouths of children and infants You have ordained praise’?”']);
  });
  it('carries a speech across verses, and through the quotations inside it', () => {
    expect(red('Matt', 13, 51)).toEqual(['Have you understood all these things?”']);
    expect(red('Matt', 22, 45)).toEqual(['So if David calls Him ‘Lord,’ how can He be David’s son?”']); // after “ ‘ “ ” ’ in 22:44
    expect(red('Luke', 15, 25)).toEqual(['Meanwhile the older son was in the field, and as he approached the house, he heard music and dancing.']);
    expect(red('Rev', 22, 11)).toEqual([]); // the angel's, from 22:10
  });
});
