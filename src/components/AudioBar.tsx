import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { play, setContinuous, setDevice, setEngine, setSpeed, setVoice, stop, useReader, voicesFor } from '@/lib/reader';
import { canUseKokoroGPU } from '@/lib/tts';
import { book } from '@/lib/refs';
import { Icon } from './Icons';

export function AudioBar() {
  const loc = useStore((s) => s.loc);
  const r = useReader();
  const [, bump] = useState(0);
  // Browser voices load asynchronously.
  useEffect(() => { const h = () => bump((n) => n + 1); window.speechSynthesis?.addEventListener('voiceschanged', h); return () => window.speechSynthesis?.removeEventListener('voiceschanged', h); }, []);
  const busy = r.status === 'loading';
  const active = r.status === 'playing' || busy;
  const voices = voicesFor(r.engine);
  return (
    <div className="audiobar" role="region" aria-label="Audio reader">
      <button className="playbtn-main" onClick={() => (active ? stop() : void play())} aria-label={active ? 'Stop reading' : 'Read aloud from the current verse'} disabled={busy && !r.progress}>
        {busy ? <Icon.Spinner /> : active ? <Icon.Pause /> : <Icon.Play />}
      </button>
      <div className="now">
        <div className="ref">{book(loc.book)?.name} {loc.chapter}:{loc.verse}</div>
        <div className="sub">
          {r.error ? <span style={{ color: 'var(--danger)' }}>{r.error}</span>
            : r.progress ? r.progress.label
            : r.status === 'playing' ? 'Reading… every panel follows the verse being read'
            : r.engine === 'kokoro' ? `Kokoro neural voice runs in your browser — first play downloads the ${r.device === 'webgpu' ? '330 MB GPU' : '90 MB CPU'} model once, then it is cached` : 'Using your browser’s built-in voice'}
        </div>
        {r.progress && r.progress.fraction < 1 && <div className="progress"><span style={{ width: `${Math.round(r.progress.fraction * 100)}%` }} /></div>}
      </div>
      <div className="controls">
        <select aria-label="Voice engine" value={r.engine} onChange={(e) => setEngine(e.target.value as 'kokoro' | 'browser')}>
          <option value="kokoro">Kokoro</option>
          <option value="browser">Browser</option>
        </select>
        {r.engine === 'kokoro' && canUseKokoroGPU() && (
          <select aria-label="Kokoro build" value={r.device} onChange={(e) => setDevice(e.target.value as 'webgpu' | 'wasm')} title="GPU: best quality and speed, 330 MB download. CPU: 90 MB, works on any device.">
            <option value="webgpu">GPU · 330 MB</option>
            <option value="wasm">CPU · 90 MB</option>
          </select>
        )}
        <select className="voice" aria-label="Voice" value={r.voice} onChange={(e) => setVoice(e.target.value)}>
          {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <select aria-label="Speed" value={r.speed} onChange={(e) => setSpeed(+e.target.value)}>
          {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        <label className="chip" title="Keep reading into the next chapter"><input type="checkbox" checked={r.continuous} onChange={(e) => setContinuous(e.target.checked)} /> continuous</label>
      </div>
    </div>
  );
}
