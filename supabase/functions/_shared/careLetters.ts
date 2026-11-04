// OCCTA Care letters and emails: ONE builder produces the structured content
// used for the posted letter (PDF), its email copy and the print batch, so a
// customer's letter and email always say the same thing.
//
// Runtime-free (no Deno or browser imports): the web app's unit tests build
// every letter type and check the wording rules.
import {
  CARE_DD, CARE_RULES, CARE_TERMS_VERSION, carePlan, careFrequency, careFrequencyNoun, carePayWhen, pounds,
  type CareLetterType,
} from "./careTerms.ts";
import { providerGuaranteeText } from "./directDebitGuarantee.ts";

export interface CareRecipient {
  name: string;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  account_number?: string | null;
  reference: string;
  needs?: string[] | null;
  carer_name?: string | null;
  carer_contact?: string | null;
}

export interface CareLetterContent {
  type: CareLetterType;
  title: string;
  subject: string;
  preheader: string;
  greeting: string;
  paragraphs: string[];
  facts?: [string, string][];
  boxes?: { heading: string; lines: string[] }[];
  guarantee?: string;
  closing: string[];
  reference: string;
  accountNumber?: string | null;
  dateText: string;
  addressLines: string[];
  copyFor?: string | null;
}

export const OCCTA_CONTACT = {
  phone: "0800 260 6626",
  email: "hello@occta.co.uk",
  address: "OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU",
  web: "www.occta.co.uk",
} as const;

const ARUDD_TEXT: Record<string, string> = {
  "0": "your bank asked you to contact them (often because there wasn't enough money in the account at the time)",
  "1": "the Direct Debit Instruction was cancelled",
  "2": "your bank told us the account holder has died",
  "3": "the account has been moved to another bank",
  "5": "the account details weren't recognised",
  "6": "your bank didn't have the Direct Debit Instruction",
  "7": "the amount didn't match the advance notice",
  "8": "the payment was presented before it was due",
  "9": "the payment was presented too late",
  A: "the collector didn't match",
  B: "the account has been closed",
};

export function aruddText(code: string | null | undefined): string {
  return ARUDD_TEXT[String(code ?? "").toUpperCase()] ?? "your bank returned it";
}

export function longDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}


function priceWithNoun(minor: number, frequency: string): string {
  return `${pounds(minor)} ${frequency === "monthly" ? "a month" : frequency === "quarterly" ? "every 3 months" : "a year"}`;
}

const CANCEL_LINE =
  `You can cancel Care at any time, with no exit fee: use the Cancel button in My OCCTA, call ${OCCTA_CONTACT.phone}, email ${OCCTA_CONTACT.email}, write to us, or chat with Ollie at ${OCCTA_CONTACT.web}.`;
const NOT_INSURANCE_LINE =
  "OCCTA Care is a support service, not insurance. It does not pay for, repair or replace your own devices, and it doesn't change your legal rights.";
const SUPPORT_LINE =
  "If anything would make this easier, such as large print, Braille, more time, or someone helping you, just tell us. If money is tight, we can pause or cancel Care with no charge.";

/** Who collects this member's Direct Debit (AccessPay or FastPay). care-dispatch adds it from the mandate. */
function ddOf(payload: P): { name: string; sun: string } {
  return { name: str(payload.dd_collection_name) || CARE_DD.collectionName, sun: str(payload.dd_service_user_number) || CARE_DD.serviceUserNumber };
}

function guaranteeText(payload: P): string {
  return providerGuaranteeText({
    legal_collection_name: ddOf(payload).name,
    service_user_number: ddOf(payload).sun,
    advance_notice_working_days: CARE_DD.noticeWorkingDays,
  });
}

function addressLines(r: CareRecipient): string[] {
  return [r.name, r.address_line1, r.address_line2, r.city, r.postcode].filter((x): x is string => !!x && String(x).trim() !== "");
}

function firstName(name: string): string {
  const cleaned = name.replace(/^(mr|mrs|ms|miss|mx|dr)\.?\s+/i, "").trim();
  return cleaned.split(/\s+/)[0] || "there";
}

