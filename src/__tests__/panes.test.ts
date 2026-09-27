import { describe, expect, it } from 'vitest';
import { choose, effectiveSplit, panelWidth, place, readLayout, type Layout, type Pane } from '@/lib/panes';

const panes = (...tabs: Pane['tab'][]): Pane[] => tabs.map((tab) => ({ tab, size: 1 }));
const tabs = (ps: Pane[]) => ps.map((p) => p.tab);

describe('place', () => {
  it('brings forward the pane already showing the tab', () => {
    const r = place(panes('links', 'words'), 'words', [2, 1], 0, false);
    expect(r.at).toBe(1);
    expect(tabs(r.panes)).toEqual(['links', 'words']);
  });
  it('replaces the pane used least recently on a wide screen', () => {
    const r = place(panes('links', 'words', 'insights'), 'reigns', [3, 1, 2], 0, false);
    expect(r.at).toBe(1);
    expect(tabs(r.panes)).toEqual(['links', 'reigns', 'insights']);
  });
  it('replaces the one pane shown on a narrow screen', () => {
    const r = place(panes('links', 'words'), 'reigns', [1, 2], 0, true);
    expect(r.at).toBe(0);
    expect(tabs(r.panes)).toEqual(['reigns', 'words']);
  });
});

describe('choose', () => {
  it('swaps a tab shown in another pane rather than showing it twice', () => {
    expect(tabs(choose(panes('links', 'words'), 0, 'words'))).toEqual(['words', 'links']);
  });
  it('shows a tab no pane has in the pane it was picked in', () => {
    expect(tabs(choose(panes('links', 'words'), 1, 'models'))).toEqual(['links', 'models']);
  });
});

describe('layout', () => {
  it('reads the single tab older versions kept', () => {
    expect(tabs(readLayout(null, 'words').panes)).toEqual(['words']);
    expect(tabs(readLayout({ panes: [] }, null).panes)).toEqual(['insights']);
  });
  it('keeps the reader from being squeezed, and stacks panes too narrow to sit side by side', () => {
    const l: Layout = { panes: panes('links', 'words', 'insights'), split: 'cols', width: 1000 };
    expect(panelWidth(l, 1200)).toBe(760);
    expect(effectiveSplit(l, 1200)).toBe('rows');
    expect(effectiveSplit(l, 1600)).toBe('cols');
  });
});
