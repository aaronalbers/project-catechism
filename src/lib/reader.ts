// Verse-by-verse playback controller. Drives the store's current verse so every
// panel follows the reading, like the old BroadcastChannel setup but in-process.
import { useSyncExternalStore } from 'react';
import { BrowserEngine, KokoroEngine, canUseKokoroGPU, type Engine, type KokoroDevice } from './tts';
import { loadBook, loadVerseText } from './data';
import { BOOKS, bookIndex, type VerseLoc } from './refs';
import { getState, setState } from '@/app/store';
import { readStored, writeStored } from './storage';

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

// The browser's own voice by default: it starts at once, where Kokoro downloads a model and synthesizes each verse first.
const engine = readStored<ReaderState['engine']>('tts.engine', 'browser');
const defaultVoice = (e: ReaderState['engine']) => (e === 'kokoro' ? 'bm_george' : 'default');
let rs: ReaderState = {
  status: 'idle', engine, device: canUseKokoroGPU() ? readStored<KokoroDevice>('tts.device', 'webgpu') : 'wasm', voice: readStored('tts.voice', defaultVoice(engine)), speed: readStored('tts.speed', 1), progress: null, error: null, continuous: true,
};
const listeners = new Set<() => void>();
function set(p: Partial<ReaderState>) {
  rs = { ...rs, ...p };
  for (const k of ['engine', 'device', 'voice', 'speed'] as const) if (k in p) writeStored(`tts.${k}`, rs[k]);
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
  const bi = bookIndex(loc.book);
  if (bi + 1 < BOOKS.length) return { book: BOOKS[bi + 1].id, chapter: 1, verse: 1 };
  return null;
}

/** A verse's text as it is spoken: its whitespace collapsed, and empty for a verse the BSB omits. */
const verseText = async (loc: VerseLoc) => (await loadVerseText(loc.book, loc.chapter, loc.verse) ?? '').replace(/\s+/g, ' ').trim();

/** Whether reading goes on from `loc` to `next`: always when continuous, otherwise only within the chapter. */
const readsOn = (loc: VerseLoc, next: VerseLoc) => rs.continuous || (next.book === loc.book && next.chapter === loc.chapter);

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
  // Stopped, or replaced by another play, while the engine loaded.
  if (ctl.signal.aborted) return;
  set({ progress: null });
  let loc = from ?? getState().loc;
  setState({ loc, playing: true });
  try {
    while (!ctl.signal.aborted) {
      const text = await verseText(loc);
      const next = await nextVerse(loc);
      if (next && readsOn(loc, next)) void verseText(next).then((t) => engine.prefetch(t, { voice: rs.voice, speed: rs.speed }));
      set({ status: 'playing' });
      if (text) await engine.speak(text, { voice: rs.voice, speed: rs.speed, signal: ctl.signal });
      if (ctl.signal.aborted) break;
      if (!next || !readsOn(loc, next)) break;
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

/** Changes a playback setting, restarting the reading from the current verse if it was under way. */
function restartWith(p: Partial<ReaderState>) {
  const was = rs.status === 'playing' || rs.status === 'loading';
  stop();
  set(p);
  if (was) void play();
}
export function setEngine(engine: ReaderState['engine']) { restartWith({ engine, voice: defaultVoice(engine), error: null }); }
export function setDevice(device: KokoroDevice) { restartWith({ device, error: null }); }
export function setVoice(voice: string) { restartWith({ voice }); }
export function setSpeed(speed: number) { restartWith({ speed }); }
export function setContinuous(continuous: boolean) { set({ continuous }); }
export function voicesFor(engine: ReaderState['engine']) { return engines[engine].voices(); }
