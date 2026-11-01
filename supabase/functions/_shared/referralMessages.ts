// Refer-a-friend customer emails. Only five messages exist, and the database
// refuses to queue "credited" or "withdrawn" without an admin decision.
// Copy is plain and states the conditions every time (SWITCH50 lesson).
import { renderBrandedEmail, escapeEmailHtml } from "./brandedEmailShell.ts";

export const REFERRAL_TEMPLATES = [
  "your_code",
  "friend_joined",
  "reward_credited",
  "credit_expiring",
  "reward_withdrawn",
] as const;
export type ReferralTemplate = typeof REFERRAL_TEMPLATES[number];

export type ReferralPayload = {
  code?: string;
  summary?: string;
  terms_url?: string;
  terms_version?: string;
  referral_ref?: string;
  reward_ref?: string;
  role?: "referrer" | "friend" | "goodwill";
  amount?: number | string;
  amount_basis?: "gross" | "net";
  qualify_days?: number | string;
  invoices_required?: number | string;
  expires_at?: string;
  balance_minor?: number;
  reason?: string;
  recipient_email?: string;
};

const SITE = "https://www.occta.co.uk";
const TERMS_URL = `${SITE}/legal/refer-a-friend-terms`;
const DASHBOARD = `${SITE}/dashboard?tab=refer`;
const COMPLAINTS =
  "If you disagree, reply to this email or contact hello@occta.co.uk and we'll review it under our Complaints Code (" +
  `${SITE}/legal/complaints-code). OCCTA follows an Alternative Dispute Resolution (ADR) scheme. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached; see the Customer Complaints Code for the referral process.`;

export function formatCredit(amount: number | string | undefined, basis: "gross" | "net" | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_amount");
  const money = "£" + (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2));
  return basis === "net" ? `${money} (plus VAT)` : money;
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

function conditions(p: ReferralPayload): string {
  const days = Number(p.qualify_days ?? 60) || 60;
  const bills = Number(p.invoices_required ?? 2) || 2;
  return `A reward is only confirmed after your friend's service has been live for ${days} days, they've paid their first ${bills} bills in full and on time, and both accounts have stayed up to date with payments the whole time. Leaving, a missed or returned payment, or a payment plan on either account means no reward.`;
}

type Copy = { subject: string; intro: string; sections: Array<{ heading: string; text: string }>; cta: { label: string; url: string } };

export function referralCopy(template: string, p: ReferralPayload): Copy {
  switch (template) {
    case "your_code": {
      if (!p.code || !/^[A-Z0-9-]{3,24}$/.test(p.code)) throw new Error("invalid_code");
      const link = `${SITE}/?cc=${encodeURIComponent(p.code)}&ref=${encodeURIComponent(p.code)}`;
      return {
        subject: "Your OCCTA refer-a-friend code",
        intro: `Your code is ${p.code}. Share this link: ${link}`,
        sections: [
          { heading: "How it works", text: p.summary ?? "" },
          { heading: "The small print", text: `Bill credit only, never cash. Your friend must use your link or type your code before they place their order. Full terms (version ${p.terms_version ?? ""}): ${p.terms_url ?? TERMS_URL}` },
        ],
        cta: { label: "See your referrals", url: DASHBOARD },
      };
    }
    case "friend_joined":
      return {
        subject: "Someone ordered with your OCCTA code",
        intro: `A new order was placed using your refer-a-friend code (ref ${p.referral_ref ?? ""}). This isn't a reward yet — it's pending.`,
        sections: [
          { heading: "What happens next", text: conditions(p) + ` If everything checks out, ${formatCredit(p.amount, p.amount_basis)} comes off your bill and we'll email you once an OCCTA team member has confirmed it.` },
          { heading: "Terms", text: `Terms version ${p.terms_version ?? ""}: ${TERMS_URL}` },
        ],
        cta: { label: "Track it in My OCCTA", url: DASHBOARD },
      };
    case "reward_credited": {
      const credit = formatCredit(p.amount, p.amount_basis);
      const what = p.role === "friend"
        ? `Thanks for joining through a friend. We've added ${credit} of bill credit to your account.`
        : p.role === "goodwill"
        ? `We've added ${credit} of goodwill bill credit to your account.`
        : `Your referral has been approved. We've added ${credit} of bill credit to your account.`;
      return {
        subject: "Bill credit added to your OCCTA account",
        intro: what,
        sections: [
          { heading: "How you'll see it", text: `It comes off your next bill as its own line (ref ${p.reward_ref ?? ""}). If it's more than one bill, the rest carries over.` },
          { heading: "Good to know", text: `Use it by ${fmtDate(p.expires_at)} or it expires. It can't be paid out, transferred or refunded, and it's lost if the account closes. Your Direct Debit or bank transfer covers whatever's left on each bill.` },
        ],
        cta: { label: "See your credit", url: DASHBOARD },
      };
    }
    case "credit_expiring": {
      const left = Number(p.balance_minor);
      if (!Number.isFinite(left) || left <= 0) throw new Error("invalid_balance");
      return {
        subject: "Your OCCTA bill credit expires soon",
        intro: `You have £${(left / 100).toFixed(2)} of bill credit (ref ${p.reward_ref ?? ""}) that expires on ${fmtDate(p.expires_at)}.`,
        sections: [{ heading: "Nothing to do", text: "It's taken off your bills automatically. Any credit still unused on that date expires, as set out in the refer-a-friend terms." }],
        cta: { label: "See your credit", url: DASHBOARD },
      };
    }
    case "reward_withdrawn": {
      if (!p.reason || p.reason.trim().length < 10) throw new Error("reason_required");
      return {
        subject: "An update on your OCCTA referral reward",
        intro: `We're not able to give the ${formatCredit(p.amount, p.amount_basis)} referral reward (ref ${p.reward_ref ?? ""}).`,
        sections: [
          { heading: "Why", text: p.reason.trim() },
          { heading: "The rule we applied", text: `Refer-a-friend terms version ${p.terms_version ?? ""}: ${TERMS_URL}` },
          { heading: "If you disagree", text: COMPLAINTS },
        ],
        cta: { label: "Open My OCCTA", url: DASHBOARD },
      };
    }
  }
  throw new Error("unknown_template");
}

export function renderReferralMessage(template: string, p: ReferralPayload) {
  const c = referralCopy(template, p);
  const text = [c.intro, ...c.sections.map((s) => `${s.heading}\n${s.text}`), `${c.cta.label}: ${c.cta.url}`, "Help: hello@occta.co.uk"].join("\n\n");
  const html = renderBrandedEmail({
    preheader: c.subject,
    eyebrow: "Refer a friend",
    reference: p.reward_ref ?? p.referral_ref ?? p.code ?? "",
    greeting: "Hello,",
    intro: "<p>" + escapeEmailHtml(c.intro) + "</p>",
    sections: c.sections.map((s) => ({ heading: s.heading, html: "<p>" + escapeEmailHtml(s.text) + "</p>" })),
    cta: c.cta,
  });
  return { subject: c.subject, text, html };
}
