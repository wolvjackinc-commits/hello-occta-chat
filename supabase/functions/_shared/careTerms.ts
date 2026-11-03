// OCCTA Care: the single source of truth for what Care is, what it costs and
// the rules OCCTA promises. Imported by the web app (Vite), by edge functions
// (Deno) and by letter templates, so it must stay free of runtime imports.
//
// OCCTA Care is a SERVICE SUBSCRIPTION, NOT INSURANCE. Nothing here may promise
// to pay for, repair or replace a customer's own device after breakdown,
// accidental damage, loss or theft: that would make it a contract of insurance
// (FCA PERG 6.7). The wording checks in careTerms.unit.test.ts enforce the
// banned words below across this file and every Care page and letter.
//
// Changing the scheme: publish a NEW terms version here AND as a new row in
// public.care_terms_versions (migration). Never edit a published version:
// every member's consent records the version and hash they agreed to.

export const CARE_TERMS_VERSION = "care-2026-11-v2";
export const CARE_TERMS_EFFECTIVE = "3 November 2026";
export const CARE_TERMS_PATH = "/legal/occta-care-terms";
export const CARE_PAGE_PATH = "/care";
export const CARE_JOIN_PATH = "/care/join";
export const CARE_KEY_FACTS_PATH = "/care/key-facts";
export const CARE_PORTAL_PATH = "/dashboard?tab=care";

/** Direct Debit details for Care. Care uses its OWN mandate, never the broadband one. */
export const CARE_DD = {
  providerCode: "accesspay",
  collectionName: "APS Re OCCTA",
  serviceUserNumber: "538166",
  referencePrefix: "OCCTA CARE-",
  /** OCCTA's own promise: more notice than the provider minimum. */
  noticeWorkingDays: 10,
  /** Bacs: a new Instruction must be lodged within 10 working days of signing. */
  lodgeWithinWorkingDays: 10,
  /** Bacs: a copy of the Instruction must reach the paying bank within 7 working days of asking. */
  ddiCopyWorkingDays: 7,
  /** AccessPay: an indemnity claim can be challenged within this many days of the DDICA. */
  indemnityChallengeDays: 9,
} as const;

export const CARE_RULES = {
  coolingOffDays: 14,
  /** No payment is ever taken before the cooling-off period ends. */
  firstPaymentAfterCoolingOff: true,
  /** Working days between signing and the earliest first collection (lodge 10 + notice/post 5). */
  firstCollectionMinWorkingDays: 15,
  collectionDays: [1, 15] as const,
  priceChangeNoticeDays: 30,
  renewalReminderDays: 30,
  /** Monthly members get a "what you've used and how to cancel" reminder this often. */
  usageReminderMonths: 6,
  /** Unpaid collections before Care is paused. One re-try is made after a fresh notice. */
  maxFailedCollections: 2,
  /** A re-try is collected this many working days after the return is recorded (fresh notice goes out first). */
  representAfterWorkingDays: 13,
  /** Prepaid refunds below this are still paid if asked, but not chased (minor units). */
  minAutoRefundMinor: 100,
  refundWithinDays: 14,
  annualMonthsCharged: 10,
  quarterlyMonthsCharged: 3,
  minimumAge: 18,
  /** Customers this age or older get a 48-hour pause and a welcome call before the mandate is lodged. */
  extraCheckAge: 75,
  extraCheckPauseHours: 48,
  /** Reviewed and phone-assisted sales get a welcome call within this many working days. 75+ customers get it BEFORE lodging. */
  welcomeCallWorkingDays: 5,
  /** OCCTA's standard for every customer: a faulty OCCTA-supplied router or hub is replaced within this many working days. */
  standardRouterSwapWorkingDays: 5,
  inviteValidDays: 7,
  applicationValidHours: 24,
  debtChasing: false,
} as const;

export type CarePlanCode = "essentials" | "plus";
export type CareFrequency = "monthly" | "quarterly" | "annual";

export interface CarePlan {
  code: CarePlanCode;
  name: string;
  tagline: string;
  monthlyMinor: number;
  features: string[];
}

