import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  service_id: string;
  persist?: boolean; // if true, store the quote
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: userResp } = await userClient.auth.getUser();
    const user = userResp?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as Body;
    if (!body?.service_id) {
      return new Response(JSON.stringify({ error: "service_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: svc, error: svcErr } = await admin
      .from("services")
      .select("id,user_id,order_id,price_monthly,contract_type,minimum_term_months,minimum_term_end_date,activation_date,actual_activation_date,notice_period_days,plan_name")
      .eq("id", body.service_id)
      .single();
    if (svcErr || !svc) return new Response(JSON.stringify({ error: "Service not found" }), { status: 404, headers: corsHeaders });

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (!isAdmin && svc.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const ct = String(svc.contract_type || svc.plan_name || "").toLowerCase();
    const planType = ct.includes("flex") || ct.includes("rolling") ? "flex" : "contract";
    const monthly = Number(svc.price_monthly || 0);

    // Outstanding charges = sum of unpaid invoices for this service
    const { data: unpaid } = await admin
      .from("invoices")
      .select("total,status")
      .eq("service_id", svc.id)
      .in("status", ["sent", "draft", "overdue"]);
    const outstanding = (unpaid || []).reduce((s, r) => s + Number(r.total || 0), 0);

    const breakdown: { label: string; amount: number }[] = [];
    let etf = 0;
    let noticeDays = 0;
    let termination: Date | null = null;

    if (planType === "flex") {
      noticeDays = Number(svc.notice_period_days || 30);
      termination = addDays(new Date(), noticeDays);
      breakdown.push({ label: "30-day notice period", amount: +(monthly * (30 / 30)).toFixed(2) });
    } else {
      // contract
      const end = svc.minimum_term_end_date
        ? new Date(svc.minimum_term_end_date)
        : (() => {
            const start = svc.actual_activation_date
              ? new Date(svc.actual_activation_date)
              : svc.activation_date
              ? new Date(svc.activation_date)
              : new Date();
            const lengthMonths = Number(svc.minimum_term_months || 12);
            const e = new Date(start); e.setMonth(e.getMonth() + lengthMonths); return e;
          })();
      const now = new Date();
      const msPerMonth = 1000 * 60 * 60 * 24 * 30.4375;
      const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerMonth));
      etf = +(remaining * monthly).toFixed(2);
      noticeDays = Number(svc.notice_period_days || 30);
      termination = addDays(new Date(), noticeDays);
      breakdown.push({ label: `Early termination fee (${remaining} mo × £${monthly.toFixed(2)})`, amount: etf });
    }
    if (outstanding > 0) breakdown.push({ label: "Outstanding unpaid invoices", amount: +outstanding.toFixed(2) });

    const totalPayable = +(breakdown.reduce((s, b) => s + b.amount, 0)).toFixed(2);

    let saved: string | null = null;
    if (body.persist) {
      const { data: row } = await admin
        .from("cancellation_quotes")
        .insert({
          user_id: svc.user_id,
          service_id: svc.id,
          order_id: svc.order_id,
          plan_type: planType,
          monthly_amount: monthly,
          remaining_months: planType === "contract" ? Math.ceil(etf / Math.max(1, monthly)) : 0,
          outstanding_charges: +outstanding.toFixed(2),
          etf_amount: etf,
          notice_days: noticeDays,
          termination_date: termination?.toISOString().slice(0, 10) || null,
          breakdown,
          created_by: user.id,
        })
        .select("id")
        .single();
      saved = row?.id || null;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan_type: planType,
        monthly_amount: monthly,
        outstanding_charges: +outstanding.toFixed(2),
        etf_amount: etf,
        notice_days: noticeDays,
        termination_date: termination?.toISOString().slice(0, 10) || null,
        breakdown,
        total_payable: totalPayable,
        quote_id: saved,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), { status: 500, headers: corsHeaders });
  }
});