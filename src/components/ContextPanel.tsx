import { lazy, Suspense, useMemo } from 'react';
import { setState, useStore, type PanelTab } from '@/app/store';
import { insightsFor, modelsFor, peopleInChapter, videosFor, propheciesFor, quotesFor, fragmentsFor, chiasmsFor, talliesFor } from '@/lib/content';
import { InsightsPanel } from '@/panels/InsightsPanel';
import { WordsPanel } from '@/panels/WordsPanel';
import { LinksPanel } from '@/panels/LinksPanel';
import { VideosPanel } from '@/panels/VideosPanel';
import { ReignsPanel } from '@/panels/ReignsPanel';
import { accountAt } from '@/lib/reign';
import { passionInChapter } from '@/lib/passion';
import { DaysPanel } from '@/panels/DaysPanel';
import { namedInChapter, usePeopleInBook } from '@/lib/people';

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

export function ContextPanel() {
  const tab = useStore((s) => s.tab);
  const loc = useStore((s) => s.loc);
  const open = useStore((s) => s.panelOpen);
  const named = usePeopleInBook(loc.book);
  const counts = useMemo((): Partial<Record<PanelTab, number>> => ({
    insights: insightsFor(loc).length,
    models: modelsFor(loc).length,
    // Everyone the chapter names; the family tree's count stands in until that has loaded.
    people: named ? namedInChapter(named, loc.chapter).length : peopleInChapter(loc.book, loc.chapter).length,
    videos: videosFor(loc).length,
    links: propheciesFor(loc).length + quotesFor(loc).length + fragmentsFor(loc).length + chiasmsFor(loc).length + talliesFor(loc).length,
  }), [loc, named]);
  // The Reign tab is only for Kings and Chronicles, where the kings are charted; the Days tab only for chapters that date the three days.
  const tabs = TABS.filter((t) => (t.id !== 'reigns' || accountAt(loc) || tab === 'reigns') && (t.id !== 'days' || passionInChapter(loc.book, loc.chapter) || tab === 'days'));
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => {
          const n = counts[t.id];
          return (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id && open} onClick={() => setState({ tab: t.id, panelOpen: tab === t.id ? !open : true })}>
              {t.label}{n ? <span className="count">{n}</span> : null}
            </button>
          );
        })}
      </div>
      {open && (
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
      )}
    </>
  );
}
