import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { addPane, closePane, focusPane, getState, pickTab, setLayout, useStore, type PanelTab } from '@/app/store';
import { insightsFor, modelsFor, peopleInChapter, videosFor, propheciesFor, quotesFor, fragmentsFor, chiasmsFor, talliesFor } from '@/lib/content';
import { effectiveSplit, isNarrow, MAX_PANES, PANE_MIN_PX, useViewportWidth, type Pane } from '@/lib/panes';
import { InsightsPanel } from '@/panels/InsightsPanel';
import { WordsPanel } from '@/panels/WordsPanel';
import { LinksPanel } from '@/panels/LinksPanel';
import { VideosPanel } from '@/panels/VideosPanel';
import { ReignsPanel } from '@/panels/ReignsPanel';
import { accountAt } from '@/lib/reign';
import { passionInChapter } from '@/lib/passion';
import { DaysPanel } from '@/panels/DaysPanel';
import { namedInChapter, usePeopleInBook } from '@/lib/people';
import { Grip } from './Grip';
import { Icon } from './Icons';

// Map, graph and 3D libraries are only fetched when their tab is opened.
const PlacesPanel = lazy(() => import('@/panels/PlacesPanel').then((m) => ({ default: m.PlacesPanel })));
const PeoplePanel = lazy(() => import('@/panels/PeoplePanel').then((m) => ({ default: m.PeoplePanel })));
const ModelsPanel = lazy(() => import('@/panels/ModelsPanel').then((m) => ({ default: m.ModelsPanel })));

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'words', label: 'Words' },
  { id: 'places', label: 'Places' },
  { id: 'people', label: 'People' },
  { id: 'links', label: 'Links' },
  { id: 'reigns', label: 'Reign' },
  { id: 'days', label: 'Days' },
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
    </Suspense>
  );
});

export function ContextPanel() {
  const layout = useStore((s) => s.layout);
  const focus = useStore((s) => s.focus);
  const loc = useStore((s) => s.loc);
  const open = useStore((s) => s.panelOpen);
  const viewport = useViewportWidth();
  const named = usePeopleInBook(loc.book);
  const box = useRef<HTMLDivElement>(null);
  const counts = useMemo((): Partial<Record<PanelTab, number>> => ({
    insights: insightsFor(loc).length,
    models: modelsFor(loc).length,
    // Everyone the chapter names; the family tree's count stands in until that has loaded.
    people: named ? namedInChapter(named, loc.chapter).length : peopleInChapter(loc.book, loc.chapter).length,
    videos: videosFor(loc).length,
    links: propheciesFor(loc).length + quotesFor(loc).length + fragmentsFor(loc).length + chiasmsFor(loc).length + talliesFor(loc).length,
  }), [loc, named]);
  const { panes } = layout;
  const narrow = isNarrow(viewport);
  const split = effectiveSplit(layout, viewport);
  const showing = (id: PanelTab) => panes.some((p) => p.tab === id);
  // The Reign tab is only for Kings and Chronicles, where the kings are charted; the Days tab only for chapters that date the three days.
  const tabs = TABS.filter((t) => (t.id !== 'reigns' || accountAt(loc) || showing('reigns')) && (t.id !== 'days' || passionInChapter(loc.book, loc.chapter) || showing('days')));
  // A narrow screen shows only the pane in use.
  const shown = narrow ? [Math.min(focus, panes.length - 1)] : panes.map((_, i) => i);

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
  // Dragging the grip between panes a and a + 1 moves share from one to the other, each keeping a minimum.
  const resize = (a: number) => (d: number, done: boolean) => {
    const els = box.current ? [...box.current.querySelectorAll<HTMLElement>(':scope > .pane')] : [];
    if (els.length !== panes.length) return;
    const px = (el: HTMLElement) => (split === 'cols' ? el.offsetWidth : el.offsetHeight);
    const total = panes.reduce((t, p) => t + p.size, 0);
    const perPx = total / els.reduce((t, el) => t + px(el), 0);
    const pair = panes[a].size + panes[a + 1].size, min = (split === 'cols' ? 200 : 90) * perPx;
    const sa = Math.max(min, Math.min(pair - min, panes[a].size + d * perPx));
    const sizes = panes.map((p, i) => (i === a ? sa : i === a + 1 ? pair - sa : p.size));
    if (done) setLayout({ panes: panes.map((p, i) => ({ ...p, size: sizes[i] })) });
    else els.forEach((el, i) => { el.style.flexGrow = String(sizes[i]); });
  };
  const even = () => setLayout({ panes: panes.map((p) => ({ ...p, size: 1 })) });

  return (
    <div ref={box} className={`panes ${split}`}>
      {shown.map((i, k) => (
        <PaneBox key={panes[i].tab} i={i} pane={panes[i]} lone={shown.length === 1} open={open} narrow={narrow}
          grip={k > 0 && <Grip axis={split === 'cols' ? 'x' : 'y'} label="Resize panes" onDrag={resize(i - 1)} onReset={even} />}
          strip={tabs.map((t) => ({ ...t, n: counts[t.id], elsewhere: !narrow && panes.some((p, j) => j !== i && p.tab === t.id) }))}
          tools={!narrow && <>
            {i === 0 && panes.length > 1 && (
              <button className="iconbtn small" onClick={toggleSplit} title={split === 'cols' ? 'Stack the panes' : 'Put the panes side by side'} aria-label={split === 'cols' ? 'Stack the panes' : 'Put the panes side by side'}>
                {split === 'cols' ? <Icon.Rows /> : <Icon.Cols />}
              </button>
            )}
            {i === 0 && panes.length < MAX_PANES && <button className="iconbtn small" onClick={add} title="Open another pane" aria-label="Open another pane"><Icon.Plus /></button>}
            {panes.length > 1 && <button className="iconbtn small" onClick={() => closePane(i)} title="Close this pane" aria-label="Close this pane"><Icon.Close /></button>}
          </>} />
      ))}
    </div>
  );
}

interface StripTab { id: PanelTab; label: string; n?: number; elsewhere: boolean }

function PaneBox({ i, pane, lone, open, narrow, grip, strip, tools }: { i: number; pane: Pane; lone: boolean; open: boolean; narrow: boolean; grip: React.ReactNode; strip: StripTab[]; tools: React.ReactNode }) {
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
        <div className="pane-head">
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
        </div>
        {open && <PanelBody tab={pane.tab} />}
      </section>
    </>
  );
}