export const CARE_PLANS: CarePlan[] = [
  {
    code: "essentials",
    name: "Care Essentials",
    tagline: "A UK help desk for your home tech, on call when you need it.",
    monthlyMinor: 499,
    features: [
      "UK tech support by phone, chat and email, Monday to Saturday, 8am to 8pm",
      "Remote help sessions for Wi-Fi, phones, tablets, computers, email and printers",
      "Remote home Wi-Fi setup and tune-up",
      "Setup and data transfer for 1 phone, tablet or computer each year",
    ],
  },
  {
    code: "plus",
    name: "Care Plus",
    tagline: "Everything in Essentials, faster, with more of it.",
    monthlyMinor: 899,
    features: [
      "Everything in Care Essentials, with priority answering",
      "Setup and data transfer for as many phones, tablets and computers as you like",
      "If a router or hub we supplied is faulty, we send the replacement the next working day (our standard for every customer is within 5 working days)",
      "A yearly home tech health check by video or phone",
      "A Wi-Fi extender on loan, posted to you, for as long as you're a member",
    ],
  },
];

/** What Care never includes. Shown next to the price everywhere Care is sold. */
export const CARE_NOT_INCLUDED: string[] = [
  "OCCTA Care is not insurance. It does not pay for, repair or replace your own phone, tablet, computer or other devices if they break down, are damaged, lost or stolen.",
  "Repairs to your own devices aren't part of Care. Nothing is fixed for free.",
  "Business IT, data recovery, and software or devices you've modified are not included.",
  "Care doesn't change your legal rights. If anything OCCTA supplies is faulty, we put it right for every customer, member or not: a faulty router or hub we supplied is replaced within 5 working days. Care Plus makes that the next working day.",
];

export const CARE_FREQUENCIES: { code: CareFrequency; label: string; months: number; chargedMonths: number }[] = [
  { code: "monthly", label: "Monthly", months: 1, chargedMonths: 1 },
  { code: "quarterly", label: "Every 3 months", months: 3, chargedMonths: CARE_RULES.quarterlyMonthsCharged },
  { code: "annual", label: "Yearly (2 months free)", months: 12, chargedMonths: CARE_RULES.annualMonthsCharged },
];

export function carePlan(code: string): CarePlan | null {
  return CARE_PLANS.find((p) => p.code === code) ?? null;
}

export function careFrequency(code: string) {
  return CARE_FREQUENCIES.find((f) => f.code === code) ?? null;
}

/** Price of one collection, in pence, VAT included. */
export function carePriceMinor(planCode: string, frequency: string, monthlyOverrideMinor?: number | null): number | null {
  const plan = carePlan(planCode);
  const freq = careFrequency(frequency);
  if (!plan || !freq) return null;
  const monthly = monthlyOverrideMinor ?? plan.monthlyMinor;
  return monthly * freq.chargedMonths;
}

export function pounds(minor: number | null | undefined): string {
  const v = Number(minor ?? 0) / 100;
  return `£${v.toFixed(2)}`;
}

export function careFrequencyNoun(frequency: string): string {
  return frequency === "annual" ? "year" : frequency === "quarterly" ? "3 months" : "month";
}

export const CARE_TERMS_SUMMARY =
  "OCCTA Care is a support service, not insurance. Care Essentials costs £4.99 a month and Care Plus £8.99 a month, VAT included, paid by its own Direct Debit monthly, every 3 months, or yearly with 2 months free. There is no minimum term and no exit fee: cancel any time by phone, email, letter, chat or in My OCCTA. Nothing is taken until your 14-day cooling-off period has ended. Prepaid plans get a refund for unused time. We give at least 10 working days' notice before any payment, and 30 days' notice of any price change, with the right to leave free. Care does not pay for, repair or replace your own devices and doesn't affect your legal rights.";

export type TermsSection = { heading: string; points: string[] };

