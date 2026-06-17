import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function sha256(s: string) {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET");
  const auth = req.headers.get("Authorization");
  if (!auth && cronSecret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from("first_billing_jobs")
    .select("*")
    .in("status", ["pending", "retry_scheduled"])
    .lte("next_attempt_at", nowIso)
    .limit(25);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const job of jobs ?? []) {
    // Claim.
    const { data: claimed } = await supabase
      .from("first_billing_jobs")
      .update({ status: "processing", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .in("status", ["pending", "retry_scheduled"])
      .select("id").maybeSingle();
    if (!claimed) { results.push({ id: job.id, skipped: true }); continue; }

    try {
      // Re-read canonical state.
      const { data: ord } = await supabase
        .from("orders")
        .select("id, lifecycle_status, payment_method_id, customer_id, occta_order_number")
        .eq("id", job.order_id).maybeSingle();
      if (!ord || ord.lifecycle_status !== "live")
        throw new Error("order_not_live");

      const { data: svc } = await supabase.from("services")
        .select("id, status, plan_name, service_type, price_monthly, user_id")
        .eq("id", job.service_id).maybeSingle();
      if (!svc || svc.status !== "active") throw new Error("service_not_active");

      const { data: pm } = await supabase.from("payment_methods")
        .select("method, dd_setup_status, active")
        .eq("id", ord.payment_method_id!).maybeSingle();
      if (!pm) throw new Error("payment_method_missing");

      // Compute amount in pence via DB helper (stays consistent with stored inputs).
      const { data: amtMinor } = await supabase.rpc("compute_first_billing_amount_minor", {
        _monthly_minor: job.amount_minor,
        _billable_days: job.billable_days,
        _full_cycle_days: job.full_cycle_days,
        _is_pro_rata: job.is_pro_rata,
      });
      const totalMinor = Number(amtMinor ?? job.amount_minor ?? 0);
      const total = Math.round(totalMinor) / 100;

      // Idempotency: only one invoice per (service, period, type='first_pro_rata'|'monthly').
      const invoiceType = job.is_pro_rata ? "first_pro_rata" : "monthly";
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id, invoice_number, status")
        .eq("service_id", job.service_id)
        .eq("billing_period_start", job.period_start)
        .eq("billing_period_end", job.period_end)
        .eq("invoice_type", invoiceType)
        .maybeSingle();

      let invoiceId = existingInv?.id ?? job.invoice_id ?? null;
      let invoiceNumber = existingInv?.invoice_number ?? null;
      let invoiceStatus = existingInv?.status ?? null;

      if (!invoiceId) {
        const { data: invNumData } = await supabase.rpc("generate_invoice_number");
        invoiceNumber = invNumData || `INV-${Date.now().toString(36).toUpperCase()}`;

        const ddPending = pm.method === "direct_debit" && pm.dd_setup_status !== "active";
        invoiceStatus = pm.method === "direct_debit"
          ? (ddPending ? "dd_setup_pending" : "awaiting_direct_debit")
          : "sent";

        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);

        const { data: inv, error: invErr } = await supabase.from("invoices").insert({
          user_id: svc.user_id,
          service_id: job.service_id,
          order_id: job.order_id,
          invoice_number: invoiceNumber,
          status: invoiceStatus,
          issue_date: today,
          due_date: dueDate.toISOString().slice(0, 10),
          billing_period_start: job.period_start,
          billing_period_end: job.period_end,
          invoice_type: invoiceType,
          subtotal: total,
          vat_total: 0,
          total,
          totals: {
            amount_minor: totalMinor,
            monthly_minor: job.amount_minor,
            billable_days: job.billable_days,
            full_cycle_days: job.full_cycle_days,
            is_pro_rata: job.is_pro_rata,
            calc_method: job.calc_method,
          },
          notes: job.is_pro_rata
            ? `First (pro-rata) invoice: ${job.billable_days} of ${job.full_cycle_days} days`
            : `First monthly invoice`,
        }).select("id").single();
        if (invErr) throw invErr;
        invoiceId = inv.id;

        await supabase.from("invoice_lines").insert({
          invoice_id: invoiceId,
          description: `${svc.plan_name ?? svc.service_type} — ${job.is_pro_rata ? "pro-rata " : ""}service (${job.period_start} to ${job.period_end})`,
          qty: 1,
          unit_price: total,
          line_total: total,
          vat_rate: 0,
        });
      }

      // Branch on payment method.
      let prId: string | null = job.payment_request_id ?? null;
      let ddTaskId: string | null = job.dd_setup_task_id ?? null;

      if (pm.method === "invoice_link") {
        if (!prId) {
          const { data: existingPR } = await supabase
            .from("payment_requests").select("id")
            .eq("invoice_id", invoiceId).maybeSingle();
          if (existingPR) prId = existingPR.id;
          else {
            const token = crypto.randomUUID();
            const tokenHash = await sha256(token);
            const expires = new Date(); expires.setDate(expires.getDate() + 14);
            const { data: pr, error: prErr } = await supabase
              .from("payment_requests").insert({
                type: "card_payment",
                invoice_id: invoiceId,
                user_id: svc.user_id,
                customer_email: "", // populated by send step
                customer_name: "Customer",
                amount: total,
                currency: "GBP",
                status: "sent",
                expires_at: expires.toISOString(),
                token_hash: tokenHash,
                notes: `First invoice ${invoiceNumber}`,
              }).select("id").single();
            if (prErr) throw prErr;
            prId = pr.id;
          }
        }
      } else if (pm.method === "direct_debit") {
        if (pm.dd_setup_status !== "active" && !ddTaskId) {
          const { data: task } = await supabase.from("admin_tasks").insert({
            title: `Direct Debit setup pending for invoice ${invoiceNumber}`,
            description: `Customer's Direct Debit is not yet active for order ${ord.occta_order_number ?? job.order_id}. Issue a Worldpay fallback link if appropriate.`,
            priority: "high",
            status: "open",
            created_by: ord.customer_id ?? svc.user_id,
            related_customer_id: ord.customer_id ?? svc.user_id,
          }).select("id").maybeSingle();
          ddTaskId = task?.id ?? null;
        }
      }

      await supabase.from("first_billing_jobs").update({
        status: "done",
        invoice_id: invoiceId,
        payment_request_id: prId,
        dd_setup_task_id: ddTaskId,
        processed_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id);

      results.push({ id: job.id, invoice_id: invoiceId, method: pm.method });
    } catch (e) {
      const attempts = (job.attempts ?? 0) + 1;
      const giveUp = attempts >= 6;
      const backoff = Math.min(120, Math.pow(2, attempts));
      const next = new Date(Date.now() + backoff * 60_000).toISOString();
      await supabase.from("first_billing_jobs").update({
        status: giveUp ? "failed" : "retry_scheduled",
        attempts,
        last_error: String((e as Error)?.message ?? e).slice(0, 1000),
        next_attempt_at: next,
      }).eq("id", job.id);
      results.push({ id: job.id, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});