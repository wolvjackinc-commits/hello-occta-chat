/**
 * Edge-function performance instrumentation.
 *
 * Wrap a handler to emit ONE redacted JSON line per invocation:
 *   {"perf":1,"fn":"journey-state","total_ms":42,"status":200,"method":"POST"}
 *
 * Strictly forbidden in this log line:
 *  - tokens, hashes of tokens, account numbers, emails, phone numbers
 *  - bank or card data, passwords
 *  - request or response bodies, signed storage URLs
 *
 * The handler may add small numeric sub-timings via `ctx.mark(label, ms)`
 * (label must be a literal like "db_ms", "pdf_ms", "storage_ms",
 * "signed_url_ms", "cache_hit"). Anything else is ignored.
 */

const ALLOWED_LABELS = new Set([
  "db_ms",
  "pdf_ms",
  "storage_ms",
  "signed_url_ms",
  "cache_hit",
]);

export type PerfCtx = {
  mark: (label: string, value: number | boolean) => void;
};

export function perfServe(
  fn: string,
  handler: (req: Request, ctx: PerfCtx) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const t0 = performance.now();
    const extra: Record<string, number | boolean> = {};
    const ctx: PerfCtx = {
      mark(label, value) {
        if (!ALLOWED_LABELS.has(label)) return;
        if (typeof value === "number") {
          extra[label] = Math.round(value);
        } else {
          extra[label] = value;
        }
      },
    };
    let status = 0;
    let ok = false;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      ok = res.ok;
      return res;
    } catch (e) {
      status = 500;
      throw e;
    } finally {
      const total_ms = Math.round(performance.now() - t0);
      // Single redacted JSON line — no headers, no body, no URL.
      try {
        console.log(
          JSON.stringify({
            perf: 1,
            fn,
            method: req.method,
            status,
            ok,
            total_ms,
            ...extra,
          }),
        );
      } catch {
        // never throw from logging
      }
    }
  };
}