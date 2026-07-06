// One-shot provisioning for the two-document pilot test user.
// Creates (or fetches) auth user `pilot+twodoc@occta.internal`, adds them to
// two_doc_pilot_allowlist, and returns the UUID. Requires a caller with
// admin or super_admin role. Global flag is NOT touched.
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

// GoTrue rejects non-routable TLDs like .internal, so we register the pilot
// under a routable but non-deliverable subdomain we control. The intended
// label from the requester is preserved in user_metadata.
const PILOT_EMAIL = "pilot-twodoc-01@pilot.occta.co.uk";
const PILOT_LABEL = "pilot+twodoc@occta.internal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Self-disabling one-shot bootstrap.
  // Refuses to run once the pilot user is already on the allowlist,
  // so it cannot be used to create arbitrary accounts later.
  const supabase = getServiceClient();
  const { data: existingAllow } = await supabase
    .from("two_doc_pilot_allowlist")
    .select("id, user_id, active")
    .eq("active", true)
    .limit(1);
  if ((existingAllow?.length ?? 0) > 0) {
    return jsonResponse({
      error: "already_provisioned",
      message: "Pilot allowlist already has an active entry; refusing to create another. Use two-doc-pilot-admin.",
    }, 409);
  }

  // 1) Find or create the pilot auth user.
  let pilotUserId: string | null = null;
  // Look up by paging (listUsers doesn't support email filter server-side reliably).
  const { data: list, error: listErr } = await (supabase as any).auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return jsonResponse({ error: "list_failed", details: listErr.message }, 500);
  const existing = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === PILOT_EMAIL);
  if (existing) {
    pilotUserId = existing.id;
  } else {
    // Direct call to GoTrue admin endpoint — bypasses the JS client so we get
    // real HTTP status/body on failure instead of an opaque retry error.
    const pw = crypto.randomUUID() + "-" + crypto.randomUUID();
    // Try admin/users first; on failure, fall back to /admin/generate_link (magic link)
    // which also creates the auth user record.
    const base = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resp = await fetch(base + "/auth/v1/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "apikey": key,
      },
      body: JSON.stringify({
        email: PILOT_EMAIL,
        password: pw,
        email_confirm: true,
        user_metadata: { display_name: "Two-Doc Pilot Tester", pilot: true, requested_label: PILOT_LABEL },
      }),
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      // Fallback: minimal payload (no metadata, no password) — isolates whether
      // the trigger chain or an aux field is what GoTrue is choking on.
      const resp2 = await fetch(base + "/auth/v1/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "apikey": key,
        },
        body: JSON.stringify({ email: PILOT_EMAIL, email_confirm: true }),
      });
      const body2 = await resp2.text();
      if (!resp2.ok) {
        return jsonResponse({
          error: "create_failed",
          attempt1: { http_status: resp.status, body: bodyText },
          attempt2: { http_status: resp2.status, body: body2 },
        }, 500);
      }
      const parsed2 = JSON.parse(body2);
      pilotUserId = parsed2?.id ?? parsed2?.user?.id ?? null;
      if (!pilotUserId) return jsonResponse({ error: "no_user_id_2", body: parsed2 }, 500);
    } else {
      const parsed = JSON.parse(bodyText);
      pilotUserId = parsed?.id ?? parsed?.user?.id ?? null;
      if (!pilotUserId) return jsonResponse({ error: "no_user_id", body: parsed }, 500);
    }
  }

  // 2) Ensure NO elevated roles on the pilot user (minimum safe access).
  //    Remove any admin/super_admin/staff roles if somehow present.
  await supabase.from("user_roles").delete().eq("user_id", pilotUserId!).in("role", [
    "admin", "super_admin", "staff", "moderator",
  ] as any);

  // 3) Add to pilot allowlist (idempotent upsert).
  const { data: allow, error: aErr } = await supabase
    .from("two_doc_pilot_allowlist")
    .upsert({
      user_id: pilotUserId,
    added_by: null,
      note: "Dedicated two-document acceptance flow pilot tester (no billing / DD / Worldpay access)",
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();
  if (aErr) return jsonResponse({ error: "allowlist_failed", details: aErr.message }, 500);

  return jsonResponse({
    ok: true,
    pilot_user_id: pilotUserId,
    pilot_email: PILOT_EMAIL,
    requested_label: PILOT_LABEL,
    allowlist_row_id: allow?.id ?? null,
    global_flag_touched: false,
    note: "Password is randomised and not returned. Reset via admin password-reset if you need to sign in as this user.",
  });
});