export const CARE_TERMS: TermsSection[] = [
  {
    heading: "1. Who provides OCCTA Care",
    points: [
      "OCCTA Care is provided by OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU (\"OCCTA\", \"we\"). Phone 0800 260 6626, email hello@occta.co.uk.",
      `These terms are version ${CARE_TERMS_VERSION}, in force from ${CARE_TERMS_EFFECTIVE}. They are a separate agreement from your broadband, phone or SIM contract and don't change it.`,
    ],
  },
  {
    heading: "2. What OCCTA Care is, and what it is not",
    points: [
      "OCCTA Care is a subscription to support services: help from our UK team, setup help and, on Care Plus, faster replacement of faulty OCCTA equipment.",
      "OCCTA Care is not insurance. It does not pay for, repair or replace your own devices if they break down, are damaged, lost or stolen, and it has no claims or excess.",
      "Care doesn't affect your legal rights. If anything OCCTA supplies is faulty, we put it right for every customer, member or not.",
      "Repairs to your own devices are not part of Care.",
      "Our standard for every customer, member or not: if a router or hub OCCTA supplied is faulty, we send a replacement within 5 working days. Care Plus members get it sent the next working day.",
    ],
  },
  {
    heading: "3. Plans and prices",
    points: [
      "Care Essentials costs £4.99 a month. Care Plus costs £8.99 a month. Prices include VAT.",
      "You can pay monthly, every 3 months (3 times the monthly price), or yearly (10 times the monthly price, so 2 months are free).",
      "What each plan includes is listed on occta.co.uk/care and in your welcome pack. Allowances (such as device setups) reset on each anniversary of your start date.",
    ],
  },
  {
    heading: "4. Who can join",
    points: [
      "You must be 18 or over, a residential OCCTA account holder, and have no overdue OCCTA bill when you join.",
      "The bank account must be a UK account in your name, or one you're allowed to authorise Direct Debits from on your own.",
      "One Care plan per OCCTA account.",
      "We may decline to start Care, without charge, if it doesn't look right for you. We'll tell you why where we can.",
    ],
  },
  {
    heading: "5. Payment by Direct Debit",
    points: [
      "Care is paid by its own Direct Debit to APS Re OCCTA (Service User Number 538166), separate from any other OCCTA Direct Debit. It shows on your statement with a reference starting OCCTA CARE-.",
      "We take nothing until your 14-day cooling-off period has ended. Your welcome pack tells you the date and amount of your first payment.",
      "Payments are taken on the 1st or 15th of the month (you choose). If that's not a working day, it's taken on the next working day.",
      "We will tell you at least 10 working days before any payment, and before any change to the amount, date or how often we collect. Your payments are protected by the Direct Debit Guarantee.",
      "OCCTA takes payment for Care by Direct Debit only. We never ask for card details.",
    ],
  },
  {
    heading: "6. Cooling-off",
    points: [
      "You can cancel within 14 days of joining for any reason by phone, email, letter, chat or in My OCCTA. Because nothing is taken during this time, you won't pay anything.",
      "You can ask us to start helping straight away during the 14 days. That's free and doesn't affect your right to cancel.",
    ],
  },
  {
    heading: "7. Cancelling at any time",
    points: [
      "There is no minimum term and no exit fee. Cancel any time by phone (0800 260 6626), email (hello@occta.co.uk), letter, chat with Ollie, or the Cancel button in My OCCTA. We confirm in writing the same working day.",
      "Monthly: we stop all future payments straight away. If a payment has already been sent to your bank for a period you won't use, we refund it in full.",
      "Every 3 months or yearly: we refund the unused part of the period you've paid for, worked out by the day, by bank transfer within 14 days.",
      "You can also cancel your Direct Debit with your bank at any time. Please tell us too, so we can confirm your Care has ended.",
    ],
  },
  {
    heading: "8. Reminders",
    points: [
      "If you pay monthly, we write to you every 6 months with what you've used and how to cancel.",
      "If you pay every 3 months or yearly, we write at least 30 days before each renewal with the price, the date and how to cancel.",
      "If you haven't used Care for 6 months, we'll ask whether you still want it.",
    ],
  },
  {
    heading: "9. Price changes",
    points: [
      "We'll give you at least 30 days' written notice of any price increase, in pounds and pence. You can cancel free before it starts, and prepaid periods keep the price you paid.",
      "If you change plan, the new plan and price start from your next payment period. We write to you at least 10 working days before the first payment at the new price.",
    ],
  },
  {
    heading: "10. If a payment is missed",
    points: [
      "If your bank returns a payment because there wasn't enough money, we'll tell you straight away and try once more, after giving you fresh notice.",
      "If a payment is returned for any other reason, we won't try again without contacting you first.",
      "If 2 payments are missed, we pause Care and write to you. We don't pass Care balances to debt collectors and we don't charge late fees for Care.",
      "If you are finding money tight, tell us. We'll pause or cancel Care with no charge. A paused plan takes no payments, and you can join again whenever you like.",
    ],
  },
  {
    heading: "11. Extra support",
    points: [
      "Tell us if anything would help, such as large print, Braille, a carer or relative handling things with you, or more time. We record it only with your consent and you can ask us to remove it at any time.",
      "Our Vulnerable Customers Policy (occta.co.uk/legal/vulnerable-customers) applies to Care.",
    ],
  },
  {
    heading: "12. Ending Care by OCCTA",
    points: [
      "We can end Care with 30 days' written notice, and straight away if your OCCTA account closes. Prepaid time you haven't used is refunded by the day.",
    ],
  },
  {
    heading: "13. Complaints",
    points: [
      "Tell us by any channel. Our Complaints Code (occta.co.uk/legal/complaints-code) applies to Care.",
      "Care isn't a phone or broadband service, so the communications dispute scheme may not be able to look at a Care complaint. If it can't, you can contact the Citizens Advice consumer helpline on 0808 223 1133, or use the small claims court.",
    ],
  },
  {
    heading: "14. Your information",
    points: [
      "We use your details to run Care, as set out in our Privacy Policy (occta.co.uk/privacy). We keep your sign-up record, call recordings and letters to show what you agreed to, for 6 years after Care ends.",
    ],
  },
];

