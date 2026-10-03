// The context panel's panes: on a wide screen it holds as many as fit, stacked or side by side, each
// showing one tab (so never more panes than tabs). Every panel derives its contents from the location
// alone, so panes need no coordinating; this only decides which tab shows where. The layout is a
// per-device preference, kept in localStorage, not in the URL.
import { useSyncExternalStore } from 'react';
import type { PanelTab } from '@/app/store';

export interface Pane {
  tab: PanelTab;
  /** Its share of the panel, relative to the other panes' (flex-grow). */
  size: number;
}
export interface Layout {
  panes: Pane[];
  /** Stacked (`rows`) or side by side (`cols`). */
  split: 'rows' | 'cols';
  /** The panel column's width in px, beside the reader. */
  width: number;
}

/** Narrower than this and the panel sits under the reader and shows one pane (the CSS breakpoint). */
export const NARROW_PX = 900;
/**
 * Narrower than this (a phone) and the reader is a tab too: one view fills the screen, and the tabs,
 * with the play button, sit in a bar at the bottom.
 */
export const COMPACT_PX = 640;
/** The least the reader keeps beside the panel, and the least a pane side by side gets. */
export const READER_MIN_PX = 440;
export const PANEL_MIN_PX = 320;
export const PANE_MIN_PX = 300;
/** The least a stacked pane gets in height, tab strip included. */
export const PANE_MIN_H_PX = 200;
export const DEFAULT_LAYOUT: Layout = { panes: [{ tab: 'insights', size: 1 }], split: 'rows', width: 420 };

/** A stored layout, or the default when it is missing or malformed; `tab` is the single tab older versions kept. */
export function readLayout(stored: unknown, tab: PanelTab | null): Layout {
  const l = stored as Partial<Layout> | null;
  if (l && Array.isArray(l.panes) && l.panes.length && l.panes.every((p) => typeof p?.tab === 'string' && p.size > 0) && new Set(l.panes.map((p) => p.tab)).size === l.panes.length)
    return { panes: l.panes, split: l.split === 'cols' ? 'cols' : 'rows', width: typeof l.width === 'number' ? l.width : DEFAULT_LAYOUT.width };
  return tab ? { ...DEFAULT_LAYOUT, panes: [{ tab, size: 1 }] } : DEFAULT_LAYOUT;
}

/**
 * Where a tab goes when a link asks for it: the pane already showing it, or else, on a wide screen,
 * the pane used least recently (so the one being read is left alone), and on a narrow screen the one
 * pane shown. Returns the panes and the index of the pane that now shows the tab.
 */
export function place(panes: Pane[], tab: PanelTab, used: number[], focus: number, narrow: boolean): { panes: Pane[]; at: number } {
  const at = panes.findIndex((p) => p.tab === tab);
  if (at >= 0) return { panes, at };
  let lru = Math.min(focus, panes.length - 1);
  if (!narrow) panes.forEach((_, i) => { if ((used[i] ?? 0) < (used[lru] ?? 0)) lru = i; });
  return { panes: panes.map((p, i) => (i === lru ? { ...p, tab } : p)), at: lru };
}

/** A tab picked in pane `i`: shown there, and if another pane had it, that pane takes this one's tab instead. */
export function choose(panes: Pane[], i: number, tab: PanelTab): Pane[] {
  const j = panes.findIndex((p) => p.tab === tab);
  return panes.map((p, k) => (k === i ? { ...p, tab } : k === j ? { ...p, tab: panes[i].tab } : p));
}

/** The panel's width on this viewport: the chosen width, kept from squeezing the reader. */
export function panelWidth(layout: Layout, viewport: number): number {
  return Math.max(PANEL_MIN_PX, Math.min(layout.width, viewport - READER_MIN_PX));
}

/**
 * How many panes fit: side by side in `width` px, or stacked in `height` px. Pass the panel's width to
 * learn how many it shows, or the most it could widen to (`viewport - READER_MIN_PX`) for how many it could hold.
 */
export function fitting(split: Layout['split'], width: number, height: number): number {
  return Math.max(1, Math.floor(split === 'cols' ? width / PANE_MIN_PX : height / PANE_MIN_H_PX));
}

/**
 * The panes shown when only `fits` of them fit (one on a narrow screen): the ones used most recently,
 * the pane in use always among them, in their layout order. The rest are kept, not closed; a link to a
 * tab one of them holds brings it back.
 */
export function visible(count: number, used: number[], focus: number, fits: number): number[] {
  const all = [...Array(count).keys()];
  if (fits >= count) return all;
  const rank = (i: number) => (i === focus ? Infinity : used[i] ?? 0);
  return all.sort((a, b) => rank(b) - rank(a) || a - b).slice(0, fits).sort((a, b) => a - b);
}

const subscribe = (cb: () => void) => { addEventListener('resize', cb); return () => removeEventListener('resize', cb); };
/** The viewport's width, kept current on resize. */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, () => innerWidth, () => innerWidth);
}
export const isNarrow = (viewport = innerWidth) => viewport <= NARROW_PX;
export const isCompact = (viewport = innerWidth) => viewport <= COMPACT_PX;

/**
 * What a link in a card or caption does. While the audio reads, the verse belongs to it, so the link
 * opens a preview instead of moving the reader away. Otherwise it goes there; and on a phone showing a
 * panel, where the reader is out of sight, it also nudges the Reader tab, so it is clear the text moved.
 */
export function linkAction(playing: boolean, compact: boolean, panelShown: boolean): 'preview' | 'go' | 'go-nudge' {
  if (playing) return 'preview';
  return compact && panelShown ? 'go-nudge' : 'go';
}
