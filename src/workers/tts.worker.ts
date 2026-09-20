// Runs Kokoro-82M (Apache-2.0) entirely in the browser via transformers.js.
// The model (~90 MB at q8) is downloaded from the Hugging Face Hub once and
// cached by the browser; nothing is sent to any server.
import { KokoroTTS } from 'kokoro-js';

export type WorkerIn =
  | { type: 'load'; device: 'wasm' | 'webgpu'; dtype: 'q8' | 'fp32' }
  | { type: 'generate'; id: number; text: string; voice: string; speed: number };
export type WorkerOut =
  | { type: 'progress'; file: string; progress: number; loaded: number; total: number }
  | { type: 'ready'; voices: string[] }
  | { type: 'audio'; id: number; audio: Float32Array<ArrayBuffer>; sampleRate: number }
  | { type: 'error'; id?: number; message: string };

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts: KokoroTTS | null = null;
const post = (m: WorkerOut, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: msg.dtype,
        device: msg.device,
        progress_callback: (p: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
          if (p.status === 'progress') post({ type: 'progress', file: p.file ?? '', progress: p.progress ?? 0, loaded: p.loaded ?? 0, total: p.total ?? 0 });
        },
      });
      post({ type: 'ready', voices: Object.keys(tts.voices) });
    } else if (msg.type === 'generate') {
      if (!tts) throw new Error('Model not loaded');
      const out = await tts.generate(msg.text, { voice: msg.voice as 'af_heart', speed: msg.speed });
      const audio = out.audio as Float32Array<ArrayBuffer>;
      post({ type: 'audio', id: msg.id, audio, sampleRate: out.sampling_rate }, [audio.buffer as ArrayBuffer]);
    }
  } catch (err) {
    post({ type: 'error', id: msg.type === 'generate' ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
