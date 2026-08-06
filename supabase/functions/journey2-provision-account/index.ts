/**
 * Journey 2 — provision the customer account AFTER the order has committed.
 *
 * Supabase Auth cannot take part in a Postgres transaction, so the order and an
 * account-provisioning outbox row are committed atomically first, and the auth
 * customer is created and linked here, idempotently. If order creation had
 * failed there would be no outbox row and therefore never an orphan customer.
 *
 * Service-role only. Never runs for a test session.
 */
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";
import { ensureCustomerFromAcceptedContract } from "../_shared/ensureCustomer.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({ order_id: z.string().uuid().optional(), process_pending: z.boolean().optional() });

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return !!key && auth === `Bearer ${key}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!isServiceRole(req)) return jsonResponse({ error: "forbidden" }, 403);

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "validation" }, 400);

  const supabase = getServiceClient();
  const q = supabase
    .from("journey2_account_provisioning")
    .select("id, order_id, session_id, email, status, retry_count")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(parsed.data.order_id ? 1 : 25);
  const { data: rows } = parsed.data.order_id ? await q.eq("order_id", parsed.data.order_id) : await q;

  const results: { order_id: string; ok: boolean; detail?: string }[] = [];

  for (const row of rows ?? []) {
    await supabase.from("journey2_account_provisioning")
      .update({ status: "provisioning", last_attempt_at: new Date().toISOString() })
      .eq("id", row.id);

    const { data: order } = await supabase
      .from("orders")
      .select("id, journey_id, contract_summary_id, contract_acceptance_id, journey_version")
      .eq("id", row.order_id)
      .maybeSingle();
    if (!order?.journey_id || !order.contract_summary_id) {
      await supabase.from("journey2_account_provisioning").update({
        status: "failed", retry_count: row.retry_count + 1, last_error: "order_incomplete",
      }).eq("id", row.id);
      results.push({ order_id: row.order_id, ok: false, detail: "order_incomplete" });
      continue;
    }

    const ec = await ensureCustomerFromAcceptedContract(supabase, {
      journey_id: order.journey_id,
      contract_summary_id: order.contract_summary_id,
      contract_acceptance_id: order.contract_acceptance_id ?? null,
    });
    if (!ec.ok || !ec.customer_id) {
      await supabase.from("journey2_account_provisioning").update({
        status: "failed",
        retry_count: row.retry_count + 1,
        last_error: String(ec.reason ?? "ensure_customer_failed").slice(0, 400),
      }).eq("id", row.id);
      results.push({ order_id: row.order_id, ok: false, detail: ec.reason ?? "ensure_customer_failed" });
      continue;
    }

    const { data: linked } = await supabase.rpc("journey2_link_provisioned_account", {
      _order_id: row.order_id,
      _user_id: ec.customer_id,
    });
    const ok = !!(linked as any)?.ok;
    if (!ok) {
      await supabase.from("journey2_account_provisioning").update({
        status: "failed", retry_count: row.retry_count + 1,
        last_error: String((linked as any)?.error ?? "link_failed"),
      }).eq("id", row.id);
    }
    results.push({ order_id: row.order_id, ok, detail: ok ? undefined : "link_failed" });
  }

  return jsonResponse({ ok: true, processed: results.length, results });
});
