/**
 * supabase.functions.invoke drops the JSON body on non-2xx responses and only
 * exposes "Edge Function returned a non-2xx status code". Read the real
 * { error, message } the function sent so staff/customers see a clear reason.
 */
export async function readFunctionErrorBody(error: unknown): Promise<Record<string, any> | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (!ctx || typeof (ctx as Response).clone !== "function") return null;
  try {
    const body = await (ctx as Response).clone().json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}
