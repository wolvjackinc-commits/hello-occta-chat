// Refer-a-friend terms, version raf-2026-11-v1.
//
// The rules here must match referral_terms_versions in the database (the
// referral-terms unit test checks the summary and numbers against the
// migration). To change the scheme: publish a NEW version in both places with
// 30 days' notice; never edit a published version. Referrals keep the version
// in force when the friend ordered.

export const REFERRAL_TERMS_VERSION = "raf-2026-11-v1";
export const REFERRAL_TERMS_EFFECTIVE = "31 October 2026";
export const REFERRAL_TERMS_PATH = "/legal/refer-a-friend-terms";
export const REFERRAL_PAGE_PATH = "/refer-a-friend";

export const REFERRAL_RULES = {
  qualifyDays: 60,
  invoicesRequired: 2,
  caps: { residential: 5, business: 10 },
  rewards: {
    residential: { referrer: 25, friend: 10 },
    business: { referrer: 50, friend: 25 },
  },
  clawbackMonths: 6,
  unpaidClawbackDays: 30,
  creditExpiryMonths: 12,
  manualAttachDays: 7,
  newCustomerLookbackMonths: 12,
  noticeDays: 30,
} as const;

export const REFERRAL_TERMS_SUMMARY =
  "Refer a friend to OCCTA. When their service has been live for 60 days and they have paid their first 2 bills in full and on time, you get £25 off your bill and they get £10 off theirs. If your friend joins on a business plan, it is £50 for you and £25 for them. Business accounts get credit before VAT. Bill credit only, never cash. Both accounts must stay up to date with payments the whole time. Up to 5 rewards a year (10 for business accounts). Credit lasts 12 months and is lost if your account closes.";

export type TermsSection = { heading: string; points: string[] };

export const REFERRAL_TERMS: TermsSection[] = [
  {
    heading: "1. Who runs the scheme",
    points: [
      "The OCCTA Refer a Friend scheme is run by OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU (\"OCCTA\", \"we\").",
      `These terms are version ${REFERRAL_TERMS_VERSION}, in force from ${REFERRAL_TERMS_EFFECTIVE}. They sit alongside your OCCTA contract and don't change it.`,
    ],
  },
  {
    heading: "2. Who can refer",
    points: [
      "Any OCCTA residential or business customer with a live service whose account is up to date with payments. You'll find your code and link in My OCCTA under Refer a friend.",
      "One code per account. Codes are personal to you and can't be sold or transferred.",
    ],
  },
  {
    heading: "3. Who counts as a referred friend",
    points: [
      `Someone new to OCCTA: no OCCTA account, order, quote or live service in the previous ${REFERRAL_RULES.newCustomerLookbackMonths} months under the same email address, phone number, name and postcode, or service address.`,
      "A different person, at a different service address, from you. You can't refer yourself, your own second address or someone in your household.",
      "Your friend must use your link or type your code in the reference-code box before they place their order. We can't add a code afterwards, except that our team may add one within 7 days of the order if you or your friend contact us, and we record why.",
      "Residential and business customers can refer each other. Business customers include sole traders and companies ordering on a business plan.",
    ],
  },
  {
    heading: "4. What you each get",
    points: [
      "Residential friend: £25 bill credit for you and £10 bill credit for your friend.",
      "Business friend: £50 bill credit for you and £25 bill credit for your friend.",
      "On a residential account the credit is the amount taken off your bill including VAT. On a business account the credit is before VAT, and the VAT on your bill goes down to match (so £50 credit takes £60 off a business bill that includes 20% VAT).",
      "Rewards are bill credit only. They are never paid as cash, can't be withdrawn, transferred or refunded, and have no cash value.",
      `You can get up to ${REFERRAL_RULES.caps.residential} referral rewards in any 12 months on a residential account, or ${REFERRAL_RULES.caps.business} on a business account. Your friend still gets their credit if you've reached your limit.`,
      "One reward per friend. A referral reward can't be combined with another OCCTA offer on the same order (for example SWITCH50) unless that offer says so; if your friend uses another offer, the referral doesn't count.",
    ],
  },
  {
    heading: "5. When a reward is earned",
    points: [
      "All of these must be true:",
      `Your friend's service has been live for ${REFERRAL_RULES.qualifyDays} days.`,
      `Your friend has paid their first ${REFERRAL_RULES.invoicesRequired} bills in full, on or before the due date.`,
      "From the day your friend ordered until the reward is approved, neither your account nor your friend's has been behind with payments at any point. That means no overdue bill, no failed or returned Direct Debit, no suspension and no payment arrangement. Paying late afterwards does not put this right.",
      "Your friend hasn't asked to cancel, given notice, ceased their service or moved their number or service to another provider.",
      "You still have a live service with OCCTA and your account is up to date on the day the reward is approved.",
      "There's no sign of fraud, duplicate accounts or misuse.",
      "Every reward is checked by a member of the OCCTA team before it's added. We'll only tell you a reward is confirmed once it has been approved and added to your account.",
    ],
  },
  {
    heading: "6. How the credit is used",
    points: [
      "Approved credit is taken off your next bill or bills, shown as its own line. If the credit is more than the bill, the rest carries over to later bills.",
      "Your Direct Debit or bank transfer pays whatever is left on each bill. Credit never takes a bill below zero.",
      `Credit must be used within ${REFERRAL_RULES.creditExpiryMonths} months of being added. Any credit unused after that expires; we'll remind you about 30 days before.`,
      "If your account closes, any unused credit is lost.",
    ],
  },
  {
    heading: "7. If things change after a reward is added",
    points: [
      `If your friend cancels, ceases or moves away within ${REFERRAL_RULES.clawbackMonths} months of their service going live, or one of their bills stays unpaid for ${REFERRAL_RULES.unpaidClawbackDays} days or more in that time, we may remove any of the reward credit you haven't used yet.`,
      "We won't charge you for credit you've already used.",
      "If a Direct Debit on your friend's account is returned or recalled, we'll put both rewards on hold while we look into it.",
    ],
  },
  {
    heading: "8. Fair use",
    points: [
      "Share your code with people you know. Don't spam, don't post it where you'd be breaking another site's rules, and don't pay for adverts or bid on search terms that include \"OCCTA\" to promote your code.",
      "We may withhold, reverse or remove rewards, or close a code, if we reasonably believe the scheme has been misused, there's been fraud, or these terms have been broken. We'll tell you why.",
    ],
  },
  {
    heading: "9. Changing or ending the scheme",
    points: [
      `We can change or end the scheme by giving ${REFERRAL_RULES.noticeDays} days' notice on this page. Referrals made before a change keep the terms version in force when the friend ordered, and rewards already earned under them will still be honoured.`,
    ],
  },
  {
    heading: "10. Questions and complaints",
    points: [
      "If you think a referral wasn't tracked or a reward was withdrawn unfairly, contact us at hello@occta.co.uk or from your account. We'll look at the evidence we hold and give you a written answer.",
      "OCCTA follows an Alternative Dispute Resolution (ADR) scheme. Eligible unresolved complaints may normally be referred to ADR free of charge after six weeks, or earlier if deadlock is reached; see the Customer Complaints Code for the referral process.",
    ],
  },
];

