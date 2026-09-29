// Two speech engines behind one interface. `BrowserEngine` (Web Speech API) is the default and
// needs no download; `KokoroEngine` is neural and runs locally, slower to start.
import type { WorkerIn, WorkerOut } from '@/workers/tts.worker';

export interface SpeakOptions { voice: string; speed: number; signal: AbortSignal }
/** fp32 on WebGPU is what Kokoro recommends (≈330 MB); q8 on WASM is the small, works-everywhere build (≈90 MB). */
export type KokoroDevice = 'webgpu' | 'wasm';
export const hasWebGPU = () => 'gpu' in navigator;
/** Off while onnxruntime-web's WebGPU ConvTranspose miscomputes Kokoro's vocoder (the
 *  audio comes out as loud noise; still broken on 1.30.0 — microsoft/onnxruntime#29807). */
const KOKORO_WEBGPU_WORKS = false;
export const canUseKokoroGPU = () => KOKORO_WEBGPU_WORKS && hasWebGPU();
export interface Engine {
  readonly id: 'kokoro' | 'browser';
  /** Resolves when the engine can synthesize. Reports download progress 0..1 for Kokoro. */
  load(onProgress?: (p: { fraction: number; label: string }) => void, device?: KokoroDevice): Promise<void>;
  voices(): { id: string; label: string }[];
  /** Synthesizes + plays `text`; resolves when playback ends or rejects on abort. */
  speak(text: string, opts: SpeakOptions): Promise<void>;
  /** Warms the cache so a coming verse starts without a gap. */
  prefetch(text: string, opts: Omit<SpeakOptions, 'signal'>): void;
  /** Drops prefetches not yet started, when playback stops or jumps elsewhere. */
  cancel(): void;
}

export const KOKORO_VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US, female)' },
  { id: 'af_bella', label: 'Bella (US, female)' },
  { id: 'af_nicole', label: 'Nicole (US, female)' },
  { id: 'am_michael', label: 'Michael (US, male)' },
  { id: 'am_fenrir', label: 'Fenrir (US, male)' },
  { id: 'am_puck', label: 'Puck (US, male)' },
  { id: 'bf_emma', label: 'Emma (UK, female)' },
  { id: 'bm_george', label: 'George (UK, male)' },
  { id: 'bm_fable', label: 'Fable (UK, male)' },
];

/** Splits a verse at the ends of its sentences (after `.`, `?` or `!`, and any closing quote), so the first
 *  sentence plays while the rest are made, side by side. Kokoro gives each piece a falling close and a pause,
 *  as a full stop has anyway; splitting at a `;` or `,` would put one where the text runs on. A piece under
 *  `min` characters (a trailing “he said.”) stays with its neighbour. */
export function speechChunks(text: string, min = 40): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(?<=[.?!][’”'")]*)\s+/)) {
    if (!piece) continue;
    if (out.length && out[out.length - 1].length < min) out[out.length - 1] += ' ' + piece;
    else out.push(piece);
  }
  if (out.length > 1 && out[out.length - 1].length < min) out.push(out.splice(-2, 2).join(' '));
  return out;
}

/** How many copies of the model to run side by side. Each worker synthesizes on one thread (onnxruntime-web
 *  needs cross-origin isolation for more, which GitHub Pages cannot give) and holds its own model, ≈600 MB
 *  measured in Chrome, so the pool is sized from the device's memory, up to one worker per core but one: six
 *  with 16 GB or more, one on a phone. On WASM one worker made a verse ≈2.5× slower than it plays, four ≈1.05×
 *  and six ≈0.8× (headless Chrome on a 6-core Mac); the ratio is the same at every speed. */
function poolSize() {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const byMemory = memory === undefined ? (matchMedia('(pointer: coarse)').matches ? 1 : 2) : memory >= 16 ? 6 : memory >= 8 ? 4 : memory >= 6 ? 2 : 1;
  return Math.max(1, Math.min(byMemory, cores - 1));
}

interface Job { key: string; text: string; voice: string; speed: number; urgent: boolean; resolve: (a: AudioBuffer) => void; reject: (e: Error) => void }
interface PoolWorker { worker: Worker; ready: boolean; job: Job | null }

export class KokoroEngine implements Engine {
  readonly id = 'kokoro' as const;
  private pool: PoolWorker[] = [];
  private ready: Promise<void> | null = null;
  private nextId = 1;
  /** Synthesis waiting for a free worker; urgent jobs (what is about to play) go ahead of prefetches. */
  private queue: Job[] = [];
  private cache = new Map<string, Promise<AudioBuffer>>();
  private ctx: AudioContext | null = null;
  private device: KokoroDevice | null = null;

  private audioContext() { return (this.ctx ??= new AudioContext()); }

  /** Ends the workers, failing whatever they were still synthesizing so nothing waits on it forever. */
  private terminate() {
    const unloaded = new Error('Voice model unloaded');
    for (const w of this.pool) { w.worker.terminate(); w.job?.reject(unloaded); }
    for (const j of this.queue) j.reject(unloaded);
    this.pool = []; this.queue = []; this.ready = null; this.cache.clear();
  }

