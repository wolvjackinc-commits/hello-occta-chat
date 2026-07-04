import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper around supabase.functions.invoke that surfaces the ORIGINAL
 * backend error instead of the generic "Edge Function returned a
 * non-2xx status code" message.
 *
 * Returns `{ data, error }` — where `error` is a plain `Error` whose
 * message is the most specific reason we could extract from the
 * response body (JSON `{error|message|detail}`) or headers.
 */
export async function invokeFn<T = any>(
  name: string,
  options?: Parameters<typeof supabase.functions.invoke>[1],
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(name, options as any);
    if (!error) {
      // The function itself may still have returned { error: "..." }.
      const bodyErr = (data as any)?.error || (data as any)?.message;
      if (bodyErr && (data as any)?.success === false) {
        return { data: (data as T) ?? null, error: new Error(String(bodyErr)) };
      }
      return { data: (data as T) ?? null, error: null };
    }

    // Try to read the underlying response body for a real reason.
    let detail: string | null = null;
    const ctx: any = (error as any).context;
    try {
      if (ctx && typeof ctx.text === "function") {
        const txt = await ctx.text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt);
            detail =
              parsed?.error ||
              parsed?.message ||
              parsed?.detail ||
              parsed?.hint ||
              null;
          } catch {
            detail = txt.length > 400 ? `${txt.slice(0, 400)}…` : txt;
          }
        }
      }
    } catch {
      /* ignore body-read failures — fall back to original message */
    }

    // Response body may already be attached as JSON on the data slot.
    if (!detail && data && typeof data === "object") {
      detail = (data as any).error || (data as any).message || null;
    }

    const msg = detail || error.message || `${name} failed`;
    return { data: (data as T) ?? null, error: new Error(msg) };
  } catch (e: any) {
    return { data: null, error: new Error(e?.message || `${name} failed`) };
  }
}