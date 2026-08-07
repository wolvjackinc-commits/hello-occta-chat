import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/quoteHelpers.ts";

/**
 * Internal bulk quote resend worker.
 *
 * Cron/service only (x-cron-secret). Resends live quotes to customers who have
 * NOT accepted, overriding a red margin check first (audited), extending expiry
 * when needed, and logging every action.
 */
const ELIGIBLE_STATUSES = ["sent", "viewed", "approved", "contract_summary_generated"];
const ACCEPTED_STATUSES = ["contract_summary_accepted", "accepted", "converted"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const provided = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_JOB_SECRET") || Deno.env.get("CRON_SECRET");
  if (!expected || !provided || provided !== expected) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({})) as {
    dry_run?: boolean;
    skip_test_records?: boolean;
    quote_ids?: string[];
    override_reason?: string;
  };
  const dryRun = body.dry_run === true;
  const skipTest = body.skip_test_records !== false;
  const overrideReason = (body.override_reason || "Bulk quote resend campaign: margin override authorised by admin to re-engage customers who have not yet accepted.").slice(0, 500);

  const supabase = getServiceClient();
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, quote_number, status, quote_request_id, customer_id, expires_at, monthly_gross, plan_type, contract_length_months")
    .in("status", ELIGIBLE_STATUSES)
    .order("created_at", { ascending: false });
  if (error) return jsonResponse({ error: error.message }, 500);

  // Customers who already accepted anywhere -> never contact again in this run.
  const { data: acceptedRows } = await supabase
    .from("quotes")
    .select("quote_request_id")
    .in("status", ACCEPTED_STATUSES);
  const acceptedRequestIds = new Set((acceptedRows ?? []).map((r: any) => r.quote_request_id));

  const requestIds = [...new Set((quotes ?? []).map((q: any) => q.quote_request_id).filter(Boolean))];
  const reqMap = new Map<string, { email: string | null; full_name: string | null }>();
  for (let i = 0; i < requestIds.length; i += 100) {
    const { data: reqs } = await supabase
      .from("quote_requests")
      .select("id, email, full_name")
      .in("id", requestIds.slice(i, i + 100));
    for (const r of reqs ?? []) reqMap.set((r as any).id, { email: (r as any).email, full_name: (r as any).full_name });
  }

  const { data: suppressed } = await supabase.from("suppressed_emails").select("email");
  const suppressedSet = new Set((suppressed ?? []).map((s: any) => String(s.email).toLowerCase()));

  const results: Array<Record<string, unknown>> = [];
  const seenEmails = new Set<string>();
  let sent = 0, failed = 0, skipped = 0, overridden = 0;

  for (const q of (quotes ?? []) as any[]) {
    if (body.quote_ids?.length && !body.quote_ids.includes(q.id)) continue;
    const info = reqMap.get(q.quote_request_id);
    const email = info?.email?.trim().toLowerCase() ?? null;
    const name = info?.full_name ?? "";
    const push = (outcome: string, detail?: string) => {
      results.push({ quote_id: q.id, quote_number: q.quote_number, email, name, status: q.status, outcome, detail });
    };

    if (!email || !email.includes("@")) { skipped++; push("skipped", "no_valid_email"); continue; }
    if (acceptedRequestIds.has(q.quote_request_id)) { skipped++; push("skipped", "customer_already_accepted"); continue; }
    if (suppressedSet.has(email)) { skipped++; push("skipped", "suppressed_email"); continue; }
    if (skipTest && /\btest(ing)?\b|^mr test$|demo/i.test(name)) { skipped++; push("skipped", "test_record"); continue; }
    if (seenEmails.has(email)) { skipped++; push("skipped", "duplicate_recipient_this_run"); continue; }
    if (q.plan_type === "contract_saver" && !q.contract_length_months) { skipped++; push("skipped", "missing_contract_length"); continue; }
    if (!q.monthly_gross) { skipped++; push("skipped", "missing_price"); continue; }

    // Extend expiry when the quote has lapsed so the emailed link is usable.
    const newExpiry = new Date(Date.now() + 14 * 86400_000).toISOString();
    const expired = !q.expires_at || new Date(q.expires_at).getTime() < Date.now() + 3 * 86400_000;

    // Margin: override a red latest check so the resend is not blocked.
    const { data: latest } = await supabase
      .from("quote_margin_checks")
      .select("status")
      .eq("quote_id", q.id)
      .order("checked_at", { ascending: false })
      .limit(1).maybeSingle();
    const needsOverride = (latest as any)?.status === "red";

    if (dryRun) {
      seenEmails.add(email);
      push("would_send", `${expired ? "extend_expiry;" : ""}${needsOverride ? "override_red_margin" : "margin_ok"}`);
      continue;
    }

    if (expired) {
      await supabase.from("quotes").update({ expires_at: newExpiry, token_expires_at: newExpiry }).eq("id", q.id);
    }

    if (needsOverride) {
      await supabase.from("quote_margin_checks").insert({
        quote_id: q.id, status: "green", reason: `OVERRIDE: ${overrideReason}`, checked_by: null,
      });
      await supabase.rpc("log_event", {
        _actor_type: "admin", _event_type: "quote_margin_override",
        _title: "Red margin overridden for bulk resend",
        _details: { quote_id: q.id, bulk_resend: true },
        _new_value: { reason: overrideReason } as any,
        _quote_id: q.id, _source_module: "margin", _severity: "warn",
      });
      overridden++;
    }

    const res = await fetch(`${projectUrl}/functions/v1/send-quote-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${svcKey}`,
        "Content-Type": "application/json",
        "x-internal-service": "1",
      },
      body: JSON.stringify({ quote_id: q.id, rotate_token: true, unified_journey: true }),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as any));

    const raw = await (res as any).text().catch(() => "");
    if ((res as any).ok) {
      sent++;
      seenEmails.add(email);
      push("sent", needsOverride ? "margin_overridden" : undefined);
    } else {
      failed++;
      push("failed", `${(res as any).status}: ${raw.slice(0, 200)}`);
    }

    await supabase.rpc("log_event", {
      _actor_type: "admin", _event_type: "quote_bulk_resend",
      _title: `Bulk quote resend ${q.quote_number} → ${(res as any).ok ? "sent" : "failed"}`,
      _details: { quote_id: q.id, email, expired_extended: expired, margin_overridden: needsOverride },
      _quote_id: q.id, _source_module: "quote",
      _severity: (res as any).ok ? "info" : "warn",
    }).catch?.(() => {});
  }

  console.log(`[bulk-resend] sent=${sent} failed=${failed} skipped=${skipped} overridden=${overridden}`);
  return jsonResponse({ ok: true, dry_run: dryRun, considered: (quotes ?? []).length, sent, failed, skipped, overridden, results });
});
