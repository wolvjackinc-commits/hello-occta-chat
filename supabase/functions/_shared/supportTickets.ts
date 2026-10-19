import {
  brutalistEmailShell,
  escapeHtml,
  getAdminNotificationEmail,
  sendTrackedCommunication,
} from "./quoteHelpers.ts";

export type CreateSupportTicketInput = {
  userId: string;
  registeredEmail: string | null;
  name: string;
  phone?: string | null;
  ip?: string | null;
  subject: string;
  message: string;
  category: string;
  priority: string;
  channel?: string;
  relatedOrderId?: string | null;
  relatedInvoiceId?: string | null;
  relatedQuoteId?: string | null;
};

export type CreateSupportTicketResult =
  | { ok: true; ticketId: string; customerEmailSent: boolean }
  | { ok: false; error: string };

// Creates support_tickets + communication_thread + initial inbound
// communication_message, then sends a customer acknowledgement and an internal
// support notification. Callers must have already established who the customer is.
export async function createSupportTicket(svc: any, input: CreateSupportTicketInput): Promise<CreateSupportTicketResult> {
  const { userId, registeredEmail, name, subject, message, category, priority } = input;
  const channel = input.channel ?? "web_form";

  const insert: Record<string, unknown> = {
    user_id: userId,
    subject,
    description: message,
    category,
    priority,
    status: "open",
  };
  if (input.relatedOrderId) insert.related_order_id = input.relatedOrderId;
  if (input.relatedInvoiceId) insert.related_invoice_id = input.relatedInvoiceId;
  if (input.relatedQuoteId) insert.related_quote_id = input.relatedQuoteId;

  const { data: ticket, error } = await svc.from("support_tickets").insert(insert).select("id").single();
  if (error || !ticket) return { ok: false, error: "create_failed" };

  const { data: thread } = await svc.from("communication_threads").insert({
    customer_id: userId,
    subject: `Ticket: ${subject}`,
    channel,
    status: "open",
    related_ticket_id: ticket.id,
    related_order_id: input.relatedOrderId ?? null,
    related_invoice_id: input.relatedInvoiceId ?? null,
    related_quote_id: input.relatedQuoteId ?? null,
  }).select("id").single();

  if (thread?.id) {
    await svc.from("communication_messages").insert({
      thread_id: thread.id,
      direction: "inbound",
      channel,
      sender_type: "customer",
      sender_id: userId,
      subject,
      body: message,
      metadata_json: { name, phone: input.phone ?? null, ip: input.ip ?? null },
    });
  }

  await svc.rpc("log_event", {
    _actor_type: "customer",
    _event_type: "support_ticket_created",
    _title: "Support ticket created",
    _source_module: "support",
    _details: { ticket_id: ticket.id, category, priority, channel },
    _ticket_id: ticket.id,
  });

  let customerEmailSent = false;
  if (registeredEmail) {
    try {
      const customerSubject = `We've received your support request — ${subject}`;
      const customerHtml = brutalistEmailShell(
        "Support request received",
        `<p>Hi ${escapeHtml(name || "there")},</p><p>We've received your support request about <strong>${escapeHtml(subject)}</strong> and created a ticket for our team.</p><p>You can follow replies and updates from your OCCTA dashboard. If you reply to a support email, keep the same subject so we can match your response to the ticket.</p>`,
        { label: "Open support dashboard", url: "https://www.occta.co.uk/dashboard" },
      );
      const result = await sendTrackedCommunication(svc, {
        template_name: "support_ticket_customer_acknowledgement",
        recipient_email: registeredEmail,
        subject: customerSubject,
        html: customerHtml,
        user_id: userId,
        replyTo: "support@occta.co.uk",
        metadata: { ticket_id: ticket.id, category, priority },
      });
      customerEmailSent = result.ok;
      if (!result.ok) console.error("support ticket acknowledgement failed", result.error);
    } catch (e) {
      console.error("support ticket acknowledgement exception", (e as Error)?.message ?? String(e));
    }
  }

  // Internal alert contains only routing information; the support team reads
  // the customer's full message in the protected ticket system.
  try {
    const adminEmail = (Deno.env.get("SUPPORT_NOTIFY_EMAIL") || getAdminNotificationEmail()).trim();
    const internalSubject = `New support ticket — ${subject}`;
    const internalHtml = brutalistEmailShell(
      "New support ticket",
      `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p><p><strong>Category:</strong> ${escapeHtml(category)}<br/><strong>Priority:</strong> ${escapeHtml(priority)}</p><p><strong>Ticket ID:</strong> ${escapeHtml(ticket.id)}</p><p>Open the admin support queue to review the customer's message and respond.</p>`,
      { label: "Open admin support", url: "https://www.occta.co.uk/admin/support" },
    );
    const result = await sendTrackedCommunication(svc, {
      template_name: "support_ticket_admin_notification",
      recipient_email: adminEmail,
      subject: internalSubject,
      html: internalHtml,
      metadata: { ticket_id: ticket.id, category, priority },
    });
    if (!result.ok) console.error("support ticket admin notification failed", result.error);
  } catch (e) {
    console.error("support ticket admin notification exception", (e as Error)?.message ?? String(e));
  }

  return { ok: true, ticketId: ticket.id, customerEmailSent };
}