  /** Starts a worker on the model; `onProgress` hears its download, which later workers find in the browser's cache. */
  private spawn(device: KokoroDevice, onProgress?: (p: { fraction: number; label: string }) => void): Promise<void> {
    const w: PoolWorker = { worker: new Worker(new URL('../workers/tts.worker.ts', import.meta.url), { type: 'module' }), ready: false, job: null };
    this.pool.push(w);
    return new Promise<void>((resolve, reject) => {
      const files = new Map<string, { loaded: number; total: number }>();
      const fail = (e: Error) => {
        this.pool = this.pool.filter((p) => p !== w);
        w.worker.terminate();
        w.job?.reject(e);
        reject(e);
        this.dispatch();
      };
      w.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === 'progress') {
          files.set(m.file, { loaded: m.loaded, total: m.total });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          onProgress?.({ fraction: total ? loaded / total : 0, label: `Downloading voice model ${(loaded / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB` });
        } else if (m.type === 'ready') {
          onProgress?.({ fraction: 1, label: 'Ready' });
          w.ready = true;
          resolve();
          this.dispatch();
        } else if (m.type === 'audio' || (m.type === 'error' && m.id !== undefined)) {
          const job = w.job;
          w.job = null;
          if (m.type === 'audio') {
            const buf = this.audioContext().createBuffer(1, m.audio.length, m.sampleRate);
            buf.copyToChannel(m.audio, 0);
            job?.resolve(buf);
          } else job?.reject(new Error(m.message));
          this.dispatch();
        } else if (m.type === 'error') fail(new Error(m.message));
      };
      w.worker.onerror = (e) => fail(new Error(e.message));
      w.worker.postMessage({ type: 'load', device, dtype: device === 'webgpu' ? 'fp32' : 'q8' } satisfies WorkerIn);
    });
  }

  async load(onProgress?: (p: { fraction: number; label: string }) => void, device: KokoroDevice = canUseKokoroGPU() ? 'webgpu' : 'wasm') {
    if (this.ready && this.device !== device) this.terminate();
    if (this.ready) return this.ready;
    this.device = device;
    // One worker first, so playback starts as soon as it can; the rest join once the model is cached.
    // WebGPU runs one model on the GPU, where more copies would only compete.
    this.ready = this.spawn(device, onProgress).then(() => {
      const extra = device === 'wasm' ? poolSize() - 1 : 0;
      for (let i = 0; i < extra; i++) this.spawn(device).catch(() => { /* the pool works with fewer */ });
    });
    this.ready.catch(() => this.terminate());
    return this.ready;
  }

  voices() { return KOKORO_VOICES; }

  /** Hands queued jobs to idle workers, urgent ones first. */
  private dispatch() {
    for (const w of this.pool) {
      if (!w.ready || w.job) continue;
      const i = this.queue.findIndex((j) => j.urgent);
      const job = this.queue.splice(i >= 0 ? i : 0, 1)[0];
      if (!job) return;
      w.job = job;
      w.worker.postMessage({ type: 'generate', id: this.nextId++, text: job.text, voice: job.voice, speed: job.speed } satisfies WorkerIn);
    }
  }

  private synth(text: string, voice: string, speed: number, urgent: boolean): Promise<AudioBuffer> {
    const key = `${voice}|${speed}|${text}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Something about to play that is still only queued as a prefetch moves up.
      if (urgent) { const j = this.queue.find((j) => j.key === key); if (j) j.urgent = true; this.dispatch(); }
      return cached;
    }
    const p = new Promise<AudioBuffer>((resolve, reject) => {
      this.queue.push({ key, text, voice, speed, urgent, resolve, reject });
    });
    p.catch(() => this.cache.delete(key));
    this.cache.set(key, p);
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!);
    this.dispatch();
    return p;
  }

  prefetch(text: string, opts: Omit<SpeakOptions, 'signal'>) {
    if (this.pool.length) for (const c of speechChunks(text)) void this.synth(c, opts.voice, opts.speed, false).catch(() => {});
  }

  cancel() {
    const dropped = this.queue; this.queue = [];
    for (const j of dropped) j.reject(new DOMException('aborted', 'AbortError'));
  }

  async speak(text: string, opts: SpeakOptions) {
    if (!this.ready) await this.load();
    // Ask for every piece at once so free workers make them side by side, then play them in order.
    const buffers = speechChunks(text).map((c) => this.synth(c, opts.voice, opts.speed, true));
    const ctx = this.audioContext();
    for (const b of buffers) {
      const buffer = await b;
      if (opts.signal.aborted) throw new DOMException('aborted', 'AbortError');
      if (ctx.state === 'suspended') await ctx.resume();
      await new Promise<void>((resolve, reject) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        const onAbort = () => { try { src.stop(); } catch { /* already stopped */ } reject(new DOMException('aborted', 'AbortError')); };
        src.onended = () => { opts.signal.removeEventListener('abort', onAbort); resolve(); };
        opts.signal.addEventListener('abort', onAbort, { once: true });
        src.start();
      });
    }
  }
}

export class BrowserEngine implements Engine {
  readonly id = 'browser' as const;
  async load() { if (!('speechSynthesis' in window)) throw new Error('This browser has no speech synthesis.'); }
  voices() {
    // 'default' leaves the utterance's voice unset, so the system's own choice speaks; it is listed so the menu shows it.
    if (!('speechSynthesis' in window)) return [{ id: 'default', label: 'System default' }];
    return [{ id: 'default', label: 'System default' }, ...speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')).map((v) => ({ id: v.name, label: `${v.name} (${v.lang})` }))];
  }
  prefetch() { /* nothing to warm */ }
  cancel() { /* nothing queued */ }
  async speak(text: string, opts: SpeakOptions) {
    await new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find((v) => v.name === opts.voice);
      if (v) u.voice = v;
      u.rate = opts.speed;
      const onAbort = () => { speechSynthesis.cancel(); reject(new DOMException('aborted', 'AbortError')); };
      const done = () => opts.signal.removeEventListener('abort', onAbort);
      u.onend = () => { done(); resolve(); };
      u.onerror = (e) => { done(); if (e.error === 'interrupted' || e.error === 'canceled') resolve(); else reject(new Error(e.error)); };
      opts.signal.addEventListener('abort', onAbort, { once: true });
      speechSynthesis.speak(u);
    });
  }
}
