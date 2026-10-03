import { useEffect, useRef, useState } from 'react';
import { getState, pickTab, setState, useStore, type PanelTab } from '@/app/store';
import { useReader } from '@/lib/reader';
import { AudioControls, PlayButton, audioStatus } from './AudioBar';
import { useTabs } from './ContextPanel';
import { Icon } from './Icons';

/**
 * A phone's bar at the bottom, in place of the audio bar: the play button, the audio settings, and the tabs,
 * the Reader first. One view fills the screen, the reader or a panel.
 */
export function TabBar() {
  const panelOpen = useStore((s) => s.panelOpen);
  const index = useStore((s) => s.index);
  const playing = useStore((s) => s.playing);
  const nudge = useStore((s) => s.nudge);
  const shownTab = useStore((s) => s.layout.panes[Math.min(s.focus, s.layout.panes.length - 1)].tab);
  const r = useReader();
  const { tabs, counts } = useTabs();
  const [settings, setSettings] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const readerTab = useRef<HTMLButtonElement>(null);
  const onReader = !panelOpen;

  // Keep the selected tab in sight in a strip too narrow for all of them.
  useEffect(() => {
    const el = strip.current, t = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && t && (t.offsetLeft < el.scrollLeft || t.offsetLeft + t.offsetWidth > el.scrollLeft + el.clientWidth)) el.scrollLeft = t.offsetLeft - (el.clientWidth - t.offsetWidth) / 2;
  }, [shownTab, panelOpen]);
  // A link moved the text while a panel was showing: flash the Reader tab, so it is clear where it went.
  useEffect(() => {
    if (!nudge || !readerTab.current) return;
    const accent = getComputedStyle(readerTab.current).getPropertyValue('--accent');
    readerTab.current.animate([{ boxShadow: `inset 0 0 0 2px ${accent}` }, { boxShadow: 'inset 0 0 0 2px transparent' }], { duration: 900, easing: 'ease-out' });
  }, [nudge]);

  const toReader = () => setState({ panelOpen: false, index: null });
  const toTab = (id: PanelTab) => { if (getState().index !== null) setState({ index: null }); pickTab(getState().focus, id); };
  const note = r.error || r.progress ? audioStatus(r) : null;
  return (
    <nav className="tabbar" aria-label="Views and audio">
      {note && <div className="tabbar-note">{note}{r.progress && r.progress.fraction < 1 && <div className="progress"><span style={{ width: `${Math.round(r.progress.fraction * 100)}%` }} /></div>}</div>}
      <PlayButton />
      <button className="iconbtn" onClick={() => setSettings(true)} aria-label="Audio settings" title="Voice, speed, and reading on into the next chapter"><Icon.Tune /></button>
      <div className="tabs" role="tablist" aria-label="Views">
        {/* Outside the scrolling strip, so it stays in reach however far that is scrolled. */}
        <button ref={readerTab} role="tab" className={`tab reader-tab${playing ? ' playing' : ''}`} aria-selected={onReader && index === null} onClick={toReader}
          title={playing ? 'The text being read' : undefined}>Reader</button>
        <div ref={strip} className="strip">
          {tabs.map((t) => (
            <button key={t.id} role="tab" className="tab" aria-selected={!onReader && index === null && shownTab === t.id} onClick={() => toTab(t.id)}>
              {t.label}{counts[t.id] ? <span className="count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {settings && <AudioSheet onClose={() => setSettings(false)} />}
    </nav>
  );
}

function AudioSheet({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const r = useReader();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} className="peek audio-sheet" aria-label="Audio settings" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="peek-head">
        <h2>Reading aloud</h2>
        <button className="iconbtn small" onClick={() => dialog.current?.close()} aria-label="Close"><Icon.Close /></button>
      </div>
      <AudioControls />
      <p className="peek-note">{audioStatus(r)}</p>
    </dialog>
  );
}
