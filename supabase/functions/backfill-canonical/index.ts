// Phase 9 backfill: admin-only, dry-run by default, bounded batches, idempotent.
// Sends no customer emails, creates no services, starts no billing, contacts no supplier.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function isAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, user: null };
  const c = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await c.auth.getUser();
  if (!u.user) return { ok: false, user: null };
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: r } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  return { ok: !!r, user: u.user, admin };
}

type Action = "preflight" | "journeys" | "guest_orders" | "services" | "trackers" | "billing_jobs" | "routing_audit";

async function recon(admin: any, kind: string, ref: string, payload: unknown) {
  await admin.from("admin_reconciliation_tasks").insert({
    task_type: kind, priority: "high", status: "open",
    related_entity_id: ref, reason: kind, payload,
  }).select("id").maybeSingle().catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await isAdmin(req);
    if (!auth.ok) return json({ error: "forbidden" }, 403);
    const admin = auth.admin!;
    const body = await req.json().catch(() => ({}));
    const action: Action = body.action ?? "preflight";
    const dryRun = body.execute !== true; // default to dry-run
    const limit = Math.min(50, Math.max(1, Number(body.batch_size ?? 25)));

    // -------- preflight ----------
    if (action === "preflight") {
      const [j, g, o, s, jobs, tr] = await Promise.all([
        admin.from("order_journeys").select("id", { count: "exact", head: true }).in("status", ["completed", "submitted", "accepted"]).is("order_id", null),
        admin.from("guest_orders").select("id", { count: "exact", head: true }).is("linked_order_id", null),
        admin.from("orders").select("id", { count: "exact", head: true }).is("occta_order_number", null),
        admin.from("services").select("id", { count: "exact", head: true }).is("order_id", null),
        admin.from("first_billing_jobs").select("id", { count: "exact", head: true }).eq("blocker", "awaiting_billing_engine_handover"),
        admin.from("manual_fulfilment_orders").select("id", { count: "exact", head: true }).is("order_id", null),
      ]);
      return json({
        mode: dryRun ? "dry_run" : "execute_default_blocked",
        targets: {
          orphan_completed_journeys: j.count ?? 0,
          orphan_guest_orders: g.count ?? 0,
          orders_missing_occta: o.count ?? 0,
          services_unlinked: s.count ?? 0,
          blocked_first_billing_jobs: jobs.count ?? 0,
          unlinked_trackers: tr.count ?? 0,
        },
      });
    }

    // -------- journeys ----------
    if (action === "journeys") {
      const { data: journeys } = await admin
        .from("order_journeys")
        .select("id, status, customer_id, contract_summary_id, order_id, created_at")
        .in("status", ["completed", "submitted", "accepted"])
        .is("order_id", null)
        .order("created_at", { ascending: true })
        .limit(limit);

      const report: any[] = [];
      for (const j of journeys ?? []) {
        const item: any = { journey_id: j.id, action: "skipped" };
        if (!j.contract_summary_id) {
          item.reason = "no_contract_summary";
          if (!dryRun) await recon(admin, "backfill_journey_missing_cs", j.id, item);
          report.push(item); continue;
        }
        const { data: ca } = await admin.from("contract_acceptances")
          .select("id, customer_id, account_number, accepted_by_email, pdf_storage_key, pdf_sha256, journey_id")
          .eq("contract_summary_id", j.contract_summary_id).maybeSingle();
        if (!ca) { item.reason = "no_acceptance"; if (!dryRun) await recon(admin, "backfill_journey_no_acceptance", j.id, item); report.push(item); continue; }
        if (!ca.pdf_storage_key || !ca.pdf_sha256) {
          item.reason = "acceptance_missing_pdf_or_hash";
          if (!dryRun) await recon(admin, "backfill_journey_missing_pdf", j.id, item);
          report.push(item); continue;
        }

        // Resolve customer
        let customerId = j.customer_id ?? ca.customer_id ?? null;
        if (!customerId && ca.accepted_by_email) {
          const email = ca.accepted_by_email.trim().toLowerCase();
          const { data: matches } = await admin.from("profiles")
            .select("id").ilike("email", email);
          if ((matches?.length ?? 0) === 1) customerId = matches![0].id;
          else if ((matches?.length ?? 0) > 1) {
            item.reason = "ambiguous_email"; if (!dryRun) await recon(admin, "backfill_ambiguous_email", j.id, { email, count: matches!.length });
            report.push(item); continue;
          }
        }
        if (!customerId) { item.reason = "no_customer_match"; if (!dryRun) await recon(admin, "backfill_no_customer", j.id, item); report.push(item); continue; }

        // Check no existing canonical order for this CS already exists
        const { data: existing } = await admin.from("orders").select("id, occta_order_number")
          .or(`contract_summary_id.eq.${j.contract_summary_id},journey_id.eq.${j.id}`).maybeSingle();
        if (existing) {
          item.action = dryRun ? "would_link_existing" : "linked_existing";
          item.order_id = existing.id;
          if (!dryRun) {
            await admin.from("order_journeys").update({ order_id: existing.id }).eq("id", j.id);
          }
          report.push(item); continue;
        }

        // Defer to existing ensureCustomerFromAcceptedContract semantics:
        // We do NOT create canonical orders here — the live journey-submit-order path does that.
        // Instead, flag for manual lifecycle decision.
        item.action = "needs_canonical_order_creation";
        item.customer_id = customerId;
        item.contract_summary_id = j.contract_summary_id;
        if (!dryRun) await recon(admin, "backfill_journey_needs_order", j.id, item);
        report.push(item);
      }
      return json({ mode: dryRun ? "dry_run" : "execute", batch: report.length, report });
    }

    // -------- services link to orders ----------
    if (action === "services") {
      const { data: services } = await admin.from("services")
        .select("id, user_id, contract_summary_id, journey_id, activation_date, status")
        .is("order_id", null).limit(limit);
      const report: any[] = [];
      for (const s of services ?? []) {
        const item: any = { service_id: s.id, action: "skipped" };
        let order: { id: string } | null = null;
        if (s.journey_id) {
          const r = await admin.from("orders").select("id").eq("journey_id", s.journey_id).maybeSingle();
          order = (r.data as any) ?? null;
        }
        if (!order && s.contract_summary_id) {
          const r = await admin.from("orders").select("id").eq("contract_summary_id", s.contract_summary_id).maybeSingle();
          order = (r.data as any) ?? null;
        }
        if (!order) {
          item.reason = "no_deterministic_order_match";
          if (!dryRun) await recon(admin, "backfill_service_no_order", s.id, item);
          report.push(item); continue;
        }
        item.action = dryRun ? "would_link" : "linked";
        item.order_id = order.id;
        if (!dryRun) {
          await admin.from("services").update({ order_id: order.id }).eq("id", s.id);
        }
        report.push(item);
      }
      return json({ mode: dryRun ? "dry_run" : "execute", batch: report.length, report });
    }

    // -------- trackers ----------
    if (action === "trackers") {
      const { data: tr } = await admin.from("manual_fulfilment_orders")
        .select("id, order_id, journey_id, payment_request_id")
        .is("order_id", null).limit(limit);
      const report: any[] = [];
      for (const t of tr ?? []) {
        const item: any = { tracker_id: t.id, action: "skipped" };
        let order: { id: string } | null = null;
        if (t.journey_id) {
          const r = await admin.from("orders").select("id").eq("journey_id", t.journey_id).maybeSingle();
          order = (r.data as any) ?? null;
        }
        if (!order) {
          item.reason = "no_deterministic_match";
          if (!dryRun) await recon(admin, "backfill_tracker_unlinkable", t.id, item);
          report.push(item); continue;
        }
        item.action = dryRun ? "would_link" : "linked";
        item.order_id = order.id;
        if (!dryRun) await admin.from("manual_fulfilment_orders").update({ order_id: order.id }).eq("id", t.id);
        report.push(item);
      }
      return json({ mode: dryRun ? "dry_run" : "execute", batch: report.length, report });
    }

    // -------- billing job classifier ----------
    if (action === "billing_jobs") {
      const { data: jobs } = await admin.from("first_billing_jobs")
        .select("id, order_id, service_id, customer_id, status, blocker, period_start, period_end, activation_date")
        .eq("blocker", "awaiting_billing_engine_handover").limit(limit);
      const report: any[] = [];
      const releaseIds = new Set<string>(body.approve_release_ids ?? []);
      for (const j of jobs ?? []) {
        const item: any = { job_id: j.id, classification: "manual_review_required" };
        const [{ data: ord }, { data: svc }, { data: inv }] = await Promise.all([
          admin.from("orders").select("id, lifecycle_status, billing_anchor_day, payment_method_id").eq("id", j.order_id).maybeSingle(),
          admin.from("services").select("id, status, billing_enabled, actual_activation_date, billing_anchor_day").eq("id", j.service_id).maybeSingle(),
          admin.from("invoices").select("id").eq("service_id", j.service_id).eq("billing_period_start", j.period_start).eq("billing_period_end", j.period_end).maybeSingle(),
        ]);
        if (j.status === "sent" || j.status === "processed") item.classification = "already_processed";
        else if (inv) item.classification = "duplicate";
        else if (!ord || !svc) item.classification = "missing_data";
        else if (ord.lifecycle_status === "cancelled" || ord.lifecycle_status === "on_hold" || svc.status === "cancelled" || svc.billing_enabled === false) item.classification = "cancelled_or_held";
        else if (ord.lifecycle_status === "live" && svc.status === "active" && svc.actual_activation_date && (ord.billing_anchor_day || svc.billing_anchor_day) && ord.payment_method_id) item.classification = "safe_to_release";
        else item.classification = "manual_review_required";

        if (!dryRun && item.classification === "safe_to_release" && releaseIds.has(j.id)) {
          const { error } = await admin.from("first_billing_jobs")
            .update({ blocker: null, status: "pending", updated_at: new Date().toISOString() })
            .eq("id", j.id).eq("blocker", "awaiting_billing_engine_handover");
          item.released = !error;
        }
        report.push(item);
      }
      const summary = report.reduce<Record<string, number>>((a, r) => (a[r.classification] = (a[r.classification] ?? 0) + 1, a), {});
      return json({ mode: dryRun ? "dry_run" : "execute", batch: report.length, summary, report });
    }

    // -------- routing audit ----------
    if (action === "routing_audit") {
      const { count: customersWithoutOcc } = await admin.from("orders").select("customer_id", { count: "exact", head: true }).is("occta_order_number", null);
      return json({
        admin_link_format_required: "/admin/customers/{account_number}",
        canonical_orders_without_occta_number: customersWithoutOcc ?? 0,
        note: "UI links live in src/lib/adminLinks.ts and always use account_number; missing numbers fall through to reconciliation queue.",
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: "exception", detail: String((e as Error)?.message ?? e) }, 500);
  }
});