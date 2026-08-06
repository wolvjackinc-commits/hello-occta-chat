/**
 * Journey 2 — authorisation for the isolated test path.
 *
 * Only a server-validated admin/super_admin, or the internal service role,
 * may drive an isolated test journey. `admin_test: true` from a browser is
 * never trusted anywhere in the system.
 */
import { requireStaff } from "./quoteHelpers.ts";

export type TestCaller =
  | { ok: true; actor: "admin" | "service"; userId: string | null }
  | { ok: false; status: number; error: string };

export async function authoriseTestCaller(req: Request): Promise<TestCaller> {
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (svc && auth === svc) return { ok: true, actor: "service", userId: null };
  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if ("userId" in staff) return { ok: true, actor: "admin", userId: staff.userId };
  return { ok: false, status: staff.status ?? 403, error: staff.error ?? "forbidden" };
}