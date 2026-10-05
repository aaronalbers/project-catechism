import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { addPane, closePane, focusPane, getState, pickTab, setLayout, useStore, type PanelTab } from '@/app/store';
import { acrosticsFor } from '@/lib/acrostic';
import { insightsFor, modelsFor, skyInChapter, SKY_READINGS, skyEventsFor, skyNamesFor, peopleInChapter, videosFor, propheciesFor, quotesFor, fragmentsFor, chiasmsFor, talliesFor } from '@/lib/content';
import { fitting, isCompact, isNarrow, PANE_MIN_PX, panelWidth, READER_MIN_PX, useViewportWidth, visible, type Pane } from '@/lib/panes';
import { InsightsPanel } from '@/panels/InsightsPanel';
import { WordsPanel } from '@/panels/WordsPanel';
import { LinksPanel } from '@/panels/LinksPanel';
import { VideosPanel } from '@/panels/VideosPanel';
import { ReignsPanel } from '@/panels/ReignsPanel';
import { accountAt } from '@/lib/reign';
import { passionInChapter } from '@/lib/passion';
import { DaysPanel } from '@/panels/DaysPanel';
import { ScrollsPanel } from '@/panels/ScrollsPanel';
import { WorthPanel } from '@/panels/WorthPanel';
import { pricesAt, pricesInChapter } from '@/lib/prices';
import { hebrewOf, scrollMarksInChapter } from '@/lib/scrolls';
import { namedInChapter, usePeopleInBook } from '@/lib/people';
import { Grip } from './Grip';
import { Icon } from './Icons';

// Map, graph, 3D and astronomy libraries are only fetched when their tab is opened.
const PlacesPanel = lazy(() => import('@/panels/PlacesPanel').then((m) => ({ default: m.PlacesPanel })));
const PeoplePanel = lazy(() => import('@/panels/PeoplePanel').then((m) => ({ default: m.PeoplePanel })));
const SkyPanel = lazy(() => import('@/panels/SkyPanel').then((m) => ({ default: m.SkyPanel })));
const ModelsPanel = lazy(() => import('@/panels/ModelsPanel').then((m) => ({ default: m.ModelsPanel })));

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'words', label: 'Words' },
  { id: 'places', label: 'Places' },
  { id: 'people', label: 'People' },
  { id: 'links', label: 'Links' },
  { id: 'reigns', label: 'Reign' },
  { id: 'days', label: 'Days' },
  { id: 'scrolls', label: 'Scrolls' },
  { id: 'worth', label: 'Worth' },
  { id: 'sky', label: 'Sky' },
  { id: 'models', label: 'Models' },
  { id: 'videos', label: 'Videos' },
];
/** The drag type a tab carries when it is dragged to another pane. */
const DRAG = 'application/x-panel-tab';

// Memoised on the tab alone, so resizing or focusing panes does not re-render a map or a model.
const PanelBody = memo(function PanelBody({ tab }: { tab: PanelTab }) {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      {tab === 'insights' && <InsightsPanel />}
      {tab === 'words' && <WordsPanel />}
      {tab === 'places' && <PlacesPanel />}
      {tab === 'people' && <PeoplePanel />}
      {tab === 'links' && <LinksPanel />}
      {tab === 'models' && <ModelsPanel />}
      {tab === 'videos' && <VideosPanel />}
      {tab === 'reigns' && <ReignsPanel />}
      {tab === 'days' && <DaysPanel />}
      {tab === 'scrolls' && <ScrollsPanel />}
      {tab === 'worth' && <WorthPanel />}
      {tab === 'sky' && <SkyPanel />}
    </Suspense>
  );
});

