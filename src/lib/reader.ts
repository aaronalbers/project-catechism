// Verse-by-verse playback controller. Drives the store's current verse so every
// panel follows the reading, like the old BroadcastChannel setup but in-process.
import { useSyncExternalStore } from 'react';
import { BrowserEngine, KokoroEngine, hasWebGPU, type Engine, type KokoroDevice } from './tts';
import { loadBook } from './data';
import { BOOKS, type VerseLoc } from './refs';
import { getState, setState } from '@/app/store';

export interface ReaderState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  engine: 'kokoro' | 'browser';
  /** Which Kokoro build to download: GPU (fp32, ≈330 MB) or CPU (q8, ≈90 MB). */
  device: KokoroDevice;
  voice: string;
  speed: number;
  progress: { fraction: number; label: string } | null;
  error: string | null;
  /** Keep reading past the end of the chapter. */
  continuous: boolean;
}

const stored = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
let rs: ReaderState = {
  status: 'idle', engine: stored('tts.engine', 'kokoro'), device: stored('tts.device', hasWebGPU() ? 'webgpu' : 'wasm'), voice: stored('tts.voice', 'bm_george'), speed: stored('tts.speed', 1), progress: null, error: null, continuous: true,
};
const listeners = new Set<() => void>();
function set(p: Partial<ReaderState>) {
  rs = { ...rs, ...p };
  for (const k of ['engine', 'device', 'voice', 'speed'] as const) if (k in p) try { localStorage.setItem(`tts.${k}`, JSON.stringify(rs[k])); } catch { /* ignore */ }
  for (const l of listeners) l();
}
export function useReader() { return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => rs, () => rs); }

const engines: Record<ReaderState['engine'], Engine> = { kokoro: new KokoroEngine(), browser: new BrowserEngine() };
let abort: AbortController | null = null;

export async function nextVerse(loc: VerseLoc): Promise<VerseLoc | null> {
  const book = await loadBook(loc.book);
  const chapter = book.chapters[loc.chapter - 1] ?? [];
  const idx = chapter.findIndex((v) => v.v === loc.verse);
  if (idx >= 0 && idx + 1 < chapter.length) return { ...loc, verse: chapter[idx + 1].v };
  if (loc.chapter < book.chapters.length) return { book: loc.book, chapter: loc.chapter + 1, verse: book.chapters[loc.chapter][0]?.v ?? 1 };
  const bi = BOOKS.findIndex((b) => b.id === loc.book);
  if (bi + 1 < BOOKS.length) return { book: BOOKS[bi + 1].id, chapter: 1, verse: 1 };
  return null;
}

async function verseText(loc: VerseLoc) {
  const book = await loadBook(loc.book);
  return book.chapters[loc.chapter - 1]?.find((v) => v.v === loc.verse)?.t ?? '';
}

/** Numbers read as "verse 3" would be noise; strip bracketed footnote markers etc. */
const clean = (t: string) => t.replace(/\s+/g, ' ').trim();

export async function play(from?: VerseLoc) {
  stop();
  const ctl = new AbortController();
  abort = ctl;
  const engine = engines[rs.engine];
  set({ status: 'loading', error: null });
  try {
    await engine.load((p) => set({ progress: p }), rs.device);
  } catch (e) {
    if (rs.engine === 'kokoro') {
      // Fall back rather than leaving the user with silence.
      set({ engine: 'browser', voice: 'default', progress: null, error: `Kokoro unavailable (${e instanceof Error ? e.message : e}); using browser speech.` });
      return play(from);
    }
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    return;
  }
  set({ progress: null });
  let loc = from ?? getState().loc;
  setState({ loc, playing: true });
  try {
    while (!ctl.signal.aborted) {
      const text = clean(await verseText(loc));
      const next = await nextVerse(loc);
      if (next && (rs.continuous || next.chapter === loc.chapter)) void verseText(next).then((t) => engine.prefetch(clean(t), { voice: rs.voice, speed: rs.speed }));
      set({ status: 'playing' });
      if (text) await engine.speak(text, { voice: rs.voice, speed: rs.speed, signal: ctl.signal });
      if (ctl.signal.aborted) break;
      if (!next || (!rs.continuous && next.chapter !== loc.chapter)) break;
      loc = next;
      setState({ loc, wordIndex: null });
    }
    if (!ctl.signal.aborted) { set({ status: 'idle' }); setState({ playing: false }); }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    setState({ playing: false });
  }
}

export function stop() {
  abort?.abort();
  abort = null;
  if (rs.status !== 'idle') set({ status: 'idle' });
  if (getState().playing) setState({ playing: false });
}

export function setEngine(engine: ReaderState['engine']) {
  const wasPlaying = rs.status === 'playing' || rs.status === 'loading';
  stop();
  set({ engine, voice: engine === 'kokoro' ? 'bm_george' : 'default', error: null });
  if (wasPlaying) void play();
}
export function setDevice(device: KokoroDevice) { const was = rs.status === 'playing' || rs.status === 'loading'; stop(); set({ device, error: null }); if (was) void play(); }
export function setVoice(voice: string) { const was = rs.status === 'playing'; stop(); set({ voice }); if (was) void play(); }
export function setSpeed(speed: number) { const was = rs.status === 'playing'; stop(); set({ speed }); if (was) void play(); }
export function setContinuous(continuous: boolean) { set({ continuous }); }
export function voicesFor(engine: ReaderState['engine']) { return engines[engine].voices(); }
