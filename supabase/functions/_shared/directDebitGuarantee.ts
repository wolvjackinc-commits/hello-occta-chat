// Standard Bacs Direct Debit Guarantee wording — mirror of
// src/lib/legal/directDebitGuarantee.ts. Update both files together.

export const DD_GUARANTEE_TEXT = `This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.

If there are any changes to the amount, date or frequency of your Direct Debit, OCCTA Limited will notify you (normally 10 working days) in advance of your account being debited or as otherwise agreed. If you request OCCTA Limited to collect a payment, confirmation of the amount and date will be given to you at the time of the request.

If an error is made in the payment of your Direct Debit, by OCCTA Limited or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.

If you receive a refund you are not entitled to, you must pay it back when OCCTA Limited asks you to.

You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.`;

export function ddGuaranteeHtml(): string {
  const paras = DD_GUARANTEE_TEXT.split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;">${p.replace(/\n/g, "<br/>")}</p>`) 
    .join("");
  return `<div style="border:3px solid #000;padding:16px;background:#f5f5f4;margin:18px 0;">
    <p style="margin:0 0 10px 0;font-family:Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:13px;">The Direct Debit Guarantee</p>
    ${paras}
  </div>`;
}

// ---------------------------------------------------------------------------
// Provider-specific Guarantee. OCCTA collects through TWO MANUAL bureaux and
// each has its own collection name, Service User Number and advance-notice
// period, so the Guarantee wording must be rendered from the selected
// provider's configuration — never from a hardcoded default.
// ---------------------------------------------------------------------------
export interface DDProviderForGuarantee {
  legal_collection_name: string;
  service_user_number: string;
  advance_notice_working_days: number;
}

export function providerGuaranteeText(p: DDProviderForGuarantee): string {
  const c = p.legal_collection_name;
  const n = p.advance_notice_working_days;
  return `This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.

If there are any changes to the amount, date or frequency of your Direct Debit, ${c} (or OCCTA Ltd) will notify you ${n} working days in advance of your account being debited, or as otherwise agreed. If you request ${c} (or OCCTA Ltd) to collect a payment, confirmation of the amount and date will be given to you at the time of the request. Collections are made under Service User Number ${p.service_user_number}.

If an error is made in the payment of your Direct Debit, by ${c}, OCCTA Ltd or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.

If you receive a refund you are not entitled to, you must pay it back when ${c} or OCCTA Ltd asks you to.

You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.`;
}

/** Instruction wording printed above the payer's authorisation on the DDI. */
export function providerInstructionText(p: DDProviderForGuarantee): string {
  return `Please pay ${p.legal_collection_name} Direct Debits from the account detailed in this Instruction, subject to the safeguards assured by the Direct Debit Guarantee. I understand that this Instruction may remain with ${p.legal_collection_name} and, if so, details will be passed electronically to my bank/building society. Service User Number ${p.service_user_number}.`;
}