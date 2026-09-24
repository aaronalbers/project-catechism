import { useSyncExternalStore } from 'react';
import { hashFromLoc, locFromHash, type VerseLoc } from '@/lib/refs';

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
}

/** Route hash for the index: #/index or #/index/models. */
function indexFromHash(hash: string): string | null {
  const m = /^#\/index(?:\/([a-z-]+))?$/.exec(hash);
  return m ? (m[1] ?? '') : null;
}
const hashFromIndex = (section: string) => `#/index${section ? `/${section}` : ''}`;

const stored = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };

let state: State = {
  loc: locFromHash(location.hash) ?? stored('loc', { book: 'Matt', chapter: 1, verse: 1 }),
  wordIndex: null,
  tab: stored('tab', 'insights'),
  panelOpen: true,
  theme: stored('theme', 'system'),
  playing: false,
  index: indexFromHash(location.hash),
};

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  if (p.loc) try { localStorage.setItem('loc', JSON.stringify(state.loc)); } catch { /* private mode */ }
  if (p.loc || p.index !== undefined) {
    const h = state.index !== null ? hashFromIndex(state.index) : hashFromLoc(state.loc);
    // Opening the index adds a history entry, so Back returns to the verse.
    const opening = state.index !== null && indexFromHash(location.hash) === null;
    if (location.hash !== h) history[opening ? 'pushState' : 'replaceState'](null, '', h);
  }
  if (p.tab) try { localStorage.setItem('tab', JSON.stringify(state.tab)); } catch { /* ignore */ }
  if (p.theme) try { localStorage.setItem('theme', JSON.stringify(state.theme)); } catch { /* ignore */ }
  emit();
}

export function goTo(loc: VerseLoc, opts: { openTab?: PanelTab } = {}) {
  setState({ loc, wordIndex: null, index: null, ...(opts.openTab ? { tab: opts.openTab, panelOpen: true } : {}) });
}

function fromHash() {
  const index = indexFromHash(location.hash);
  if (index !== null) { if (index !== state.index) setState({ index }); return; }
  const loc = locFromHash(location.hash);
  if (loc) setState({ loc, wordIndex: null, index: null });
}
window.addEventListener('hashchange', fromHash);
window.addEventListener('popstate', fromHash);

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => select(state), () => select(state));
}
export const getState = () => state;
