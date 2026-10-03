import type { BibleBook, SpeakersInBook } from './types';

/** TIPNR's id for Jesus, as Glyssen's speakers are linked to it. */
export const JESUS = 'G2424G';

/** A stretch of a verse's text, [from, to) in characters. */
export type Span = [number, number];

interface Quote { from: number; to: number; carried: boolean; closed: boolean; jesus?: boolean }

/**
 * Who a quotation's attribution names, read from the narration beside it: the clause before it when that ends in a
 * comma or colon ("Jesus answered, “…”"), else the clause after it when the quotation ends mid-sentence ("“…?” He
 * asked."). The BSB capitalises the pronouns for Jesus, so "He" is him and "he" is not. Undefined when nothing
 * beside the quotation attributes it.
 */
function attributed(text: string, q: Quote, prevEnd: number, nextStart: number): boolean | undefined {
  const names = (clause: string) => /\b(Jesus|He)\b/.test(clause);
  const before = text.slice(prevEnd, q.from).trimEnd();
  if (/[,:]$/.test(before)) return names(before.slice(0, -1).split(/[.!?;,]/).pop()!);
  const inner = text.slice(q.from, q.to).replace(/[”’]+$/, '');
  const after = text.slice(q.to, nextStart);
  if (q.closed && /[,?!—]$/.test(inner) && after.trim()) return names(after.split(/[.!?;,:]/)[0]);
  return undefined;
}

/**
 * The words of Jesus in each verse of a book, for the reader to print in red: "ch.v" → spans. Glyssen says which
 * verses he speaks (`speakers/<Book>.json`, the 66 only); the BSB's quotation marks say which words. In a verse
 * only he speaks, all its quotations are his, and a quotation still open from the verse before carries on. In a verse
 * of dialogue, each quotation goes by its attribution; one with none goes with the quotation before it in the verse,
 * or, first in its verse, is his unless the next one that is attributed is his (they take turns: “If You are the
 * Christ, tell us.” Jesus answered, …). Quotations inside his speech (‘…’, and “…” inside those, as in his parables)
 * are part of it. Words the BSB does not put in quotation marks stay black even where Glyssen gives them to him
 * (Rev 22:14-15, after the BSB closes his words at 22:13).
 */
export function wordsOfJesus(bible: BibleBook, speakers: SpeakersInBook): Map<string, Span[]> {
  const out = new Map<string, Span[]>();
  let open = false, openIsJesus = false;
  const stack: string[] = []; // the quotation marks open, outermost first
  bible.chapters.forEach((verses, c) => {
    for (const v of verses) {
      const text = v.t ?? '';
      const key = `${c + 1}.${v.v}`;
      const who = (speakers[key] ?? []).filter((s) => !s.k);
      const jesus = who.some((s) => s.p === JESUS);
      const only = jesus && who.every((s) => s.p === JESUS);

      // The verse's outermost quotations, in order. A paragraph inside a speech opens again with the marks still
      // open (“‘), which carry on rather than nest.
      const quotes: Quote[] = [];
      let i = 0;
      if (stack.length) while (i < stack.length && text[i] === stack[i]) i++;
      let start = stack.length ? 0 : -1;
      for (; i < text.length; i++) {
        const ch = text[i], top = stack.at(-1);
        if (ch === '“' && top !== '“') { if (!stack.length) start = i; stack.push(ch); }
        else if (ch === '‘' && top === '“') stack.push(ch);
        // ’ is also the apostrophe ("God’s"); it closes a quotation only where no letter follows.
        else if (ch === '’' && top === '‘' && !/\p{L}/u.test(text[i + 1] ?? '')) stack.pop();
        else if (ch === '”' && top === '“') {
          stack.pop();
          if (!stack.length) { quotes.push({ from: start, to: i + 1, carried: start === 0 && open, closed: true }); start = -1; }
        }
      }
      if (start >= 0) quotes.push({ from: start, to: text.length, carried: start === 0 && open, closed: false });

      quotes.forEach((q, i) => {
        if (!jesus) q.jesus = false;
        else if (only) q.jesus = true;
        else if (q.carried) q.jesus = openIsJesus;
        else q.jesus = attributed(text, q, quotes[i - 1]?.to ?? 0, quotes[i + 1]?.from ?? text.length);
      });
      quotes.forEach((q, i) => {
        if (q.jesus !== undefined) return;
        if (i > 0) { q.jesus = quotes[i - 1].jesus; return; }
        const next = quotes.slice(1).find((r) => r.jesus !== undefined);
        q.jesus = !next?.jesus;
      });

      open = stack.length > 0;
      openIsJesus = open && !!quotes.at(-1)!.jesus;
      const spans = quotes.filter((q) => q.jesus).map((q): Span => [q.from, q.to]);
      if (spans.length) out.set(key, spans);
    }
  });
  return out;
}
