// REVIEW-ONLY overdue detection.
//
// This worker no longer applies late fees, suspends services, sends
// suspension/escalation emails, or promises reconnection charges. OCCTA's
// v2026.10.1 terms allow a £10 admin charge only after an overdue notice and a
// reasonable opportunity to pay, applied once and only where lawful — that
// needs a human decision. So the job only finds overdue invoices and creates
// one admin review task per invoice. Invoice, balance and service rows are
// never modified here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildOverdueReviewTask, isReviewableOverdue } from "./review.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_JOB_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date();

  const { data: invoices, error } = await db.from("invoices")
    .select("id, invoice_number, user_id, total, due_date, status")
    .not("status", "in", "(paid,cancelled,void,written_off,draft)")
    .lt("due_date", now.toISOString().slice(0, 10))
    .limit(500);
  if (error) return json({ success: false, error: "invoice_query_failed" }, 500);

  const results = { overdue_detected: 0, review_tasks_created: 0, already_queued: 0, late_fees_applied: 0, services_suspended: 0 };
  for (const inv of invoices ?? []) {
    if (!isReviewableOverdue(inv, now)) continue;
    results.overdue_detected++;
    const task = buildOverdueReviewTask(inv, now);
    const { data: existing } = await db.from("admin_tasks").select("id")
      .eq("title", task.title).in("status", ["open", "in_progress"]).limit(1).maybeSingle();
    if (existing) { results.already_queued++; continue; }
    const { error: te } = await db.from("admin_tasks").insert(task);
    if (!te) results.review_tasks_created++;
  }
  return json({ success: true, mode: "review_only", ...results });
});
