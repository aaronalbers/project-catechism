// Alphabet poems as the reader draws them: which letter of the Hebrew alphabet each verse (or stanza, or line)
// begins with, from content/acrostics.json.
import { ACROSTICS } from './content';
import { compareLoc, contains, parseRef, touchesChapter, type VerseLoc } from './refs';
import type { Acrostic, AcrosticLetter, InterlinearWord } from './types';

/** The twenty-two letters, with the names the BSB gives them in Psalm 119's headings. */
export const ALPHABET: { letter: string; name: string }[] = [
  ['א', 'Aleph'], ['ב', 'Beth'], ['ג', 'Gimel'], ['ד', 'Daleth'], ['ה', 'He'], ['ו', 'Waw'], ['ז', 'Zayin'], ['ח', 'Heth'],
  ['ט', 'Teth'], ['י', 'Yodh'], ['כ', 'Kaph'], ['ל', 'Lamedh'], ['מ', 'Mem'], ['נ', 'Nun'], ['ס', 'Samekh'], ['ע', 'Ayin'],
  ['פ', 'Pe'], ['צ', 'Tzade'], ['ק', 'Koph'], ['ר', 'Resh'], ['ש', 'Shin'], ['ת', 'Taw'],
].map(([letter, name]) => ({ letter, name }));
const NAME = new Map(ALPHABET.map((a) => [a.letter, a.name]));
export const letterName = (letter: string) => NAME.get(letter) ?? letter;
/** Where a letter falls in the alphabet: 1 for aleph, 22 for taw. */
export const letterNumber = (letter: string) => ALPHABET.findIndex((a) => a.letter === letter) + 1;

const FINAL: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
/** A Hebrew word's consonants, without vowels or accents, and with final forms as their ordinary letters. */
export const consonants = (w: string) => [...w.normalize('NFD')].filter((c) => c >= 'א' && c <= 'ת').map((c) => FINAL[c] ?? c).join('');
/** A verse's words in Hebrew order: the interlinear lists them in the English's. */
export const hebrewOrder = (words: InterlinearWord[]) => [...words].sort((a, b) => a[6] - b[6]);

export const acrosticsInChapter = (book: string, chapter: number) => ACROSTICS.filter((a) => touchesChapter(a.ref, book, chapter));
export const acrosticsFor = (loc: VerseLoc) => ACROSTICS.filter((a) => contains(a.ref, loc));

const start = (l: AcrosticLetter) => (l.ref ? parseRef(l.ref)!.start : null);
const sameVerse = (a: VerseLoc, b: VerseLoc) => compareLoc(a, b) === 0;

/** The letters that begin in this verse. */
export const lettersAt = (a: Acrostic, loc: VerseLoc) => a.letters.filter((l) => { const s = start(l); return !!s && sameVerse(s, loc); });

/**
 * The letters whose verses, stanzas or lines `loc` is in: those that begin in it, or else the last one begun
 * before it (a stanza runs on until the next letter). Empty outside the poem.
 */
export function lettersCovering(a: Acrostic, loc: VerseLoc): AcrosticLetter[] {
  if (!contains(a.ref, loc)) return [];
  const here = lettersAt(a, loc);
  if (here.length) return here;
  const before = a.letters.filter((l) => { const s = start(l); return !!s && compareLoc(s, loc) < 0; });
  return before.slice(-1);
}

/** Whether the reading has reached a letter yet (a missing letter is reached when the next letter is). */
export function reached(a: Acrostic, i: number, loc: VerseLoc): boolean {
  const next = a.letters.slice(i).find((l) => l.ref);
  const s = next && start(next);
  return !!s && compareLoc(s, loc) <= 0;
}
