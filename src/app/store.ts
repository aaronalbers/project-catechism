import { useEffect, useSyncExternalStore } from 'react';
import { hashFromLoc, locFromHash, parseRef, sameLoc, type VerseLoc } from '@/lib/refs';
import type { Ref } from '@/lib/types';
import { readStored, writeStored } from '@/lib/storage';
import { choose, isCompact, isNarrow, linkAction, place, readLayout, type Layout } from '@/lib/panes';

export type PanelTab = 'insights' | 'words' | 'places' | 'people' | 'links' | 'models' | 'videos' | 'reigns' | 'days' | 'scrolls' | 'worth' | 'sky';
/** Which reconstruction dates the kings (a reading's id, 'thiele' first), or 'stated' for the stated lengths laid end to end. */
export type ReignDates = string;
export type Theme = 'system' | 'light' | 'dark';

export interface State {
  loc: VerseLoc;
  /** Word index within the current verse the user tapped, or null. */
  wordIndex: number | null;
  /** The context panel's panes, their tabs and sizes (see `src/lib/panes.ts`). */
  layout: Layout;
  /** The pane last used, and the only one shown on a narrow screen. */
  focus: number;
  /** When each pane was last focused (a counter), so a link replaces the one used least recently. */
  used: number[];
  /** Bumped when a link sends a tab to a pane, for that pane to flash where it landed. */
  lit: number;
  /** The panel is showing; on a phone, where the reader is a tab too, false means the Reader tab is. */
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
  /** How the reign charts date the kings, inline and in the Reign tab alike. */
  reignDates: ReignDates;
  /** Which weekday the three days' charts put the crucifixion on (a reading's id in `passion.json`), inline and in the Days tab alike. */
  passionReading: string;
  /** The person whose profile the People tab shows (a generated person's id), or null for the chapter's list. It outlives `goTo`, so a verse in a profile can be read with the profile still open. */
  person: string | null;
  /** A passage a link asked for while the audio was reading, shown in a preview rather than gone to. */
  preview: { ref: Ref; opts: GoOpts } | null;
  /** Bumped when a link moves the text while a phone shows a panel, for the Reader tab to flash. */
  nudge: number;
}
export type Reveal = 'chiasm' | 'acrostic' | 'tally' | 'reign' | 'passion' | 'price';

/** Route hash for the index: #/index or #/index/models. */
function indexFromHash(hash: string): string | null {
  const m = /^#\/index(?:\/([a-z-]+))?$/.exec(hash);
  return m ? (m[1] ?? '') : null;
}
const hashFromIndex = (section: string) => `#/index${section ? `/${section}` : ''}`;

// The stored verse goes through the hash's checks too, so one saved under a book id since renamed is dropped.
const storedLoc = readStored<VerseLoc | null>('loc', null);
let state: State = {
  loc: locFromHash(location.hash) ?? (storedLoc && locFromHash(hashFromLoc(storedLoc))) ?? { book: 'Matt', chapter: 1, verse: 1 },
  wordIndex: null,
  layout: readLayout(readStored<unknown>('layout', null), readStored<PanelTab | null>('tab', null)),
  focus: 0,
  used: [],
  lit: 0,
  // A phone opens on the text; the panel is a tab away.
  panelOpen: !isCompact(),
  theme: readStored<Theme>('theme', 'system'),
  playing: false,
  index: indexFromHash(location.hash),
  reveal: null,
  feature: null,
  reignDates: readStored<ReignDates>('reign-dates', 'thiele'),
  passionReading: readStored<string>('passion-reading', 'friday'),
  person: null,
  preview: null,
  nudge: 0,
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
  if (p.layout) writeStored('layout', state.layout);
  if (p.theme) writeStored('theme', state.theme);
  if (p.reignDates) writeStored('reign-dates', state.reignDates);
  if (p.passionReading) writeStored('passion-reading', state.passionReading);
  emit();
}

let stamp = 0;
const focusing = (s: State, i: number): Partial<State> => ({ focus: i, used: Object.assign([...s.used], { [i]: ++stamp }) });

/** Shows a tab: brings forward the pane that has it, or puts it in the pane used least recently. */
function showing(s: State, tab: PanelTab): Partial<State> {
  const { panes, at } = place(s.layout.panes, tab, s.used, s.focus, isNarrow());
  return { layout: { ...s.layout, panes }, ...focusing(s, at), lit: s.lit + 1, panelOpen: true };
}
export function openTab(tab: PanelTab, patch: Partial<State> = {}) { setState((s) => ({ ...patch, ...showing(s, tab) })); }

