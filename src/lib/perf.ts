/**
 * Lightweight, redacted, opt-in frontend performance instrumentation.
 *
 * Enable in a browser console with:   localStorage.perf = "1"
 * Disable with:                       localStorage.removeItem("perf")
 *
 * Records millisecond timings only — never logs tokens, account numbers,
 * URLs containing tokens, signed document URLs, request bodies, or any PII.
 * A short in-memory ring buffer of the last 200 samples is available via
 * `getPerfSamples()` for ad-hoc inspection.
 */

type PerfSample = {
  ts: number;       // epoch ms when the measurement ended
  name: string;     // logical name only (e.g. "quote.load", "journey.state")
  ms: number;       // duration in ms (rounded)
  ok: boolean;      // true if no error was thrown
};

const RING_SIZE = 200;
const ring: PerfSample[] = [];

function perfEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("perf") === "1";
  } catch {
    return false;
  }
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function record(sample: PerfSample) {
  ring.push(sample);
  if (ring.length > RING_SIZE) ring.shift();
  if (perfEnabled()) {
    // Plain numbers only — no payload, no URLs.
    // eslint-disable-next-line no-console
    console.debug(`[perf] ${sample.name} ${sample.ms}ms ${sample.ok ? "ok" : "err"}`);
  }
}

/** Wrap an async function so its duration is recorded under `name`. */
export async function perfMeasure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = now();
  let ok = true;
  try {
    return await fn();
  } catch (e) {
    ok = false;
    throw e;
  } finally {
    record({ ts: Date.now(), name, ms: Math.round(now() - t0), ok });
  }
}

/** Manual mark — returns a stop() that records the elapsed time. */
export function perfMark(name: string): () => void {
  const t0 = now();
  return () => record({ ts: Date.now(), name, ms: Math.round(now() - t0), ok: true });
}

/** Snapshot the in-memory ring buffer (read-only). */
export function getPerfSamples(): readonly PerfSample[] {
  return ring.slice();
}

/** Clear the in-memory ring buffer. */
export function clearPerfSamples(): void {
  ring.length = 0;
}