/** The tabs the current verse offers, and how many things each has for it: for the panes' strips, and a phone's tab bar. */
export function useTabs() {
  const panes = useStore((s) => s.layout.panes);
  const loc = useStore((s) => s.loc);
  const named = usePeopleInBook(loc.book);
  const counts = useMemo((): Partial<Record<PanelTab, number>> => ({
    insights: insightsFor(loc).length,
    models: modelsFor(loc).length,
    // Everyone the chapter names; the family tree's count stands in until that has loaded.
    people: named ? namedInChapter(named, loc.chapter).length : peopleInChapter(loc.book, loc.chapter).length,
    videos: videosFor(loc).length,
    // A break the Hebrew does not have, or words repeated across a book's end, in this chapter.
    scrolls: scrollMarksInChapter(loc.book, loc.chapter),
    worth: pricesAt(loc).length,
    sky: SKY_READINGS.reduce((n, r) => n + skyEventsFor(loc, r).length, 0) + skyNamesFor(loc).length,
    links: propheciesFor(loc).length + quotesFor(loc).length + fragmentsFor(loc).length + chiasmsFor(loc).length + acrosticsFor(loc).length + talliesFor(loc).length,
  }), [loc, named]);
  const showing = (id: PanelTab) => panes.some((p) => p.tab === id);
  // The Reign tab is only for Kings and Chronicles, where the kings are charted; the Days tab only for chapters that date
  // the three days; the Scrolls tab only for the Old Testament, whose books the Hebrew Bible divides otherwise; the Worth tab
  // only for chapters that name a sum of money; the Sky tab only for chapters a reading of the star of the Magi points to, or that name a star.
  const tabs = TABS.filter((t) => (t.id !== 'reigns' || accountAt(loc) || showing('reigns')) && (t.id !== 'days' || passionInChapter(loc.book, loc.chapter) || showing('days'))
    && (t.id !== 'scrolls' || hebrewOf(loc.book) || showing('scrolls')) && (t.id !== 'worth' || pricesInChapter(loc.book, loc.chapter).length || showing('worth'))
    && (t.id !== 'sky' || skyInChapter(loc.book, loc.chapter) || showing('sky')));
  return { tabs, counts };
}

export function ContextPanel() {
  const layout = useStore((s) => s.layout);
  const focus = useStore((s) => s.focus);
  const used = useStore((s) => s.used);
  const open = useStore((s) => s.panelOpen);
  const viewport = useViewportWidth();
  const box = useRef<HTMLDivElement>(null);
  // The panel's height, for how many stacked panes fit.
  const [height, setHeight] = useState(() => innerHeight - 120);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setHeight(e.contentRect.height));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const { tabs, counts } = useTabs();
  const { panes } = layout;
  const narrow = isNarrow(viewport);
  // On a phone the tabs sit in the bar at the bottom, beside the Reader tab, so the pane has no strip of its own.
  const bare = isCompact(viewport);
  const split = layout.split;
  const showing = (id: PanelTab) => panes.some((p) => p.tab === id);
  // As many panes as fit, the ones used most recently; a narrow screen shows only the pane in use.
  const shown = visible(panes.length, used, Math.min(focus, panes.length - 1), narrow ? 1 : fitting(split, panelWidth(layout, viewport), height));
  const hidden = panes.length - shown.length;
  // Another pane fits if the panel could widen to hold it beside the reader (or has the height, stacked).
  const room = fitting(split, viewport - READER_MIN_PX, height) > panes.length;

  const add = () => {
    const free = tabs.filter((t) => !showing(t.id));
    const next = free.find((t) => counts[t.id]) ?? free[0];
    if (!next) return;
    addPane(next.id);
    if (layout.split === 'cols') setLayout({ width: Math.max(layout.width, (panes.length + 1) * PANE_MIN_PX) });
  };
  const toggleSplit = () => {
    const cols = split !== 'cols';
    setLayout(cols ? { split: 'cols', width: Math.max(layout.width, panes.length * PANE_MIN_PX) } : { split: 'rows' });
  };
  // Dragging the grip between shown panes a and b moves share from one to the other, each keeping a minimum.
  const resize = (a: number, b: number) => (d: number, done: boolean) => {
    const els = box.current ? [...box.current.querySelectorAll<HTMLElement>(':scope > .pane')] : [];
    if (els.length !== shown.length) return;
    const px = (el: HTMLElement) => (split === 'cols' ? el.offsetWidth : el.offsetHeight);
    const perPx = shown.reduce((t, i) => t + panes[i].size, 0) / els.reduce((t, el) => t + px(el), 0);
    const pair = panes[a].size + panes[b].size, min = (split === 'cols' ? 200 : 90) * perPx;
    const sa = Math.max(min, Math.min(pair - min, panes[a].size + d * perPx));
    const sizes = panes.map((p, i) => (i === a ? sa : i === b ? pair - sa : p.size));
    if (done) setLayout({ panes: panes.map((p, i) => ({ ...p, size: sizes[i] })) });
    else els.forEach((el, k) => { el.style.flexGrow = String(sizes[shown[k]]); });
  };
  const even = () => setLayout({ panes: panes.map((p) => ({ ...p, size: 1 })) });

  return (
    <div ref={box} className={`panes ${split}`}>
      {shown.map((i, k) => (
        <PaneBox key={panes[i].tab} i={i} pane={panes[i]} lone={shown.length === 1} open={open} narrow={narrow} bare={bare}
          grip={k > 0 && <Grip axis={split === 'cols' ? 'x' : 'y'} label="Resize panes" onDrag={resize(shown[k - 1], i)} onReset={even} />}
          strip={tabs.map((t) => ({ ...t, n: counts[t.id], elsewhere: !narrow && shown.some((j) => j !== i && panes[j].tab === t.id) }))}
          tools={!narrow && <>
            {k === 0 && hidden > 0 && <span className="pane-hidden" title={`${hidden} more ${hidden === 1 ? 'pane does' : 'panes do'} not fit: widen the window${split === 'cols' ? ' or stack the panes' : ''}, or pick a tab to bring its pane back`}>{hidden} hidden</span>}
            {k === 0 && panes.length > 1 && (
              <button className="iconbtn small" onClick={toggleSplit} title={split === 'cols' ? 'Stack the panes' : 'Put the panes side by side'} aria-label={split === 'cols' ? 'Stack the panes' : 'Put the panes side by side'}>
                {split === 'cols' ? <Icon.Rows /> : <Icon.Cols />}
              </button>
            )}
            {k === 0 && room && panes.length < tabs.length && <button className="iconbtn small" onClick={add} title="Open another pane" aria-label="Open another pane"><Icon.Plus /></button>}
            {panes.length > 1 && <button className="iconbtn small" onClick={() => closePane(i)} title="Close this pane" aria-label="Close this pane"><Icon.Close /></button>}
          </>} />
      ))}
    </div>
  );
}