/** Opens someone's profile in the People tab. */
export function openPerson(id: string) { openTab('people', { person: id }); }

/**
 * A tab clicked in pane `i`'s strip. On a narrow screen, one showing in a hidden pane brings that pane forward,
 * and the tab already showing folds the panel away; on a phone the Reader tab does that instead.
 */
export function pickTab(i: number, tab: PanelTab) {
  setState((s) => {
    const j = s.layout.panes.findIndex((p) => p.tab === tab);
    if (j === i && isCompact()) return { panelOpen: true };
    if (j === i && (s.layout.panes.length === 1 || isNarrow())) return { panelOpen: !s.panelOpen };
    if (j >= 0 && isNarrow()) return { ...focusing(s, j), panelOpen: true };
    return { layout: { ...s.layout, panes: choose(s.layout.panes, i, tab) }, ...focusing(s, i), panelOpen: true };
  });
}
/** Marks a pane as the one in use, when the reader clicks in it. */
export function focusPane(i: number) { if (state.focus !== i) setState((s) => focusing(s, i)); }

export function addPane(tab: PanelTab) {
  setState((s) => {
    const panes = s.layout.panes;
    if (panes.some((p) => p.tab === tab)) return {};
    const size = panes.reduce((a, p) => a + p.size, 0) / panes.length;
    return { layout: { ...s.layout, panes: [...panes, { tab, size }] }, ...focusing(s, panes.length) };
  });
}
export function closePane(i: number) {
  setState((s) => {
    if (s.layout.panes.length < 2) return {};
    const used = s.used.filter((_, k) => k !== i);
    return { layout: { ...s.layout, panes: s.layout.panes.filter((_, k) => k !== i) }, used, focus: Math.max(0, s.focus > i ? s.focus - 1 : Math.min(s.focus, s.layout.panes.length - 2)) };
  });
}
export function setLayout(patch: Partial<Layout>) { setState((s) => ({ layout: { ...s.layout, ...patch } })); }

export interface GoOpts { openTab?: PanelTab; reveal?: Reveal; feature?: string; patch?: Partial<State> }

/** Moves the reader, and every panel with it. Links go through `follow`, and deliberate moves through `leave`. */
export function goTo(loc: VerseLoc, opts: GoOpts = {}) {
  setState((s) => ({ loc, wordIndex: null, index: null, reveal: opts.reveal ?? null, feature: opts.feature ?? null, preview: null, ...opts.patch, ...(opts.openTab ? showing(s, opts.openTab) : {}) }));
}

let halt = () => {};
/** The audio reader registers how to stop it, for `leave` (the store cannot import it: it imports the store). */
export function whenLeaving(stop: () => void) { halt = stop; }

/** A move the reader chose (the chapter picker, the next chapter, Back): it stops the audio and goes. */
export function leave(loc: VerseLoc, opts: GoOpts = {}) {
  halt();
  goTo(loc, opts);
}

const refOf = (l: VerseLoc): Ref => `${l.book}.${l.chapter}.${l.verse}`;

/**
 * A link in a card, a chart or a caption, to a passage (`ref`, or a verse). While the audio reads, it opens
 * a preview of the passage and leaves the verse to the audio; otherwise it goes there (see `linkAction`).
 */
export function follow(to: Ref | VerseLoc, opts: GoOpts = {}) {
  const ref = typeof to === 'string' ? to : refOf(to);
  const r = parseRef(ref);
  if (!r) return;
  const action = linkAction(state.playing, isCompact(), state.panelOpen);
  if (action === 'preview') { setState({ preview: { ref, opts } }); return; }
  goTo(r.start, opts);
  if (action === 'go-nudge' && !opts.openTab) setState((s) => ({ nudge: s.nudge + 1 }));
}

/**
 * Opens `tab` at the card (`feature`) a caption in the reader names. A tab shows only what the current verse is
 * in, so unless it is `here`, the reader first goes to `at`, the verse the caption stands at.
 */
export function openCard(tab: PanelTab, feature: string | undefined, here: boolean, at: VerseLoc) {
  if (here) openTab(tab, { feature: feature ?? null }); else follow(at, { openTab: tab, feature });
}

function fromHash() {
  const index = indexFromHash(location.hash);
  if (index !== null) { if (index !== state.index) setState({ index }); return; }
  // Back fires both events; the second finds the verse already set.
  const loc = locFromHash(location.hash);
  if (loc && (state.index !== null || !sameLoc(loc, state.loc))) leave(loc);
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
