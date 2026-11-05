/**
 * Runs best-effort work after the response is sent (Supabase EdgeRuntime.waitUntil).
 * Without the runtime hook it returns the task so the caller can await it and
 * behaviour stays exactly as before.
 */
export function afterResponse(label: string, task: () => Promise<unknown>): Promise<void> | undefined {
  const run = Promise.resolve().then(task).then(() => {}, (e) => console.warn(`[${label}]`, (e as Error)?.message ?? e));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) {
    rt.waitUntil(run);
    return undefined;
  }
  return run;
}
