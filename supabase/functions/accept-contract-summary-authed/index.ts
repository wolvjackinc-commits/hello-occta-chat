import { corsHeaders, jsonResponse, getServiceClient, getRequestIp, checkRateLimit, sendResendEmail, brutalistEmailShell, escapeHtml, maskEmail } from "../_shared/quoteHelpers.ts";
import { ACCEPTANCE_CHECKBOX_TEXT } from "../_shared/legalText.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const Schema = z.object({
  contract_summary_id: z.string().uuid(),
  checkbox_confirmed: z.literal(true),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "missing_jwt" }, 401);

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "validation", details: parsed.error.flatten() }, 400);

  const supabase = getServiceClient();
  const { data: u } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!u?.user) return jsonResponse({ error: "invalid_jwt" }, 401);
  const userId = u.user.id;

  const ip = getRequestIp(req) ?? "noip";
  if (!(await checkRateLimit(userId, "accept_cs_authed", 20, 60))) return jsonResponse({ error: "rate_limited" }, 429);

  const ua = req.headers.get("user-agent")?.slice(0, 400) ?? "";

  // Call the SECURITY DEFINER RPC under the user's JWT so auth.uid() == userId
  const userClient = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await userClient.rpc("customer_accept_contract_summary", {
    _cs_id: parsed.data.contract_summary_id,
    _acceptance_text: ACCEPTANCE_CHECKBOX_TEXT,
    _ip: ip,
    _user_agent: ua,
    _checkbox_confirmed: true,
  });

  if (error) {
    return jsonResponse({ error: "accept_failed", details: error.message }, 400);
  }

  const res = data as { ok: boolean; already_accepted: boolean; contract_summary_id: string; acceptance_id: string; accepted_at: string };

  // Best-effort confirmation emails (skip when already_accepted to avoid spam)
  if (!res.already_accepted) {
    const { data: cs } = await supabase.from("contract_summaries")
      .select("cs_number, customer_email_snapshot, customer_name_snapshot")
      .eq("id", parsed.data.contract_summary_id).maybeSingle();
    if (cs) {
      void sendResendEmail({
        to: cs.customer_email_snapshot,
        subject: `Contract Summary accepted — ${cs.cs_number}`,
        html: brutalistEmailShell(
          "Contract Summary accepted",
          `<p>Thanks, ${escapeHtml((cs.customer_name_snapshot || "").split(" ")[0])}.</p>
           <p>We've recorded your acceptance of Contract Summary <strong>${escapeHtml(cs.cs_number)}</strong>.</p>
           <p>OCCTA will be in touch with the next step. We never take card details over email.</p>`,
        ),
      });
      const adminEmail = Deno.env.get("RESEND_FROM_EMAIL") || "hello@occta.co.uk";
      void sendResendEmail({
        to: adminEmail,
        subject: `[CS accepted] ${cs.cs_number}`,
        html: brutalistEmailShell(
          "Contract Summary accepted (customer dashboard)",
          `<p>CS <strong>${escapeHtml(cs.cs_number)}</strong> accepted by ${escapeHtml(maskEmail(cs.customer_email_snapshot))}.</p>`,
          { label: "Open admin", url: "https://www.occta.co.uk/admin/quotes" },
        ),
      });
    }
  }

  return jsonResponse(res);
});