export const REFERRAL_FAQ: Array<{ q: string; a: string }> = [
  { q: "How do I get my code?", a: "Sign in to My OCCTA and open Refer a friend. You need a live service and an account that's up to date with payments." },
  { q: "When do I get my reward?", a: `Once your friend's service has been live for ${REFERRAL_RULES.qualifyDays} days and they've paid their first ${REFERRAL_RULES.invoicesRequired} bills on time, our team checks it and adds the credit. You'll get an email when it's added — not before.` },
  { q: "Is it cash?", a: "No. It's bill credit taken off your next bills. It can't be paid out or transferred." },
  { q: "My friend forgot to use my code. Can you add it?", a: "Contact us within 7 days of their order and we can look at adding it. After that we can't." },
  { q: "Can businesses join in?", a: "Yes. Business customers can refer and be referred. A business friend earns you £50 credit and them £25 (before VAT on business bills)." },
  { q: "Why was my reward not given?", a: "Usually because a bill on one of the accounts was paid late, a Direct Debit was returned, the friend wasn't new to OCCTA, or they used another offer. You'll see the reason in My OCCTA, and you can ask us to review it." },
  { q: "Does a late payment that I've since cleared still count?", a: "Yes. Both accounts must stay up to date the whole time from the friend's order until approval. Clearing a late payment afterwards doesn't restore the reward." },
];

/** Plain-English status labels for customers. */
export function referralStatusLabel(status: string, role: string): { label: string; tone: "wait" | "good" | "done" | "bad" } {
  switch (status) {
    case "tracked": return { label: role === "friend" ? "Waiting for your service to go live" : "Order placed — waiting for their service to go live", tone: "wait" };
    case "pending": return { label: `Live — checking in after ${REFERRAL_RULES.qualifyDays} days`, tone: "wait" };
    case "qualifying": return { label: `Waiting for the first ${REFERRAL_RULES.invoicesRequired} bills to be paid`, tone: "wait" };
    case "approved_awaiting_admin": return { label: "Being checked by our team", tone: "wait" };
    case "booked": return { label: "Credit added", tone: "good" };
    case "partly_applied": return { label: "Credit partly used", tone: "good" };
    case "applied": return { label: "Credit used", tone: "done" };
    case "expired": return { label: "Credit expired", tone: "done" };
    case "rejected": return { label: "Didn't qualify", tone: "bad" };
    case "reversed": return { label: "Withdrawn", tone: "bad" };
    case "clawed_back": return { label: "Unused credit removed", tone: "bad" };
    default: return { label: "In progress", tone: "wait" };
  }
}

const REASON_LABELS: Record<string, string> = {
  self_referral: "It looked like the same person or home",
  not_new_customer: "Your friend wasn't new to OCCTA",
  promotion_stacking: "Another offer was used on the same order",
  friend_leaving: "The service was cancelled or is leaving",
  friend_payment_history: "A payment on your friend's account was late or returned",
  friend_bill_not_paid_on_time: "One of the first bills wasn't paid on time",
  referrer_payment_history: "A payment on your account was late or returned",
  referrer_not_live_on_qualifying_date: "Your account wasn't live on the qualifying date",
  friend_not_live_on_qualifying_date: "The account wasn't live on the qualifying date",
  annual_cap_reached: "You'd reached the yearly limit",
};
export function referralReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_LABELS[reason.split(":")[0]] ?? "Reviewed by our team";
}

export function referralLink(code: string, origin = "https://www.occta.co.uk"): string {
  const c = encodeURIComponent(code.toUpperCase());
  return `${origin}/?cc=${c}&ref=${c}`;
}

export function formatReward(amount: number, basis: "gross" | "net"): string {
  const money = "£" + (Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2));
  return basis === "net" ? `${money} + VAT` : money;
}
