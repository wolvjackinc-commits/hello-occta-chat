// Free, on-device transcription for the Care Sales Desk. The call recording is
// turned into text inside the agent's own browser with an open-source speech
// model (no audio leaves the device for this step, no extra service, no
// account). Claude then scores the text. The library and model download once
// (about 80–300 MB) and are cached by the browser.
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

type Progress = (stage: string, pct?: number) => void;
type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: { timestamp: [number, number | null]; text: string }[] }>;
let cached: { key: string; asr: Asr } | null = null;

async function loadAsr(onProgress: Progress): Promise<Asr> {
  const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const model = "Xenova/whisper-base.en";
  const key = `${model}:${gpu}`;
  if (cached?.key === key) return cached.asr;
  onProgress("Loading the speech model (first time only)", 0);
  const lib = await import(/* @vite-ignore */ LIB) as { pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Asr> };
  const asr = await lib.pipeline("automatic-speech-recognition", model, {
    device: gpu ? "webgpu" : "wasm",
    dtype: gpu ? "fp32" : "q8",
    progress_callback: (p: { status?: string; progress?: number }) => { if (p.status === "progress" && typeof p.progress === "number") onProgress("Loading the speech model (first time only)", Math.round(p.progress)); },
  });
  cached = { key, asr };
  return asr;
}

/** Decode any browser-playable recording (M4A, MP3, MP4, WAV…) to 16 kHz mono. */
async function decode16k(file: File): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const frames = Math.ceil(decoded.duration * 16000);
    const off = new OfflineAudioContext(1, frames, 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return (await off.startRendering()).getChannelData(0);
  } finally { void ctx.close(); }
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export async function transcribeRecording(file: File, onProgress: Progress): Promise<string> {
  onProgress("Reading the recording");
  const audio = await decode16k(file);
  if (audio.length < 16000 * 20) throw new Error("recording_too_short: under 20 seconds of audio");
  const asr = await loadAsr(onProgress);
  onProgress(`Transcribing ${mmss(audio.length / 16000)} of audio on this computer (this can take a few minutes)`);
  const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  const lines = (out.chunks ?? []).map((c) => `[${mmss(c.timestamp[0] ?? 0)}] ${c.text.trim()}`).filter((l) => l.length > 8);
  const text = lines.length ? lines.join("\n") : String(out.text ?? "").trim();
  if (text.length < 200) throw new Error("transcript_too_short: the recording had too little speech to check");
  return text;
}
