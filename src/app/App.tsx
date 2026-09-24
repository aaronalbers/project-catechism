import { useEffect } from 'react';
import { useStore } from './store';
import { Header } from '@/components/Header';
import { Reader } from '@/components/Reader';
import { ContextPanel } from '@/components/ContextPanel';
import { AudioBar } from '@/components/AudioBar';
import { IndexView } from '@/components/IndexView';

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
  return (
    <div className="app">
      <Header />
      {index !== null ? <IndexView /> : (
        <div className={`main${panelOpen ? '' : ' panel-closed'}`}>
          <div className="reader-col" id="reader-scroll"><Reader /></div>
          <aside className="panel-col" aria-label="Context for the current verse"><ContextPanel /></aside>
        </div>
      )}
      <AudioBar />
    </div>
  );
}
