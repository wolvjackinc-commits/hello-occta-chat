// Customer-facing Direct Debit status notification content.
//
// OCCTA operates TWO MANUAL Direct Debit bureaux (FastPay Ltd and
// AccessPay / APS Re OCCTA). There is no provider API and no webhook: an
// authorised admin submits the mandate in the provider portal and records the
// result. This module renders the customer email for a recorded status change.
//
// SECURITY: the payload passed in here must never contain a full account
// number, sort code, encrypted payload, signature, or IP address. Only the
// masked bank suffix, provider metadata and status wording are rendered.

import { renderBrandedEmail, escapeEmailHtml as esc } from "./brandedEmailShell.ts";

export const DD_SUPPORT_PHONE = "0800 260 6626";
export const DD_SUPPORT_EMAIL = "hello@occta.co.uk";

/** Keys that must never appear in a notification payload. */
export const DD_FORBIDDEN_PAYLOAD_KEYS = [
  "account_number_full",
  "account_number",
  "sort_code",
  "bank_details_ciphertext",
  "enc_nonce",
  "signature_name",
  "consent_ip",
  "consent_user_agent",
];

export interface DDStatusPayload {
  customer_name?: string | null;
  mandate_reference?: string | null;
  mandate_bank_last4?: string | null;
  new_status: string;
  new_status_label?: string | null;
  old_status?: string | null;
  provider_code?: string | null;
  provider_display_name?: string | null;
  provider_collection_name?: string | null;
  provider_service_user_number?: string | null;
  advance_notice_working_days?: number | null;
  provider_reference?: string | null;
  updated_at?: string | null;
}

/**
 * Strips the customer account number and any sensitive-looking key from an
 * outbox payload before it is rendered or logged.
 */
export function sanitiseDDPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload ?? {})) {
    if (DD_FORBIDDEN_PAYLOAD_KEYS.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

function ukDateTime(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextSteps(p: DDStatusPayload): string {
  const notice = p.advance_notice_working_days ?? null;
  const collector = p.provider_collection_name || p.provider_display_name || "our Direct Debit provider";
  switch (p.new_status) {
    case "details_received":
      return "We have safely received your bank details. Nothing further is needed from you right now — we will confirm as soon as your instruction has been set up.";
    case "pending_contract":
      return "Your Direct Debit is held while your agreement is completed. Once that is done we will set up your instruction and email you again.";
    case "awaiting_manual_submission":
      return "Your instruction is queued for set-up with our Direct Debit provider. We will email you once it has been submitted.";
    case "submitted_to_provider":
      return `Your Direct Debit Instruction has been submitted to ${esc(collector)}. Your bank normally shows the instruction within a few working days. You do not need to contact your bank.`;
    case "active":
      return `Your Direct Debit is set up and future OCCTA payments will be collected automatically by ${esc(collector)}. Your invoices will continue to be emailed to you as usual.`;
    case "action_required":
      return "Something on your Direct Debit Instruction needs checking before we can complete the set-up. Please contact us using the details below and we will put it right — no payment has been taken.";
    case "rejected":
    case "failed":
      return "Your Direct Debit Instruction was not accepted, so no payments will be collected by Direct Debit. Please contact us and we will help you set it up again or arrange another way to pay.";
    case "cancelled":
      return "Your Direct Debit Instruction has been cancelled and no further Direct Debit payments will be collected. If you still have an OCCTA service, please contact us to arrange payment.";
    default:
      return notice
        ? `We will give you at least ${notice} working days' notice before any change to the amount, date or frequency of a collection.`
        : "We will keep you updated on your Direct Debit.";
  }
}

export function buildDDStatusEmail(payload: DDStatusPayload): { subject: string; html: string; text: string } {
  const p = payload;
  const statusLabel = p.new_status_label || p.new_status.replace(/_/g, " ");
  const providerName = p.provider_display_name || null;
  const notice = p.advance_notice_working_days ?? null;
  const showReference = ["submitted_to_provider", "active"].includes(p.new_status) && !!p.provider_reference;
  const showNotice = ["submitted_to_provider", "active"].includes(p.new_status) && !!notice;

  const subject = ddSubject(p.new_status);

  const rows: Array<[string, string]> = [
    ["Direct Debit reference", p.mandate_reference || "—"],
    ["Status", statusLabel],
    ["Updated", ukDateTime(p.updated_at)],
  ];
  if (providerName) rows.push(["Direct Debit provider", providerName]);
  if (p.provider_service_user_number) rows.push(["Service User Number", p.provider_service_user_number]);
  if (p.mandate_bank_last4) rows.push(["Bank account", `••••${p.mandate_bank_last4}`]);
  if (showReference) rows.push(["Provider reference", String(p.provider_reference)]);

  const detailHtml = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 0;color:#666666;width:45%">${esc(k)}</td><td style="padding:6px 0;font-weight:700;color:#111111">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>`;

  const noticeHtml = showNotice
    ? `<p style="margin:0;font-size:14px;line-height:1.6">${esc(
        p.provider_collection_name || providerName || "Our Direct Debit provider",
      )} (or OCCTA Ltd) will notify you at least <strong>${notice} working days</strong> in advance of the amount, date and frequency of any collection, unless otherwise agreed. Payments are collected under OCCTA's Service User Number ${esc(
        p.provider_service_user_number || "",
      )}.</p>`
    : "";

  const sections = [
    { heading: "Your Direct Debit", html: detailHtml },
    { heading: "What happens next", html: `<p style="margin:0;font-size:14px;line-height:1.6">${nextSteps(p)}</p>` },
  ];
  if (noticeHtml) sections.push({ heading: "Advance notice", html: noticeHtml });
  sections.push({
    heading: "Need help?",
    html: `<p style="margin:0;font-size:14px;line-height:1.6">Call us on <strong>${DD_SUPPORT_PHONE}</strong> or email <strong>${DD_SUPPORT_EMAIL}</strong>. For your security we never ask for your full bank details by email.</p>`,
  });

  const html = renderBrandedEmail({
    preheader: `${subject} — ${statusLabel}`,
    eyebrow: "Direct Debit update",
    reference: p.mandate_reference || undefined,
    greeting: p.customer_name ? `Hello ${p.customer_name}` : "Hello",
    intro: `Your OCCTA Direct Debit is now marked as <strong>${esc(statusLabel)}</strong>${
      providerName ? ` with ${esc(providerName)}` : ""
    }.`,
    sections,
  });

  const text = [
    subject,
    "",
    p.customer_name ? `Hello ${p.customer_name},` : "Hello,",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    nextSteps(p).replace(/<[^>]+>/g, ""),
    "",
    showNotice
      ? `${p.provider_collection_name || providerName} (or OCCTA Ltd) will notify you at least ${notice} working days in advance of any collection, unless otherwise agreed.`
      : "",
    "",
    `Need help? Call ${DD_SUPPORT_PHONE} or email ${DD_SUPPORT_EMAIL}.`,
    "OCCTA Limited · Company No. 13828933",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function ddSubject(status: string): string {
  switch (status) {
    case "submitted_to_provider":
      return "Your OCCTA Direct Debit instruction has been submitted";
    case "active":
      return "Your OCCTA Direct Debit is now active";
    case "action_required":
      return "Action needed for your OCCTA Direct Debit";
    case "rejected":
    case "failed":
      return "Your OCCTA Direct Debit instruction was not accepted";
    case "cancelled":
      return "Your OCCTA Direct Debit has been cancelled";
    default:
      return "Update to your OCCTA Direct Debit";
  }
}