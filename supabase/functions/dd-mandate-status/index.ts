// Admin-initiated Direct Debit mandate status change.
//
// OCCTA submits mandates MANUALLY in one of two provider portals (FastPay Ltd,
// AccessPay / APS Re OCCTA). This function performs NO provider API call: it
// records what the admin did, writes status + history + the customer
// notification atomically via public.dd_admin_change_mandate_status, then asks
// the outbox worker to deliver the notification server-side.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const roles = await Promise.all(
      ["admin", "super_admin", "finance_admin"].map((r) =>
        admin.rpc("has_role", { _user_id: user.id, _role: r }).then((x) => !!x.data),
      ),
    );
    if (!roles.some(Boolean)) return json({ success: false, error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      mandateId,
      newStatus,
      providerCode = null,
      providerReference = null,
      submittedAt = null,
      internalNote = null,
      overrideReason = null,
    } = body ?? {};

    if (!mandateId || !newStatus) return json({ success: false, error: "mandateId and newStatus are required" }, 400);

    const { data, error } = await admin.rpc("dd_admin_change_mandate_status", {
      _mandate_id: mandateId,
      _new_status: newStatus,
      _provider_code: providerCode,
      _provider_reference: providerReference,
      _submitted_at: submittedAt,
      _internal_note: internalNote,
      _override_reason: overrideReason,
      _actor: user.id,
    });

    if (error) return json({ success: false, error: error.message }, 500);
    const result = data as Record<string, unknown>;
    if (!result?.success) return json(result ?? { success: false, error: "unknown_error" }, 400);

    // Deliver the notification server-side. A failure here leaves the outbox
    // row pending for the next drain — the status change is already committed.
    let notification = String(result.outbox_status ?? "pending");
    try {
      const { data: worked } = await admin.functions.invoke("dd-outbox-worker", {
        body: { outboxId: result.outbox_id },
      });
      const first = (worked as { results?: Array<{ status?: string }> })?.results?.[0];
      if (first?.status) notification = first.status;
    } catch (_err) {
      notification = "pending";
    }

    return json({ ...result, notification_status: notification });
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "unknown_error" }, 500);
  }
});