/** Key facts shown (and hashed) immediately before a customer agrees. */
export function careKeyFacts(opts: { planCode: string; frequency: string; priceMinor: number; collectionDay: number; firstCollectionDate?: string | null }): string[] {
  const plan = carePlan(opts.planCode);
  const freq = careFrequency(opts.frequency);
  const day = opts.collectionDay === 15 ? "15th" : "1st";
  return [
    `Plan: ${plan?.name ?? opts.planCode}. Price: ${pounds(opts.priceMinor)} ${freq?.code === "monthly" ? "a month" : freq?.code === "quarterly" ? "every 3 months" : "a year"}, VAT included.`,
    `Paid by its own Direct Debit to APS Re OCCTA, on the ${day} of the month.`,
    opts.firstCollectionDate
      ? `Nothing is taken until your 14-day cooling-off period ends. Your first payment is expected on ${opts.firstCollectionDate}, and we'll confirm it in writing at least 10 working days before.`
      : "Nothing is taken until your 14-day cooling-off period ends. We'll confirm your first payment in writing at least 10 working days before.",
    "No minimum term and no exit fee. Cancel any time by phone, email, letter, chat or in My OCCTA.",
    "This is a support service, not insurance. It does not pay for, repair or replace your own devices if they break, are damaged, lost or stolen.",
    "It doesn't change your legal rights.",
  ];
}

