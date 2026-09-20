import { lazy, Suspense, useMemo } from 'react';
import { setState, useStore, type PanelTab } from '@/app/store';
import { insightsFor, modelsFor, peopleInChapter, videosFor, propheciesFor, quotesFor, fragmentsFor, chiasmsFor } from '@/lib/content';
import { InsightsPanel } from '@/panels/InsightsPanel';
import { WordsPanel } from '@/panels/WordsPanel';
import { LinksPanel } from '@/panels/LinksPanel';
import { VideosPanel } from '@/panels/VideosPanel';

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
  { id: 'models', label: 'Models' },
  { id: 'videos', label: 'Videos' },
];

export function ContextPanel() {
  const tab = useStore((s) => s.tab);
  const loc = useStore((s) => s.loc);
  const open = useStore((s) => s.panelOpen);
  const counts = useMemo(() => ({
    insights: insightsFor(loc).length,
    models: modelsFor(loc).length,
    people: peopleInChapter(loc.book, loc.chapter).length,
    videos: videosFor(loc).length,
    links: propheciesFor(loc).length + quotesFor(loc).length + fragmentsFor(loc).length + chiasmsFor(loc).length,
  }), [loc]);
  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map((t) => {
          const n = (counts as Record<string, number>)[t.id];
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
        </Suspense>
      )}
    </>
  );
}
