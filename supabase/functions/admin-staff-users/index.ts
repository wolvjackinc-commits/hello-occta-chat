// Staff logins (admin / super_admin only): create a staff account with a
// password and role, reset a password, or switch a login off / on.
// Staff sign in at /auth with their email (username) and password.
import { getServiceClient, jsonResponse, corsHeaders, requireStaff } from "../_shared/quoteHelpers.ts";

const ROLES = ["sales_agent", "sales_admin", "support_agent", "finance_admin", "compliance_admin", "marketing_admin", "auditor", "ticket_admin", "business_admin", "admin"];

function passwordProblem(p: string): string | null {
  if (p.length < 12) return "password_min_12_characters";
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return "password_needs_upper_lower_and_number";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const staff = await requireStaff(req, ["admin", "super_admin"]);
  if ("error" in staff) return jsonResponse({ error: staff.error }, staff.status);
  const svc = getServiceClient();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const audit = (act: string, entity: string | null, meta: Record<string, unknown>) =>
    svc.from("audit_logs").insert({ actor_user_id: staff.userId, action: act, entity: "staff_user", entity_id: entity, metadata: meta });

  if (action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.full_name ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonResponse({ error: "valid_email_required" }, 400);
    if (name.length < 2) return jsonResponse({ error: "name_required" }, 400);
    if (!ROLES.includes(role)) return jsonResponse({ error: "invalid_role" }, 400);
    const bad = passwordProblem(password);
    if (bad) return jsonResponse({ error: bad }, 400);
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, staff: true } });
    if (error || !data.user) return jsonResponse({ error: /already/i.test(error?.message ?? "") ? "email_already_has_an_account" : "create_failed", detail: error?.message }, 400);
    const id = data.user.id;
    await svc.from("profiles").upsert({ id, email, full_name: name }, { onConflict: "id" });
    const { error: rerr } = await svc.from("user_roles").insert({ user_id: id, role });
    if (rerr) return jsonResponse({ error: "role_failed", detail: rerr.message }, 500);
    await audit("staff.create", id, { email, role });
    return jsonResponse({ ok: true, user_id: id, email, role });
  }

  if (action === "reset_password") {
    const id = String(body.user_id ?? "");
    const bad = passwordProblem(String(body.password ?? ""));
    if (bad) return jsonResponse({ error: bad }, 400);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", id);
    if (!(roles ?? []).some((r: { role: string }) => r.role !== "user")) return jsonResponse({ error: "not_a_staff_account" }, 400);
    const { error } = await svc.auth.admin.updateUserById(id, { password: String(body.password) });
    if (error) return jsonResponse({ error: "reset_failed", detail: error.message }, 400);
    await audit("staff.reset_password", id, {});
    return jsonResponse({ ok: true });
  }

  if (action === "set_active") {
    const id = String(body.user_id ?? "");
    if (id === staff.userId) return jsonResponse({ error: "cannot_disable_yourself" }, 400);
    const active = body.active === true;
    const { error } = await svc.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    if (error) return jsonResponse({ error: "update_failed", detail: error.message }, 400);
    await audit(active ? "staff.enable" : "staff.disable", id, {});
    return jsonResponse({ ok: true, active });
  }

  if (action === "list") {
    const { data: roles } = await svc.from("user_roles").select("user_id, role").neq("role", "user");
    const ids = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))];
    const out = [];
    for (const id of ids) {
      const { data } = await svc.auth.admin.getUserById(id);
      const usr = data?.user as { email?: string; banned_until?: string; last_sign_in_at?: string; user_metadata?: { full_name?: string } } | undefined;
      out.push({ user_id: id, email: usr?.email ?? null, full_name: usr?.user_metadata?.full_name ?? null,
        roles: (roles ?? []).filter((r: { user_id: string }) => r.user_id === id).map((r: { role: string }) => r.role),
        active: !usr?.banned_until || new Date(usr.banned_until) < new Date(), last_sign_in_at: usr?.last_sign_in_at ?? null });
    }
    return jsonResponse({ ok: true, staff: out });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});
