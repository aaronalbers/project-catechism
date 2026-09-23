// Chiastic structure drawn on the text: a ladder inside the verse for phrase-level chiasms, and a
// margin rail with level headers and a structure strip for passage-level ones.
import type { CSSProperties, ReactNode } from 'react';
import { goTo, setState } from '@/app/store';
import { depth, levelAt, levelStart, levelTouches, partner, tone } from '@/lib/chiasm';
import { formatRef, type VerseLoc } from '@/lib/refs';
import type { Chiasm } from '@/lib/types';
import { ConfidenceBadge } from './SourceList';

/** Prime marks read better than apostrophes: C′ rather than C'. */
export const label = (s: string) => s.replace(/'/g, '′');

export const levelStyle = (c: Chiasm, i: number) => ({ '--depth': depth(c, i), '--tone': tone(c, i) }) as CSSProperties;

const showSources = () => setState({ tab: 'links', panelOpen: true });

function Toggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return <button className="chiasm-toggle" aria-pressed={show} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{show ? 'Hide structure' : 'Show structure'}</button>;
}

/** The line above a phrase-level chiasm naming it. */
export function ChiasmCaption({ c, show, onToggle }: { c: Chiasm; show: boolean; onToggle: () => void }) {
  return (
    <div className="chiasm-cap">
      <span className="kind">Chiasm</span>
      <button className="name" onClick={showSources} title="Summary and sources in the Links panel">{c.title}</button>
      <Toggle show={show} onToggle={onToggle} />
    </div>
  );
}

/** The whole passage-level structure at the top of a chapter it touches, set in a V by depth. */
export function ChiasmStrip({ c, loc, show, onToggle }: { c: Chiasm; loc: VerseLoc; show: boolean; onToggle: () => void }) {
  const here = levelAt(c, loc);
  return (
    <div className="chiasm-strip">
      <div className="chiasm-cap">
        <span className="kind">Chiasm</span>
        <button className="name" onClick={showSources} title="Summary and sources in the Links panel">{c.title}</button>
        <ConfidenceBadge c={c.confidence} />
        <Toggle show={show} onToggle={onToggle} />
      </div>
      {show && (
        <ol aria-label={`${c.title}: ${c.levels.length} levels`}>
          {c.levels.map((l, i) => {
            const start = levelStart(l);
            return (
              <li key={i} style={levelStyle(c, i)}>
                <button className={levelTouches(l, loc.book, loc.chapter) ? 'in-chapter' : undefined} aria-current={i === here || undefined}
                  title={`${label(l.label)} · ${l.text} (${formatRef(l.ref)})`} onClick={() => start && goTo(start)}>{label(l.label)}</button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Opens a passage-level level where it starts (or where this chapter picks it up), pointing at its mirror. */
export function LevelHeader({ c, i }: { c: Chiasm; i: number }) {
  const l = c.levels[i], j = partner(c, i), m = c.levels[j], start = levelStart(m);
  return (
    <div className={`chiasm-level${i === j ? ' centre' : ''}`} style={levelStyle(c, i)}>
      <span className="lbl">{label(l.label)}</span>
      <span className="t">{l.text}</span>
      {i === j
        ? <span className="pair">turning point</span>
        : <button className="chip link pair" onClick={() => start && goTo(start)} title={m.text}>↔ {label(m.label)} · {formatRef(m.ref)}</button>}
    </div>
  );
}

/** One level of a phrase-level ladder; hovering it lights its mirror. */
export function Rung({ c, i, pair, onPair, children }: { c: Chiasm; i: number; pair: string | null; onPair: (k: string | null) => void; children: ReactNode }) {
  const key = `${c.id}:${depth(c, i)}`;
  const centre = depth(c, i) === Math.floor((c.levels.length - 1) / 2);
  return (
    <span className={`rung${centre ? ' centre' : ''}${pair === key ? ' paired' : ''}`} style={levelStyle(c, i)}
      onMouseEnter={() => onPair(key)} onMouseLeave={() => onPair(null)}>
      <span className="lbl" aria-hidden="true">{label(c.levels[i].label)}</span>
      <span>{children}</span>
    </span>
  );
}
