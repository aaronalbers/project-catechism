import { core } from '../../scripts/renderings.mjs';
import { NARROWED } from './content';
import type { Insight, InterlinearWord } from './types';

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

/** The word card to mark an English word with: when it renders a word the card studies, in one of the renderings that narrow it. */
export function narrowedToken(token: string, w: InterlinearWord): Insight | undefined {
  const card = NARROWED.get(w[4]);
  const t = norm(token);
  return card && inRendering(token, w[5]) && card.narrows!.rendered.some((r) => isForm(t, r.toLowerCase())) ? card : undefined;
}

/** The word card to mark an interlinear word with, when the BSB renders it here in a way that narrows it. */
export const narrowedWord = (w: InterlinearWord) => core(w[5]).split(' ').some((t) => narrowedToken(t, w)) ? NARROWED.get(w[4]) : undefined;
