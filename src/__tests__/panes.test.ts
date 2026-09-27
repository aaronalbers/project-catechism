import { describe, expect, it } from 'vitest';
import { choose, fitting, panelWidth, place, readLayout, visible, type Layout, type Pane } from '@/lib/panes';

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
  it('refuses a stored layout that shows a tab twice', () => {
    expect(tabs(readLayout({ panes: panes('links', 'links') }, null).panes)).toEqual(['insights']);
  });
  it('keeps the reader from being squeezed', () => {
    const l: Layout = { panes: panes('links', 'words', 'insights'), split: 'cols', width: 1000 };
    expect(panelWidth(l, 1200)).toBe(760);
  });
  it('fits panes by width side by side and by height stacked', () => {
    expect(fitting('cols', 760, 800)).toBe(2);
    expect(fitting('cols', 3000, 800)).toBe(10);
    expect(fitting('rows', 3000, 800)).toBe(4);
    expect(fitting('rows', 3000, 100)).toBe(1);
  });
});

describe('visible', () => {
  it('shows every pane that fits', () => {
    expect(visible(3, [], 0, 5)).toEqual([0, 1, 2]);
  });
  it('shows the panes used most recently, the one in use always, in layout order', () => {
    expect(visible(4, [4, 1, 3, 2], 1, 2)).toEqual([0, 1]);
    expect(visible(4, [1, 2, 3, 4], 0, 2)).toEqual([0, 3]);
  });
});
