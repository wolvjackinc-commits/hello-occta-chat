// OCCTA Care telesales script and the call-QA checks built from it.
// Used by the Sales Desk (agents read it), the call scorer (care-sales) and
// the written sales process. No runtime imports: shared by Vite and Deno.
//
// Why each line exists: a Care sale can be undone by a Direct Debit
// indemnity claim at any time, so the call must prove the ACCOUNT HOLDER
// agreed, KNEW the price and frequency, KNEW it isn't insurance, and was
// told about cooling-off, cancelling and the Direct Debit Guarantee.

export type ScriptStep = { id: string; stage: string; say: string; mandatory: boolean; check: string };

export const CARE_SALES_SCRIPT: ScriptStep[] = [
  { id: "intro", stage: "Open", mandatory: true,
    say: "Hello, it's [your name] from OCCTA. This call is recorded for training and to keep a record of anything we agree. Is now a good time?",
    check: "Agent gives their name, says they are from OCCTA, and says the call is recorded." },
  { id: "identity", stage: "Security", mandatory: true,
    say: "Before we go on, can I confirm I'm speaking to the account holder? Please tell me your full name, your postcode and the first line of your address.",
    check: "Agent confirms the person is the OCCTA account holder using at least name plus postcode/address (not just 'yes')." },
  { id: "permission", stage: "Open", mandatory: true,
    say: "We have a support plan called OCCTA Care that some customers find useful. Would you like me to tell you about it? It's completely fine to say no.",
    check: "Agent asks permission before pitching and makes clear the customer can say no." },
  { id: "need", stage: "Fit", mandatory: false,
    say: "What do you mostly use at home: Wi-Fi, phones, tablets, laptops, printers? Do you ever need help setting things up?",
    check: "Agent asks what the customer uses or needs help with before recommending a plan." },
  { id: "what_it_is", stage: "Explain", mandatory: true,
    say: "OCCTA Care gives you our UK tech support team, Monday to Saturday 8am to 8pm, remote help with your devices and Wi-Fi, and setup and data transfer for new devices.",
    check: "Agent describes Care as a support/help service and describes what is included accurately." },
  { id: "not_insurance", stage: "Explain", mandatory: true,
    say: "To be really clear: it's a support service, not insurance. It doesn't pay for, repair or replace your own devices if they break, are damaged, lost or stolen.",
    check: "Agent says clearly that Care is NOT insurance and does not pay for, repair or replace the customer's own devices." },
  { id: "price", stage: "Price", mandatory: true,
    say: "[Care Essentials is £4.99 / Care Plus is £8.99] a month, VAT included. You can also pay every 3 months, or yearly with 2 months free, which is [£amount].",
    check: "Agent states the exact price for the chosen plan and frequency, including VAT, matching the price list." },
  { id: "own_dd", stage: "Price", mandatory: true,
    say: "It's paid by its own Direct Debit, separate from your broadband, and your statement shows it under the collector named in your email and letter (APS Re OCCTA or FastPay), with a reference starting OCCTA CARE.",
    check: "Agent says Care is paid by its own Direct Debit, separate from broadband, and how it shows on the statement." },
  { id: "cooling_off", stage: "Rights", mandatory: true,
    say: "Nothing is taken for the first 14 days. That's your cooling-off period, and you can cancel for any reason in that time and pay nothing.",
    check: "Agent explains the 14-day cooling-off period and that nothing is taken during it." },
  { id: "cancel", stage: "Rights", mandatory: true,
    say: "There's no minimum term and no exit fee. You can cancel any time by phone, email, letter, chat, or the Cancel button in My OCCTA.",
    check: "Agent says there is no minimum term and no exit fee, and that the customer can cancel any time." },
  { id: "notice", stage: "Rights", mandatory: true,
    say: "We'll write to you at least 10 working days before your first payment, and before any change. Your payments are protected by the Direct Debit Guarantee.",
    check: "Agent mentions advance written notice of payments and the Direct Debit Guarantee." },
  { id: "link_self_serve", stage: "Close", mandatory: true,
    say: "I'll email you a secure link. You'll check the details, enter your bank details and agree to it yourself. Nothing starts until you do. I won't take your bank details over the phone.",
    check: "Agent explains the customer completes sign-up themselves via the link, and does NOT take bank details on the call." },
  { id: "consent", stage: "Close", mandatory: true,
    say: "Are you happy for me to send you that link? [Wait for a clear yes from the customer themselves.]",
    check: "The account holder gives a clear, unprompted 'yes' to receiving the link, in their own voice." },
  { id: "no_pressure", stage: "Close", mandatory: true,
    say: "There's no deadline. Take your time, and only go ahead if it's right for you.",
    check: "Agent makes clear there is no deadline or pressure." },
  { id: "recap", stage: "Close", mandatory: false,
    say: "So that's [plan] at [price] [frequency], nothing taken for 14 days, cancel any time. Anything you'd like me to go over again?",
    check: "Agent recaps plan, price and frequency and invites questions." },
];

