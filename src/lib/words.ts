import { core } from '../../scripts/renderings.mjs';
import { NARROWED } from './content';
import type { Insight, InterlinearVerse, InterlinearWord } from './types';

export { RARE } from '../../scripts/renderings.mjs';

const norm = (t: string) => t.toLowerCase().replace(/[^a-z'’-]/g, '').replace(/^['’]+|['’]+$/g, '').replace(/['’]s$/, '');
/** A word of the English is a rendering in the singular or plural: "birds" and "lives" are "bird" and "life". */
const isForm = (t: string, r: string) => [t, t.replace(/e?s$/, ''), t.replace(/ies$/, 'y'), t.replace(/ves$/, 'fe'), t.replace(/ves$/, 'f')].includes(r);

/**
 * Whether a word of the English is part of its interlinear word's own rendering, as the renderings count it:
 * "birds" in the gloss "the birds", but not "the".
 */
export function inRendering(token: string, gloss: string) {
  const t = norm(token);
  return !!t && core(gloss).split(' ').includes(t);
}

/** A verb in the imperative: Hebrew "V-Qal-Imp-ms", Greek "V-PMA-2P" (tense, mood, voice). */
const isCommand = (morph: string) => /-Imp(-|$)/.test(morph) || /^V-[A-Z]M[A-Z]-/.test(morph);

/** Whether a card that marks only some uses of its word (`narrows.only`) marks this one. */
function markedUse(card: Insight, w: InterlinearWord, verse: InterlinearVerse) {
  const only = card.narrows!.only;
  if (!only) return true;
  if (only.command && isCommand(w[2])) return true;
  if (!only.before) return false;
  // The next word in the original's order that has a Strong's number, not the next in English order.
  const next = verse.w.filter((x) => x[4] && x[6] > w[6]).sort((a, b) => a[6] - b[6])[0];
  return !!next && next[4] === only.before && /\bPrep/.test(next[2]);
}

/** The word card to mark an English word with: when it renders a word the card studies, in one of the renderings that narrow it. */
export function narrowedToken(token: string, w: InterlinearWord, verse: InterlinearVerse): Insight | undefined {
  const card = NARROWED.get(w[4]);
  const t = norm(token);
  return card && inRendering(token, w[5]) && card.narrows!.rendered.some((r) => isForm(t, r.toLowerCase())) && markedUse(card, w, verse) ? card : undefined;
}

/** The word card to mark an interlinear word with, when the BSB renders it here in a way that narrows it. */
export const narrowedWord = (w: InterlinearWord, verse: InterlinearVerse) => core(w[5]).split(' ').some((t) => narrowedToken(t, w, verse)) ? NARROWED.get(w[4]) : undefined;