interface StripTab { id: PanelTab; label: string; n?: number; elsewhere: boolean }

function PaneBox({ i, pane, lone, open, narrow, bare, grip, strip, tools }: { i: number; pane: Pane; lone: boolean; open: boolean; narrow: boolean; bare: boolean; grip: React.ReactNode; strip: StripTab[]; tools: React.ReactNode }) {
  const lit = useStore((s) => s.lit);
  const el = useRef<HTMLElement>(null);
  const [drop, setDrop] = useState(false);
  // Flash the pane a link sent a tab to, so it is clear where it landed.
  useEffect(() => {
    const s = getState();
    if (!lit || lone || s.focus !== i || !el.current) return;
    const accent = getComputedStyle(el.current).getPropertyValue('--accent');
    el.current.animate([{ boxShadow: `inset 0 0 0 2px ${accent}` }, { boxShadow: 'inset 0 0 0 2px transparent' }], { duration: 900, easing: 'ease-out' });
  }, [lit]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the selected tab in sight in a strip too narrow for all of them.
  useEffect(() => {
    const strip = el.current?.querySelector<HTMLElement>('.tabs');
    if (!strip) return;
    const keep = () => {
      const t = strip.querySelector<HTMLElement>('[aria-selected="true"]');
      if (t && (t.offsetLeft < strip.scrollLeft || t.offsetLeft + t.offsetWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2;
    };
    const ro = new ResizeObserver(keep);
    ro.observe(strip);
    return () => ro.disconnect();
  }, [pane.tab, open]);
  const draggable = !narrow && !lone;
  return (
    <>
      {grip}
      <section ref={el} className={`pane${drop ? ' drop' : ''}`} style={{ flexGrow: pane.size }} onPointerDownCapture={() => focusPane(i)}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setDrop(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(false); }}
        onDrop={(e) => { const t = e.dataTransfer.getData(DRAG) as PanelTab; setDrop(false); if (t) { e.preventDefault(); pickTab(i, t); } }}>
        {!bare && <div className="pane-head">
          <div className="tabs" role="tablist">
            {strip.map((t) => (
              <button key={t.id} role="tab" className={`tab${t.elsewhere ? ' elsewhere' : ''}`} aria-selected={pane.tab === t.id && open}
                title={t.elsewhere ? 'Shown in another pane: click to swap it here' : draggable ? 'Drag to another pane to show it there' : undefined}
                draggable={draggable} onDragStart={(e) => { e.dataTransfer.setData(DRAG, t.id); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => pickTab(i, t.id)}>
                {t.label}{t.n ? <span className="count">{t.n}</span> : null}
              </button>
            ))}
          </div>
          {tools && <div className="pane-tools">{tools}</div>}
        </div>}
        {open && <PanelBody tab={pane.tab} />}
      </section>
    </>
  );
}
