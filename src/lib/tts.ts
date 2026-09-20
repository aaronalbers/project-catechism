// Two speech engines behind one interface. `KokoroEngine` is the default
// (neural, runs locally); `BrowserEngine` (Web Speech API) needs no download.
import type { WorkerIn, WorkerOut } from '@/workers/tts.worker';

export interface SpeakOptions { voice: string; speed: number; signal: AbortSignal }
/** fp32 on WebGPU is what Kokoro recommends (≈330 MB); q8 on WASM is the small, works-everywhere build (≈90 MB). */
export type KokoroDevice = 'webgpu' | 'wasm';
export const hasWebGPU = () => 'gpu' in navigator;
export interface Engine {
  readonly id: 'kokoro' | 'browser';
  /** Resolves when the engine can synthesize. Reports download progress 0..1 for Kokoro. */
  load(onProgress?: (p: { fraction: number; label: string }) => void, device?: KokoroDevice): Promise<void>;
  voices(): { id: string; label: string }[];
  /** Synthesizes + plays `text`; resolves when playback ends or rejects on abort. */
  speak(text: string, opts: SpeakOptions): Promise<void>;
  /** Warms the cache so the next verse starts without a gap. */
  prefetch(text: string, opts: Omit<SpeakOptions, 'signal'>): void;
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

export class KokoroEngine implements Engine {
  readonly id = 'kokoro' as const;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (a: AudioBuffer) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, Promise<AudioBuffer>>();
  private ctx: AudioContext | null = null;

  private audioContext() { return (this.ctx ??= new AudioContext()); }

  private device: KokoroDevice | null = null;

  async load(onProgress?: (p: { fraction: number; label: string }) => void, device: KokoroDevice = hasWebGPU() ? 'webgpu' : 'wasm') {
    if (this.ready && this.device !== device) { this.worker?.terminate(); this.worker = null; this.ready = null; this.cache.clear(); }
    if (this.ready) return this.ready;
    this.device = device;
    this.ready = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/tts.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      const files = new Map<string, { loaded: number; total: number }>();
      worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === 'progress') {
          files.set(m.file, { loaded: m.loaded, total: m.total });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          onProgress?.({ fraction: total ? loaded / total : 0, label: `Downloading voice model ${(loaded / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB` });
        } else if (m.type === 'ready') {
          onProgress?.({ fraction: 1, label: 'Ready' });
          resolve();
        } else if (m.type === 'audio') {
          const p = this.pending.get(m.id);
          if (!p) return;
          this.pending.delete(m.id);
          const buf = this.audioContext().createBuffer(1, m.audio.length, m.sampleRate);
          buf.copyToChannel(m.audio, 0);
          p.resolve(buf);
        } else if (m.type === 'error') {
          if (m.id !== undefined) { this.pending.get(m.id)?.reject(new Error(m.message)); this.pending.delete(m.id); }
          else reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ type: 'load', device, dtype: device === 'webgpu' ? 'fp32' : 'q8' } satisfies WorkerIn);
    });
    this.ready.catch(() => { this.ready = null; this.worker?.terminate(); this.worker = null; });
    return this.ready;
  }

  voices() { return KOKORO_VOICES; }

  private synth(text: string, voice: string, speed: number): Promise<AudioBuffer> {
    const key = `${voice}|${speed}|${text}`;
    if (!this.cache.has(key)) {
      const p = new Promise<AudioBuffer>((resolve, reject) => {
        const id = this.nextId++;
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ type: 'generate', id, text, voice, speed } satisfies WorkerIn);
      });
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
      if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value!);
    }
    return this.cache.get(key)!;
  }

  prefetch(text: string, opts: Omit<SpeakOptions, 'signal'>) { if (this.worker) void this.synth(text, opts.voice, opts.speed).catch(() => {}); }

  async speak(text: string, opts: SpeakOptions) {
    if (!this.ready) await this.load();
    const buffer = await this.synth(text, opts.voice, opts.speed);
    if (opts.signal.aborted) throw new DOMException('aborted', 'AbortError');
    const ctx = this.audioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    await new Promise<void>((resolve, reject) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => resolve();
      opts.signal.addEventListener('abort', () => { try { src.stop(); } catch { /* already stopped */ } reject(new DOMException('aborted', 'AbortError')); }, { once: true });
      src.start();
    });
  }
}

export class BrowserEngine implements Engine {
  readonly id = 'browser' as const;
  async load() { if (!('speechSynthesis' in window)) throw new Error('This browser has no speech synthesis.'); }
  voices() {
    const vs = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    return vs.length ? vs.map((v) => ({ id: v.name, label: `${v.name} (${v.lang})` })) : [{ id: 'default', label: 'System default' }];
  }
  prefetch() { /* nothing to warm */ }
  async speak(text: string, opts: SpeakOptions) {
    await new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find((v) => v.name === opts.voice);
      if (v) u.voice = v;
      u.rate = opts.speed;
      u.onend = () => resolve();
      u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error)));
      opts.signal.addEventListener('abort', () => { speechSynthesis.cancel(); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
      speechSynthesis.speak(u);
    });
  }
}
