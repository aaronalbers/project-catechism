import { useEffect, useRef } from 'react';
import { setLayout, useStore } from './store';
import { Header } from '@/components/Header';
import { Reader } from '@/components/Reader';
import { ContextPanel } from '@/components/ContextPanel';
import { AudioBar } from '@/components/AudioBar';
import { IndexView } from '@/components/IndexView';
import { Grip } from '@/components/Grip';
import { DEFAULT_LAYOUT, isNarrow, PANE_MIN_PX, PANEL_MIN_PX, panelWidth, READER_MIN_PX, useViewportWidth } from '@/lib/panes';

function useTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme = theme === 'system' ? '' : theme;
      root.classList.toggle('dark-system', theme === 'system' && mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useTheme();
  const panelOpen = useStore((s) => s.panelOpen);
  const index = useStore((s) => s.index);
  const layout = useStore((s) => s.layout);
  const viewport = useViewportWidth();
  const main = useRef<HTMLDivElement>(null);
  const width = panelWidth(layout, viewport);
  // The grip on the panel's left edge: dragging left widens the panel, never past the reader's minimum,
  // nor so narrow that panes side by side would have to stack.
  const least = layout.split === 'cols' ? Math.max(PANEL_MIN_PX, layout.panes.length * PANE_MIN_PX) : PANEL_MIN_PX;
  const resize = (d: number, done: boolean) => {
    const w = Math.round(Math.max(least, Math.min(width - d, viewport - READER_MIN_PX)));
    if (done) setLayout({ width: w }); else main.current?.style.setProperty('--panel-w', `${w}px`);
  };
  const reset = () => setLayout({ width: layout.split === 'cols' ? Math.max(DEFAULT_LAYOUT.width, layout.panes.length * PANE_MIN_PX) : DEFAULT_LAYOUT.width });
  return (
    <div className="app">
      <Header />
      {index !== null ? <IndexView /> : (
        <div ref={main} className={`main${panelOpen ? '' : ' panel-closed'}`} style={isNarrow(viewport) ? undefined : { '--panel-w': `${width}px` } as React.CSSProperties}>
          <div className="reader-col" id="reader-scroll"><Reader /></div>
          <aside className="panel-col" aria-label="Context for the current verse">
            {panelOpen && !isNarrow(viewport) && <Grip axis="x" label="Resize the panel" onDrag={resize} onReset={reset} />}
            <ContextPanel />
          </aside>
        </div>
      )}
      <AudioBar />
    </div>
  );
}