type P = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? "" : String(v));
const dayAfter = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); if (Number.isNaN(d.getTime())) return ""; d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export function buildCareLetter(type: CareLetterType | string, payload: P, recipient: CareRecipient, sentAt: Date = new Date()): CareLetterContent {
  const t = type as CareLetterType;
  const plan = carePlan(str(payload.plan_code))?.name;
  const freq = str(payload.frequency) || "monthly";
  const base = {
    type: t,
    reference: recipient.reference,
    accountNumber: recipient.account_number ?? null,
    dateText: longDate(sentAt),
    addressLines: addressLines(recipient),
    greeting: `Dear ${firstName(recipient.name)},`,
    closing: [CANCEL_LINE, NOT_INSURANCE_LINE, SUPPORT_LINE],
  };

  const out = buildCareLetterInner(t, payload, recipient, base, freq, sentAt);
  if (payload.copy && (t === "welcome_pack" || t === "dd_confirmation")) {
    out.title = `${out.title} (copy)`;
    out.subject = `Copy: ${out.subject}`;
    out.paragraphs = [`This is a copy you asked for, sent on ${base.dateText}. It doesn't change anything about your Care.`, ...out.paragraphs];
  }
  return out;
}

function buildCareLetterInner(t: CareLetterType, payload: P, recipient: CareRecipient, base: Omit<CareLetterContent, "title" | "subject" | "preheader" | "paragraphs">, freq: string, sentAt: Date): CareLetterContent {
  switch (t) {
    case "welcome_pack": {
      const price = num(payload.price_minor);
      const p = carePlan(str(payload.plan_code));
      return {
        ...base,
        title: "Welcome to OCCTA Care",
        subject: `Welcome to OCCTA Care (${recipient.reference})`,
        preheader: "What you've joined, what it costs and how to cancel.",
        paragraphs: [
          `Thank you for joining ${p?.name ?? "OCCTA Care"}. This letter confirms what you agreed to, so you can keep it for your records.`,
          payload.pending_review
            ? "Before we set up your Direct Debit, a member of our team will quickly check everything is right for you. We may call you. Nothing is taken until that's done and your cooling-off period has ended."
            : "We're setting up your Care Direct Debit now. You'll get a separate letter confirming it.",
          payload.started_early
            ? "You asked us to start helping straight away, so you can use Care now. That's free during your cooling-off period."
            : `Your Care starts on ${longDate(dayAfter(str(payload.cooling_off_ends_on)))}, the day after your 14-day cooling-off period ends.`,
        ],
        facts: [
          ["Plan", p?.name ?? str(payload.plan_code)],
          ["Price", `${priceWithNoun(price, freq)}, VAT included`],
          ["How you pay", `Its own Direct Debit to ${ddOf(payload).name}, ${carePayWhen(freq, num(payload.collection_day))}`],
          ["First payment", `${pounds(price)} on or just after ${longDate(str(payload.first_collection_date))}`],
          ["Cooling-off ends", longDate(str(payload.cooling_off_ends_on))],
          ["Minimum term", "None. Cancel any time, no exit fee."],
        ],
        boxes: [
          { heading: "What's included", lines: p?.features ?? [] },
          {
            heading: "What's not included",
            lines: [
              "Care does not pay for, repair or replace your own phone, tablet, computer or other devices if they break down, are damaged, lost or stolen.",
              "Repairs to your own devices aren't part of Care.",
            ],
          },
          {
            heading: "Changed your mind?",
            lines: [
              `You can cancel within 14 days (by ${longDate(str(payload.cooling_off_ends_on))}) for any reason. Nothing is taken during this time, so you won't pay anything.`,
              "After that, you can still cancel whenever you like.",
            ],
          },
        ],
        closing: [`Need help? Call ${OCCTA_CONTACT.phone} (Monday to Saturday, 8am to 8pm), email ${OCCTA_CONTACT.email} or use My OCCTA, quoting ${recipient.reference}.`, SUPPORT_LINE],
      };
    }

    case "dd_confirmation": {
      const price = num(payload.price_minor);
      return {
        ...base,
        title: "Your OCCTA Care Direct Debit",
        subject: `Your OCCTA Care Direct Debit (${recipient.reference})`,
        preheader: "Confirmation of your Direct Debit and payment schedule.",
        paragraphs: payload.pending_review
          ? [
              "This confirms the Direct Debit Instruction you gave us for OCCTA Care. It's separate from any other OCCTA Direct Debit, so it never affects your broadband, phone or SIM.",
              "Before we set it up with your bank, a member of our team will check Care is right for you. Nothing will be taken before then.",
              `If we go ahead, we'll write to you with the date and amount of your first payment at least ${CARE_DD.noticeWorkingDays} working days before it's taken. After that, payments are ${pounds(price)} ${carePayWhen(freq, num(payload.collection_day))} (or the next working day).`,
              "If anything below is wrong, please contact us straight away.",
            ]
          : [
              "This confirms the Direct Debit Instruction you gave us for OCCTA Care. It's separate from any other OCCTA Direct Debit, so it never affects your broadband, phone or SIM.",
              `This letter is also your advance notice. Unless we write to tell you otherwise, we will collect ${pounds(price)} on or just after ${longDate(str(payload.first_collection_date))}, then ${pounds(price)} ${carePayWhen(freq, num(payload.collection_day))} (or the next working day).`,
              "If anything below is wrong, please contact us straight away.",
            ],
        facts: [
          ["Collected by", `${ddOf(payload).name} (Service User Number ${ddOf(payload).sun})`],
          ["Reference on your statement", recipient.reference],
          ["Account holder", str(payload.account_holder_name)],
          ["Bank account", `${str(payload.bank_name) ? `${str(payload.bank_name)}, ` : ""}sort code ending ${str(payload.masked_sort_last2)}, account ending ${str(payload.masked_account_last4)}`],
          ...(payload.pending_review
            ? [["First payment", "We'll write with the date at least 10 working days before"] as [string, string]]
            : [["First payment", `${pounds(price)} on or just after ${longDate(str(payload.first_collection_date))}`] as [string, string]]),
          ["Then", `${pounds(price)} ${carePayWhen(freq, num(payload.collection_day))}`],
          ["Notice", `At least ${CARE_DD.noticeWorkingDays} working days before any payment or change`],
          ["Questions", `${OCCTA_CONTACT.phone}`],
        ],
        guarantee: guaranteeText(payload),
        closing: [CANCEL_LINE, SUPPORT_LINE],
      };
    }

    case "advance_notice": {
      return {
        ...base,
        title: "Advance notice of your OCCTA Care payment",
        subject: `OCCTA Care payment notice (${recipient.reference})`,
        preheader: `${pounds(num(payload.amount_minor))} on ${longDate(str(payload.due_date))}.`,
        paragraphs: [
          `We will collect ${pounds(num(payload.amount_minor))} by Direct Debit on or just after ${longDate(str(payload.due_date))}, for Care from ${longDate(str(payload.period_start))} to ${longDate(str(payload.period_end))}.`,
          "You don't need to do anything. If you'd rather not continue, cancel before that date and nothing will be taken.",
        ],
        facts: [
          ["Amount", pounds(num(payload.amount_minor))],
          ["Date", longDate(str(payload.due_date))],
          ["How often", str(payload.kind) === "represent" ? "One-off re-try of a returned payment" : freq === "annual" ? "Once a year, on the same date" : `Every ${careFrequencyNoun(freq)}, on the same day of the month`],
          ["Reference", recipient.reference],
          ["Collected by", `${ddOf(payload).name} (SUN ${ddOf(payload).sun})`],
          ["Notice", `At least ${CARE_DD.noticeWorkingDays} working days before each payment`],
          ["Questions", `${OCCTA_CONTACT.phone}`],
        ],
        guarantee: guaranteeText(payload),
      };
    }

    case "change_notice": {
      const kind = str(payload.kind);
      if (kind === "price_change") {
        return {
          ...base,
          title: "A change to your OCCTA Care price",
          subject: `Your OCCTA Care price is changing (${recipient.reference})`,
          preheader: "At least 30 days' notice, and you can leave free.",
          paragraphs: [
            `From ${longDate(str(payload.effective_date))}, your Care price will change from ${priceWithNoun(num(payload.old_price_minor), freq)} to ${priceWithNoun(num(payload.new_price_minor), freq)}, VAT included.`,
            "If you don't want to continue at the new price, you can cancel free at any time before then. Anything you've already paid for keeps the old price.",
          ],
          facts: [["Old price", pounds(num(payload.old_price_minor))], ["New price", pounds(num(payload.new_price_minor))], ["From", longDate(str(payload.effective_date))]],
          guarantee: guaranteeText(payload),
        };
      }
      if (kind === "plan_change") {
        const to = carePlan(str(payload.to_plan))?.name ?? str(payload.to_plan);
        const from = carePlan(str(payload.from_plan))?.name ?? str(payload.from_plan);
        return {
          ...base,
          title: "Your OCCTA Care plan change",
          subject: `Your OCCTA Care plan change (${recipient.reference})`,
          preheader: `You've moved to ${to}.`,
          paragraphs: [
            `You've asked to change from ${from} to ${to}. Your new price will be ${priceWithNoun(num(payload.new_price_minor), freq)}, VAT included.`,
            payload.effective_date
              ? `${to} and the new price start on ${longDate(str(payload.effective_date))}, the start of your next payment period. Until then you keep ${from}, which you've already paid for. The first payment at the new price is collected on or just after ${longDate(str(payload.due_date || payload.effective_date))}, and this letter is your advance notice of it.`
              : `${to} and the new price start from your next payment period. We'll write again with the exact date and amount at least 10 working days before.`,
          ],
          facts: [["New plan", to], ["New price", pounds(num(payload.new_price_minor))]],
          guarantee: guaranteeText(payload),
        };
      }
      return {
        ...base,
        title: "A new date for your OCCTA Care payment",
        subject: `Your OCCTA Care payment date has moved (${recipient.reference})`,
        preheader: `Now on ${longDate(str(payload.new_date))}.`,
        paragraphs: [
          `Your next Care payment of ${pounds(num(payload.amount_minor))} will now be collected on or just after ${longDate(str(payload.new_date))}, instead of ${longDate(str(payload.old_date))}.`,
          str(payload.reason) === "mandate_not_ready"
            ? "This is because your Direct Debit wasn't fully set up with your bank in time. You won't be charged twice, and you don't need to do anything."
            : "We've moved it so that you get a full 10 working days' notice. You don't need to do anything.",
        ],
        facts: [["Amount", pounds(num(payload.amount_minor))], ["New date", longDate(str(payload.new_date))]],
        guarantee: guaranteeText(payload),
      };
    }

    case "renewal_reminder": {
      const used = num(payload.usage_count);
      return {
        ...base,
        title: "Your OCCTA Care renewal",
        subject: `Your OCCTA Care renews on ${longDate(str(payload.due_date))} (${recipient.reference})`,
        preheader: `${pounds(num(payload.amount_minor))} on ${longDate(str(payload.due_date))}. Cancel before then if you don't want it.`,
        paragraphs: [
          `Your Care renews for ${freq === "annual" ? "another year" : "another 3 months"} from ${longDate(str(payload.period_start))}. We will collect ${pounds(num(payload.amount_minor))} by Direct Debit on or just after ${longDate(str(payload.due_date))}.`,
          used > 0
            ? `In the last ${num(payload.usage_months) || (freq === "annual" ? 12 : 3)} months you used Care ${used} time${used === 1 ? "" : "s"}.`
            : "We haven't helped you with anything recently. If you don't think Care is worth it for you, please cancel before the date above and nothing more will be taken.",
          "This letter is your advance notice of the payment.",
        ],
        facts: [["Amount", pounds(num(payload.amount_minor))], ["Date", longDate(str(payload.due_date))], ["Period", `${longDate(str(payload.period_start))} to ${longDate(str(payload.period_end))}`], ["Questions", `${OCCTA_CONTACT.phone}`]],
        guarantee: guaranteeText(payload),
      };
    }

    case "usage_reminder": {
      const used = num(payload.usage_count);
      const low = !!payload.low_use;
      return {
        ...base,
        title: low ? "Do you still want OCCTA Care?" : "Your OCCTA Care: a quick check-in",
        subject: low ? `Do you still want OCCTA Care? (${recipient.reference})` : `Your OCCTA Care check-in (${recipient.reference})`,
        preheader: low ? "You haven't used Care for 6 months." : "What you've used, and how to cancel if you want to.",
        paragraphs: [
          low
            ? `You haven't used Care since ${longDate(str(payload.since))}. You're paying ${priceWithNoun(num(payload.price_minor), freq)}, so we want to check it's still right for you.`
            : `Since ${longDate(str(payload.since))} you've used Care ${used} time${used === 1 ? "" : "s"}. You're paying ${priceWithNoun(num(payload.price_minor), freq)}.`,
          low
            ? "If you'd like to keep it, you don't need to do anything. If not, cancel and nothing more will be taken. Either way is fine with us."
            : "We send this reminder every 6 months so you can decide whether Care is still worth it.",
        ],
      };
    }

    case "payment_failed": {
      return {
        ...base,
        title: "Your OCCTA Care payment didn't go through",
        subject: `Your OCCTA Care payment didn't go through (${recipient.reference})`,
        preheader: "We'll try once more. No fees.",
        paragraphs: [
          `We tried to collect ${pounds(num(payload.amount_minor))} for Care around ${longDate(str(payload.due_date))}, but your bank returned it because ${aruddText(str(payload.reason_code))}.`,
          payload.retry_date
            ? `We'll try once more on or just after ${longDate(str(payload.retry_date))}. This letter is your advance notice of that re-try. There are no fees for a missed Care payment.`
            : "We won't try to take it again without speaking to you first. There are no fees for a missed Care payment, and we'll be in touch.",
          "If you'd rather not continue, or if money is tight right now, just tell us and we'll cancel or pause Care with no charge. We never pass Care balances to debt collectors.",
        ],
        facts: payload.retry_date
          ? [["Amount", pounds(num(payload.amount_minor))], ["We'll try again", longDate(str(payload.retry_date))], ["Reference", recipient.reference], ["Questions", `${OCCTA_CONTACT.phone}`]]
          : [["Amount", pounds(num(payload.amount_minor))], ["Reference", recipient.reference], ["Questions", `${OCCTA_CONTACT.phone}`]],
        guarantee: guaranteeText(payload),
      };
    }

    case "service_paused": {
      const ended = str(payload.reason) === "instruction_ended";
      return {
        ...base,
        title: "We've paused your OCCTA Care",
        subject: `Your OCCTA Care is paused (${recipient.reference})`,
        preheader: "No more payments will be taken. Nothing is owed.",
        paragraphs: [
          str(payload.reason) === "customer_request"
            ? "As you asked, we've paused your OCCTA Care."
            : ended
              ? `Your bank told us your Care Direct Debit can't be used any more (${aruddText(str(payload.reason_code))}).`
              : "We weren't able to collect your last two Care payments.",
          "We've paused Care and won't take any more payments. You don't owe us anything for Care, and we won't chase you or charge any fees.",
          "If you'd like to start Care again, you can join again from My OCCTA → OCCTA Care whenever you like, or give us a call. If you're having a hard time at the moment, we're happy to help with your other OCCTA services too.",
        ],
        closing: [NOT_INSURANCE_LINE, SUPPORT_LINE],
      };
    }

    case "mandate_cancelled": {
      const rejected = str(payload.kind) === "rejected";
      return {
        ...base,
        title: rejected ? "We couldn't set up your Care Direct Debit" : "Your Care Direct Debit was cancelled",
        subject: rejected ? `We couldn't set up your Care Direct Debit (${recipient.reference})` : `Your Care Direct Debit was cancelled (${recipient.reference})`,
        preheader: rejected ? "Nothing has been taken." : "We've stopped your Care.",
        paragraphs: rejected
          ? [
              "Your bank couldn't accept the Direct Debit for OCCTA Care, so Care hasn't started and nothing has been taken.",
              "If you'd still like Care, you can join again from My OCCTA with a different account, or call us and we'll help.",
            ]
          : [
              "Your bank told us the Direct Debit for OCCTA Care has been cancelled. We treat that as you cancelling Care, and we won't take any more payments.",
              payload.effective_date
                ? `Your Care ends on ${longDate(str(payload.effective_date))}. You'll get a separate cancellation confirmation with any refund due.`
                : "You'll get a separate cancellation confirmation with any refund due.",
              "If you didn't mean to cancel, call us and we'll help you set it up again.",
            ],
        closing: [NOT_INSURANCE_LINE, SUPPORT_LINE],
      };
    }

    case "cancellation_confirmation": {
      const refund = num(payload.refund_minor);
      const eff = str(payload.effective_date);
      const today = new Date(sentAt).toISOString().slice(0, 10);
      return {
        ...base,
        title: "Your OCCTA Care is cancelled",
        subject: `Your OCCTA Care is cancelled (${recipient.reference})`,
        preheader: refund > 0 ? `A refund of ${pounds(refund)} is on its way.` : "No more payments will be taken.",
        paragraphs: [
          "This confirms we've cancelled your OCCTA Care. No more Care payments will be taken.",
          eff && eff > today
            ? `You can keep using Care until ${longDate(eff)}, the end of the period you've already paid for.`
            : "Your Care has ended today.",
          refund > 0
            ? `We'll refund ${pounds(refund)} to your bank account by bank transfer within ${CARE_RULES.refundWithinDays} days${payload.refunds && Array.isArray(payload.refunds) && (payload.refunds as unknown[]).length ? " (for time you'd paid for but won't use)" : ""}. We'll write again when it's sent.`
            : payload.in_cooling_off ? "As you cancelled in your cooling-off period, you haven't paid anything." : "There's nothing for you to pay and nothing to refund.",
          "We've also asked for your Care Direct Debit to be cancelled. You don't need to contact your bank, though you can if you'd like to.",
          "You can rejoin at any time. Thank you for being a member.",
        ],
        facts: [["Care reference", recipient.reference], ["Ends", longDate(eff || today)], ...(refund > 0 ? [["Refund", pounds(refund)] as [string, string]] : [])],
        closing: [NOT_INSURANCE_LINE, SUPPORT_LINE],
      };
    }

    case "refund_confirmation": {
      return {
        ...base,
        title: "Your OCCTA Care refund",
        subject: `Your OCCTA Care refund of ${pounds(num(payload.amount_minor))} (${recipient.reference})`,
        preheader: "We've sent your refund.",
        paragraphs: [
          `We sent your refund of ${pounds(num(payload.amount_minor))} by bank transfer on ${longDate(str(payload.paid_on))}. It usually arrives within 2 working days.`,
          "If you can't see it after 5 working days, please call us.",
        ],
        facts: [["Amount", pounds(num(payload.amount_minor))], ["Sent", longDate(str(payload.paid_on))]],
        closing: [SUPPORT_LINE],
      };
    }

    case "application_declined": {
      return {
        ...base,
        title: "About your OCCTA Care application",
        subject: `About your OCCTA Care application (${recipient.reference})`,
        preheader: "We haven't started Care. Nothing has been taken.",
        paragraphs: [
          "Thank you for asking for OCCTA Care. After checking, we don't think it's the right fit at the moment, so we haven't started it and nothing has been or will be taken.",
          "This doesn't affect any of your other OCCTA services. If you'd like to talk it through, or think we've got it wrong, please call us.",
        ],
        closing: [SUPPORT_LINE],
      };
    }

    case "indemnity_followup": {
      return {
        ...base,
        title: "About your OCCTA Care payment refund",
        subject: `About your OCCTA Care payment refund (${recipient.reference})`,
        preheader: "Your bank refunded a Care payment.",
        paragraphs: [
          `Your bank refunded a Care payment of ${pounds(num(payload.amount_minor))} under the Direct Debit Guarantee, and we've ended your Care. You don't need to do anything, and you don't owe us anything for Care.`,
          "If something went wrong with Care, please tell us so we can put it right. If you'd like Care again in future, you can join again from My OCCTA.",
        ],
        closing: [SUPPORT_LINE],
      };
    }

    case "agreement_copy": {
      const p = carePlan(str(payload.plan_code));
      const c = (payload.consent ?? {}) as { key_facts?: string[]; agreed_at?: string; verified?: string; verified_at?: string; channel?: string; terms_sha256?: string };
      return {
        ...base,
        title: "A copy of your OCCTA Care agreement",
        subject: `Your OCCTA Care agreement (${recipient.reference})`,
        preheader: "What you agreed to, and when.",
        paragraphs: [
          "As requested, here is a copy of your OCCTA Care agreement: the key facts you saw and agreed to, and how you confirmed it.",
          `The full terms (version ${str(payload.terms_version) || CARE_TERMS_VERSION}) are at ${OCCTA_CONTACT.web}/legal/occta-care-terms. We can post you a printed copy if you'd like one.`,
        ],
        facts: [
          ["Plan", p?.name ?? str(payload.plan_code)],
          ["Price", `${priceWithNoun(num(payload.price_minor), freq)}, VAT included`],
          ["Paid by", `Its own Direct Debit to ${ddOf(payload).name}, ${carePayWhen(freq, num(payload.collection_day))}`],
          ["Agreed on", c.agreed_at ? longDate(str(c.agreed_at).slice(0, 10)) : "-"],
          ["Confirmed by", c.verified === "call_recording" ? "Your agreement on a recorded phone call" : c.verified === "sms_otp" ? "A one-time code sent to your mobile" : c.verified === "email_code" ? "A one-time code sent to your email" : "-"],
          ["How you joined", c.channel === "phone_assisted" ? "By phone with our team" : "Online, in My OCCTA"],
          ["Terms version", str(payload.terms_version)],
          ["Minimum term", "None. Cancel any time, no exit fee."],
        ],
        boxes: [{ heading: "Key facts you agreed to", lines: Array.isArray(c.key_facts) ? c.key_facts.map(String) : [] }],
        guarantee: guaranteeText(payload),
      };
    }

    case "general_letter": {
      return {
        ...base,
        title: str(payload.subject) || "About your OCCTA Care",
        subject: `${str(payload.subject) || "About your OCCTA Care"} (${recipient.reference})`,
        preheader: str(payload.subject) || "A message from the OCCTA Care team.",
        paragraphs: str(payload.body).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean),
      };
    }

    default:
      throw new Error(`unknown_care_letter_type:${t}`);
  }
}

/** Plain-text rendering (used for email text parts and tests). */
export function careLetterText(c: CareLetterContent): string {
  const lines: string[] = [c.title, c.dateText, `Reference: ${c.reference}`, "", c.greeting, "", ...c.paragraphs.flatMap((p) => [p, ""])];
  if (c.facts?.length) lines.push(...c.facts.map(([k, v]) => `${k}: ${v}`), "");
  for (const b of c.boxes ?? []) lines.push(b.heading.toUpperCase(), ...b.lines.map((l) => `- ${l}`), "");
  if (c.guarantee) lines.push("THE DIRECT DEBIT GUARANTEE", c.guarantee, "");
  lines.push(...c.closing, "", "Yours sincerely,", "The OCCTA Care team", OCCTA_CONTACT.address);
  return lines.join("\n");
}

export { careFrequency };
