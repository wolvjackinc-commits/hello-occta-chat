// Sends an OCCTA Care sign-up link after a phone conversation. The customer
// completes key facts, bank details and agreement themselves. Shared by
// care-admin (staff) and care-sales (Sales Desk, only after a passed or
// supervisor-approved call check).
import { generateTokenPair, sendTrackedCommunication, escapeHtml, type getServiceClient } from "./quoteHelpers.ts";
import { renderBrandedEmail } from "./brandedEmailShell.ts";
import { CARE_PHONE_SCRIPT, CARE_RULES, carePlan, carePriceMinor, pounds } from "./careTerms.ts";

const SITE = "https://www.occta.co.uk";

export type InviteResult =
  | { ok: true; invite_id: string; expires_at: string; email: "sent" | "failed" }
  | { ok: false; error: string; reasons?: string[]; status?: number };

export async function sendCareInvite(svc: ReturnType<typeof getServiceClient>, o: {
  customerId: string; plan: string; frequency: string; day: number; actor: string; callRef: string; callNotes?: string;
  scriptConfirmed: Record<string, unknown>; provider?: string | null;
}): Promise<InviteResult> {
  const { data: elig } = await svc.rpc("care_eligibility", { p_customer: o.customerId });
  const e = elig as { eligible?: boolean; reasons?: string[]; no_sales_contact?: boolean } | null;
  if (!e?.eligible) return { ok: false, error: "not_eligible", reasons: e?.reasons ?? [] };
  // The customer asked not to be offered things: staff may not sell to them (they can still join themselves).
  if (e.no_sales_contact) return { ok: false, error: "not_eligible", reasons: ["no_sales_contact"] };
  const { data: profile } = await svc.from("profiles").select("full_name, email").eq("id", o.customerId).maybeSingle();
  if (!profile?.email) return { ok: false, error: "no_email_on_account" };

  await svc.from("care_invites").update({ revoked_at: new Date().toISOString(), revoked_reason: "superseded" })
    .eq("customer_id", o.customerId).is("used_at", null).is("revoked_at", null);
  const { raw, hash } = await generateTokenPair();
  const expires = new Date(Date.now() + CARE_RULES.inviteValidDays * 86400_000);
  const { data: inv, error } = await svc.from("care_invites").insert({
    token_hash: hash, customer_id: o.customerId, plan_code: o.plan, frequency: o.frequency, collection_day: o.day, created_by: o.actor, provider_code: o.provider || null,
    script_confirmed: { ...o.scriptConfirmed, confirmed_at: new Date().toISOString(), script: CARE_PHONE_SCRIPT.map((l) => l.line) },
    call_reference: o.callRef.slice(0, 120), call_notes: (o.callNotes ?? "").slice(0, 2000) || null,
    sent_to_email: profile.email, expires_at: expires.toISOString(),
  }).select("id").single();
  if (error || !inv) return { ok: false, error: "invite_failed", status: 500 };

  const price = carePriceMinor(o.plan, o.frequency) ?? 0;
  const link = `${SITE}/care/join?invite=${encodeURIComponent(raw)}`;
  const html = renderBrandedEmail({
    preheader: "Check the details and agree yourself. Nothing starts until you do.",
    eyebrow: "OCCTA Care",
    greeting: `Hi ${escapeHtml((profile.full_name ?? "there").split(" ")[0])}`,
    intro: `<p style="margin:0 0 12px 0">Thanks for talking to us about OCCTA Care. As promised, here's your secure link to check the details and join yourself, if you'd like to.</p><p style="margin:0 0 12px 0"><strong>Nothing has been set up and nothing starts until you agree.</strong> There's no deadline; the link works for ${CARE_RULES.inviteValidDays} days, and you can always join later from My OCCTA.</p>`,
    sections: [
      { heading: "What we talked about", html: `<p style="margin:0">${escapeHtml(carePlan(o.plan)!.name)} at ${escapeHtml(pounds(price))} ${o.frequency === "monthly" ? "a month" : o.frequency === "quarterly" ? "every 3 months" : "a year"}, VAT included, by its own Direct Debit. You can change this on the next page.</p>` },
      { heading: "Good to know", html: `<p style="margin:0 0 8px 0">OCCTA Care is a support service, not insurance. It doesn't pay for, repair or replace your own devices.</p><p style="margin:0 0 8px 0">Nothing is taken in your first 14 days, and you can cancel any time with no exit fee.</p><p style="margin:0">Didn't expect this email? Ignore it, or call us on 0800 260 6626.</p>` },
    ],
    cta: { label: "Check the details", url: link },
  });
  const sent = await sendTrackedCommunication(svc, {
    template_name: "care_invite", recipient_email: profile.email, subject: "Your OCCTA Care link (nothing starts until you agree)", html,
    user_id: o.customerId, metadata: { invite_id: inv.id, created_by: o.actor },
  });
  await svc.from("care_invites").update({ email_status: sent.ok ? "sent" : "failed" }).eq("id", inv.id);
  await svc.from("care_events").insert({ customer_id: o.customerId, actor_type: "staff", actor_id: o.actor, event: "invite_sent",
    details: { invite_id: inv.id, plan: o.plan, frequency: o.frequency, day: o.day, call_reference: o.callRef, email_ok: sent.ok } });
  return { ok: true, invite_id: inv.id, expires_at: expires.toISOString(), email: sent.ok ? "sent" : "failed" };
}
