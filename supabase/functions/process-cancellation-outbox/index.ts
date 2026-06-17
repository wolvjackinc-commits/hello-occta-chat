import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);

const gbp = (minor?: number | null) =>
  minor == null ? "—" : `£${(Math.round(minor) / 100).toFixed(2)}`;

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return iso; }
};

function buildHtml(kind: string, c: any, dashboardUrl: string) {
  const p = c.preview_snapshot ?? {};
  const head = (title: string, body: string) => `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#fff">
    <div style="max-width:600px;margin:0 auto;padding:24px;border:4px solid #111">
      <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>${body}
      <p style="margin-top:24px"><a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border:2px solid #111;font-weight:bold">Open dashboard</a></p>
      <p style="font-size:12px;color:#666;margin-top:24px">No contracts. No pressure.</p>
    </div></body></html>`;
  if (kind === "acknowledgement") {
    return head("Your cancellation request has been received",
      `<p>Thanks — we've recorded your cancellation request.</p>
       <p>Your service will not stop immediately. We'll review your accepted agreement, confirm any notice period or early termination charge, and provide the proposed cease date and final balance before completing the cancellation.</p>`);
  }
  if (kind === "confirmed_cease") {
    return head("Your proposed cease date and final balance",
      `<p>We've reviewed your accepted agreement.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
         <tr><td style="padding:6px 0;color:#555">Proposed cease date</td><td style="text-align:right"><b>${escapeHtml(fmtDate(p.proposed_cease_date))}</b></td></tr>
         <tr><td style="padding:6px 0;color:#555">Notice period</td><td style="text-align:right">${escapeHtml(String(p.notice_period_days ?? "—"))} days</td></tr>
         <tr><td style="padding:6px 0;color:#555">Service charges to cease</td><td style="text-align:right">${gbp(p.unbilled_service_minor)}</td></tr>
         <tr><td style="padding:6px 0;color:#555">Unpaid invoices</td><td style="text-align:right">${gbp(p.unpaid_invoices_minor)}</td></tr>
         ${p.etf_minor ? `<tr><td style="padding:6px 0;color:#555">Early termination charge</td><td style="text-align:right">${gbp(p.etf_minor)}</td></tr>` : ""}
         <tr><td style="padding:6px 0;color:#555">Credits</td><td style="text-align:right">${gbp(p.credits_minor)}</td></tr>
         <tr><td style="padding:6px 0;color:#555"><b>Estimated final balance</b></td><td style="text-align:right"><b>${gbp(p.final_balance_minor)}</b></td></tr>
       </table>
       <p style="font-size:12px;color:#666">These figures remain subject to confirmation by our team.</p>`);
  }
  // completed
  return head("Your service has been cancelled",
    `<p>Your service has been ceased on <b>${escapeHtml(fmtDate(c.actual_cease_date))}</b>.</p>
     <p>If there is a final invoice or credit note, you'll find it on your dashboard.</p>`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_JOB_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader && cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("cancellation_email_outbox")
    .select("id, case_id, email_type, recipient_email, attempts, status")
    .in("status", ["pending", "retry_scheduled"])
    .lte("next_attempt_at", nowIso)
    .limit(25);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of due ?? []) {
    const { data: claimed } = await supabase
      .from("cancellation_email_outbox")
      .update({ status: "processing", last_attempted_at: nowIso })
      .eq("id", row.id)
      .in("status", ["pending", "retry_scheduled"])
      .select("id").maybeSingle();
    if (!claimed) { results.push({ id: row.id, skipped: true }); continue; }

    try {
      if (!row.recipient_email) throw new Error("missing_recipient");
      const { data: c } = await supabase
        .from("service_cancellation_cases")
        .select("preview_snapshot, actual_cease_date, proposed_cease_date")
        .eq("id", row.case_id).maybeSingle();
      const dashboardUrl = (Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://www.occta.co.uk") + "/dashboard";
      const html = buildHtml(row.email_type, c ?? {}, dashboardUrl);
      const subject =
        row.email_type === "acknowledgement" ? "We've received your cancellation request" :
        row.email_type === "confirmed_cease" ? "Your proposed cease date and final balance" :
        "Your service has been cancelled";

      const sendResp = await supabase.functions.invoke("send-email", {
        body: {
          to: row.recipient_email,
          subject,
          html,
          idempotencyKey: `cancel-email:${row.id}`,
        },
      });
      if (sendResp.error) throw new Error(sendResp.error.message || "send_failed");

      await supabase.from("cancellation_email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          provider_message_id: (sendResp.data as any)?.message_id ?? null,
          last_error: null,
        }).eq("id", row.id);
      results.push({ id: row.id, sent: true });
    } catch (e) {
      const attempts = (row.attempts ?? 0) + 1;
      const giveUp = attempts >= 8;
      const backoffMin = Math.min(60, Math.pow(2, attempts));
      await supabase.from("cancellation_email_outbox")
        .update({
          status: giveUp ? "failed" : "retry_scheduled",
          attempts,
          last_error: String((e as Error)?.message ?? e).slice(0, 1000),
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
        }).eq("id", row.id);
      results.push({ id: row.id, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});