export const CARE_FAQ: { q: string; a: string }[] = [
  {
    q: "Is OCCTA Care insurance?",
    a: "No. Care is a support service. It gives you a UK help desk and setup help, and on Care Plus a next-working-day swap of faulty OCCTA kit. It does not pay for, repair or replace your own devices if they break, are damaged, lost or stolen. If you want that, you'd need an insurance policy from an insurer, and you may already have some through your home insurance or bank account.",
  },
  {
    q: "When do I pay?",
    a: "Nothing is taken in your first 14 days. Your first payment is after the cooling-off period, on the 1st or 15th of the month (your choice), and we write to you at least 10 working days before.",
  },
  {
    q: "How do I cancel?",
    a: "However suits you: the Cancel button in My OCCTA, a call on 0800 260 6626, an email to hello@occta.co.uk, a letter, or a chat with Ollie. There's no exit fee and we confirm in writing the same working day.",
  },
  {
    q: "Is it on my broadband bill?",
    a: "No. Care has its own Direct Debit, with a reference starting OCCTA CARE-. Cancelling Care never touches your broadband, phone or SIM.",
  },
  {
    q: "What if my OCCTA router stops working?",
    a: "We replace faulty equipment that OCCTA supplied for every customer, Care or not: that's your legal right, and our standard is to send the replacement within 5 working days. With Care Plus we send it the next working day. If you use your own router, this doesn't apply.",
  },
  {
    q: "Does Care include repairs?",
    a: "No. Care doesn't repair or replace your own devices, and it isn't insurance. Our team can still help you work out what's wrong, which is often enough to get things going again.",
  },
  {
    q: "Can someone help me manage it?",
    a: "Yes. A carer, relative or someone with Power of Attorney can manage Care with you once you've told us. We can also send letters in large print or Braille.",
  },
  {
    q: "What if I don't use it?",
    a: "If you haven't used Care for 6 months, we'll ask if you still want it. Monthly members also get a reminder every 6 months showing what they've used, and how to cancel.",
  },
];

/**
 * Words that must never describe Care in any customer-facing copy, because
 * they make it sound like insurance. Allowed only inside a sentence that says
 * Care is NOT insurance (checked by the unit test with an explicit allow list).
 */
export const CARE_BANNED_PHRASES = [
  "covered",
  "cover you",
  "protects your",
  "protect your device",
  "protection plan",
  "extended warranty",
  "excess",
  "make a claim",
  "claim on",
  "insured",
  "if it breaks, we fix it",
  "peace of mind guaranteed",
];

/** Lines staff must read out, and the customer must agree to, before a phone-assisted sign-up link is sent. */
export const CARE_PHONE_SCRIPT: { id: string; line: string }[] = [
  { id: "price", line: "Care is [plan] at [price], VAT included, paid [monthly / every 3 months / yearly] by its own Direct Debit." },
  { id: "not_insurance", line: "It's a support service, not insurance. It doesn't pay for, repair or replace your own devices if they break, are damaged, lost or stolen." },
  { id: "first_payment", line: "Nothing is taken in the first 14 days, and we'll write to you at least 10 working days before your first payment." },
  { id: "cancel", line: "There's no minimum term and no exit fee. You can cancel any time, by phone, email, letter, chat, or in My OCCTA." },
  { id: "link", line: "I'll email you a secure link. You'll check the details and agree to it yourself. Nothing starts until you do." },
  { id: "no_pressure", line: "There's no deadline. Take your time and only go ahead if it's right for you." },
];

/** Reasons the system or staff may hold a sale for review. Shown to staff, never to customers. */
export const CARE_REVIEW_REASONS: Record<string, string> = {
  age_extra_check: "Customer is 75 or over: 48-hour pause, and the welcome call must be recorded before the sale can be approved.",
  support_needs: "Customer told us about support needs: check Care is right for them before lodging.",
  vulnerability_review_open: "Customer has an open vulnerability review on their account.",
  account_holder_mismatch: "Bank account holder name doesn't match the OCCTA account holder.",
  phone_assisted: "Sold with staff help: call recording and script checklist are on file.",
};

export const CARE_LETTER_TYPES = [
  "welcome_pack",
  "dd_confirmation",
  "advance_notice",
  "change_notice",
  "renewal_reminder",
  "usage_reminder",
  "payment_failed",
  "mandate_cancelled",
  "service_paused",
  "cancellation_confirmation",
  "refund_confirmation",
  "application_declined",
  "indemnity_followup",
] as const;
export type CareLetterType = typeof CARE_LETTER_TYPES[number];

/** Canonical text that consents hash. Any change produces a new hash and needs a new terms version. */
export function careTermsCanonicalText(): string {
  return [
    `OCCTA Care terms ${CARE_TERMS_VERSION} (${CARE_TERMS_EFFECTIVE})`,
    CARE_TERMS_SUMMARY,
    ...CARE_TERMS.flatMap((s) => [s.heading, ...s.points]),
  ].join("\n");
}
