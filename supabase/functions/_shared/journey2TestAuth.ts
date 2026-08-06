/**
 * Journey 2 — authorisation for the isolated test path.
 *
 * Only a server-validated admin/super_admin, or the internal service role,
 * may drive an isolated test journey. `admin_test: true` from a browser is
 * never trusted anywhere in the system.
 *
 * A third, deliberately narrow route exists for automated deployment
 * verification: a single-use, short-lived ticket whose SHA-256 hash is stored
 * in `journey2_test_tickets`. The plaintext is never stored, the row is
 * decremented on every use and ignored once expired or exhausted.
 */
import { requireStaff, getServiceClient } from "./quoteHelpers.ts";

export type TestCaller =
  | { ok: true; actor: "admin" | "service" | "ticket"; userId: string | null }
  | { ok: false; status: number; error: string };

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function consumeTicket(ticket: string): Promise<boolean> {
  if (ticket.length < 32) return false;
  const supabase = getServiceClient();
  const hash = await sha256Hex(ticket);
  const { data } = await supabase.from("journey2_test_tickets")
    .select("id, uses_remaining, expires_at").eq("token_sha256", hash).maybeSingle();
  if (!data) return false;
  if (Number(data.uses_remaining) <= 0) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) return false;
  await supabase.from("journey2_test_tickets")
    .update({ uses_remaining: Number(data.uses_remaining) - 1, last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

export async function authoriseTestCaller(req: Request): Promise<TestCaller> {
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (svc && auth === svc) return { ok: true, actor: "service", userId: null };
  const ticket = (req.headers.get("x-journey2-test-ticket") ?? "").trim();
  if (ticket && await consumeTicket(ticket)) return { ok: true, actor: "ticket", userId: null };
  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if ("userId" in staff) return { ok: true, actor: "admin", userId: staff.userId };
  return { ok: false, status: staff.status ?? 403, error: staff.error ?? "forbidden" };
}