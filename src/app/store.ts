import { useEffect, useSyncExternalStore } from 'react';
import { hashFromLoc, locFromHash, sameLoc, type VerseLoc } from '@/lib/refs';
import { readStored, writeStored } from '@/lib/storage';

export type PanelTab = 'insights' | 'words' | 'places' | 'people' | 'links' | 'models' | 'videos';
export type Theme = 'system' | 'light' | 'dark';

export interface State {
  loc: VerseLoc;
  /** Word index within the current verse the user tapped, or null. */
  wordIndex: number | null;
  tab: PanelTab;
  panelOpen: boolean;
  theme: Theme;
  /** Follows the audio reader when playing. */
  playing: boolean;
  /** The feature index is open (`#/index`), scrolled to a section id when not ''; null when reading. */
  index: string | null;
  /** Set by a link that goes to a feature rather than a verse, for the reader to bring it into view; cleared by the next `goTo`. */
  reveal: Reveal | null;
  /** Element id of the panel card a link goes to (`model-temple`), for the panel to scroll to; cleared once it has, or by the next `goTo`. */
  feature: string | null;
}
export type Reveal = 'chiasm';

/** Route hash for the index: #/index or #/index/models. */
function indexFromHash(hash: string): string | null {
  const m = /^#\/index(?:\/([a-z-]+))?$/.exec(hash);
  return m ? (m[1] ?? '') : null;
}
const hashFromIndex = (section: string) => `#/index${section ? `/${section}` : ''}`;

let state: State = {
  loc: locFromHash(location.hash) ?? readStored<VerseLoc>('loc', { book: 'Matt', chapter: 1, verse: 1 }),
  wordIndex: null,
  tab: readStored<PanelTab>('tab', 'insights'),
  panelOpen: true,
  theme: readStored<Theme>('theme', 'system'),
  playing: false,
  index: indexFromHash(location.hash),
  reveal: null,
  feature: null,
};

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  if (p.loc) writeStored('loc', state.loc);
  if (p.loc || p.index !== undefined) {
    const h = state.index !== null ? hashFromIndex(state.index) : hashFromLoc(state.loc);
    // Opening the index adds a history entry, so Back returns to the verse.
    const opening = state.index !== null && indexFromHash(location.hash) === null;
    if (location.hash !== h) history[opening ? 'pushState' : 'replaceState'](null, '', h);
  }
  if (p.tab) writeStored('tab', state.tab);
  if (p.theme) writeStored('theme', state.theme);
  emit();
}

export function goTo(loc: VerseLoc, opts: { openTab?: PanelTab; reveal?: Reveal; feature?: string } = {}) {
  setState({ loc, wordIndex: null, index: null, reveal: opts.reveal ?? null, feature: opts.feature ?? null, ...(opts.openTab ? { tab: opts.openTab, panelOpen: true } : {}) });
}

function fromHash() {
  const index = indexFromHash(location.hash);
  if (index !== null) { if (index !== state.index) setState({ index }); return; }
  // Back fires both events; the second finds the verse already set.
  const loc = locFromHash(location.hash);
  if (loc && (state.index !== null || !sameLoc(loc, state.loc))) goTo(loc);
}
window.addEventListener('hashchange', fromHash);
window.addEventListener('popstate', fromHash);

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => select(state), () => select(state));
}
export const getState = () => state;

/**
 * In a panel: scroll the card a link went to into view, when the panel has it. It jumps rather than
 * glides: Chrome runs one smooth scrollIntoView at a time, and the reader's, to the verse, cancels it.
 */
export function useFeatureInView() {
  const feature = useStore((s) => s.feature);
  useEffect(() => {
    const el = feature && document.getElementById(feature);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    setState({ feature: null });
  });
}