/** Things that make a sale unsafe however well the script was read. */
export const CARE_QA_RED_FLAGS: { id: string; severity: "decline" | "hold"; detail: string }[] = [
  { id: "insurance_claim", severity: "decline", detail: "Agent described Care as insurance, cover, protection or a warranty, or said it pays for, repairs or replaces devices." },
  { id: "not_account_holder", severity: "decline", detail: "The person agreeing is not the OCCTA account holder, or someone else answered for them." },
  { id: "no_consent", severity: "decline", detail: "Customer said no, didn't clearly agree, or the agent assumed agreement." },
  { id: "wrong_price", severity: "decline", detail: "Agent quoted a price, frequency or term that doesn't match the price list." },
  { id: "bank_details_on_call", severity: "decline", detail: "Agent asked for or took bank or card details on the call." },
  { id: "card_payment", severity: "decline", detail: "Agent offered card or pay-by-phone payment (OCCTA takes Direct Debit or bank transfer only)." },
  { id: "pressure", severity: "hold", detail: "Pressure or urgency: 'today only', repeated pushing after hesitation, talking over the customer." },
  { id: "vulnerability", severity: "hold", detail: "Signs the customer may be vulnerable: confusion, memory problems, bereavement, illness, money worries, distress, very elderly, hearing difficulty." },
  { id: "confusion", severity: "hold", detail: "Customer seemed unsure what Care is, what it costs, or that it is separate from broadband." },
  { id: "misleading_other", severity: "hold", detail: "Any other inaccurate or misleading statement (e.g. legal rights presented as a Care benefit, repairs offered)." },
];

export const CARE_QA_PASS_SCORE = 85;
export const CARE_QA_HOLD_SCORE = 60;

/** Deterministic decision from the scorer's findings, so the model can't wave a bad sale through. */
export function careQaDecision(r: { checks: { id: string; status: string }[]; red_flags: { id: string }[]; score: number }): { decision: "pass" | "hold" | "decline"; reasons: string[] } {
  const reasons: string[] = [];
  const flagDef = new Map(CARE_QA_RED_FLAGS.map((f) => [f.id, f]));
  const declines = r.red_flags.filter((f) => flagDef.get(f.id)?.severity === "decline");
  const holds = r.red_flags.filter((f) => flagDef.get(f.id)?.severity !== "decline");
  const missing = CARE_SALES_SCRIPT.filter((s) => s.mandatory && r.checks.find((c) => c.id === s.id)?.status !== "met");
  if (declines.length) reasons.push(...declines.map((f) => `Red flag: ${flagDef.get(f.id)?.detail ?? f.id}`));
  if (declines.length) return { decision: "decline", reasons };
  if (holds.length) reasons.push(...holds.map((f) => `Needs a supervisor: ${flagDef.get(f.id)?.detail ?? f.id}`));
  if (missing.length) reasons.push(...missing.map((s) => `Mandatory step not clearly done: ${s.stage} — ${s.check}`));
  if (r.score < CARE_QA_HOLD_SCORE) { reasons.push(`Score ${r.score} is below ${CARE_QA_HOLD_SCORE}.`); return { decision: "decline", reasons }; }
  if (holds.length || missing.length || r.score < CARE_QA_PASS_SCORE) {
    if (r.score < CARE_QA_PASS_SCORE && !holds.length && !missing.length) reasons.push(`Score ${r.score} is below the pass mark of ${CARE_QA_PASS_SCORE}.`);
    return { decision: "hold", reasons };
  }
  return { decision: "pass", reasons: [`All mandatory steps done, no red flags, score ${r.score}.`] };
}
