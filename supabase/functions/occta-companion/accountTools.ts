// Account tools for Ollie. Every tool is bound to the server-verified customer
// scope: the model never chooses whose data it reads, and any id it passes
// (invoice number, ticket id) is re-checked against that customer.
//
// Access levels:
// - signed in: full self-service (billing, payments, tickets, ticket replies)
// - account number + date of birth: orders, services and a masked overview only
// Internal staff notes (profiles.admin_notes, ticket_internal_notes) are never exposed.

import type Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import { maskAccountNumber, maskEmail, maskPhone } from "../_shared/companionCore.ts";

export type CustomerScope = {
  userId: string | null;
  accountNumber: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  signedIn: boolean;
};

export type OrdersResult = {
  canonical: any[];
  guest: any[];
  failed: boolean;
};

export type AccountToolkit = {
  tools: Anthropic.Beta.BetaToolUnion[];
  context: string;
  run: (name: string, input: Record<string, unknown>) => Promise<string>;
};

type ToolDeps = {
  loadOrders: (serviceClient: any, scope: CustomerScope) => Promise<OrdersResult>;
  authorization: string | null;
};

const TICKET_CATEGORIES = ["broadband", "billing", "payments", "mobile", "landline", "account", "complaint", "other"];

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): Anthropic.Beta.BetaToolUnion {
  return {
    name,
    description,
    input_schema: { type: "object", properties, required, additionalProperties: false },
    strict: true,
  };
}

const VERIFIED_TOOLS = [
  tool("get_account_overview", "The verified customer's account details: name, contact details, account number and address."),
  tool("list_orders", "The customer's orders with status and activation dates."),
  tool("list_services", "The customer's services: plan, status, monthly price, activation, contract and minimum term, notice period, next billing date and service address."),
];

const SIGNED_IN_TOOLS = [
  tool("list_invoices", "The customer's 12 most recent invoices with status, dates, billing period, totals, amount paid and credits."),
  tool(
    "get_invoice",
    "Full detail for one invoice: every line item, VAT, pro-rata detail, payments received and credit notes. Use this to explain a bill line by line.",
    { invoice_number: { type: "string", description: "Invoice number exactly as shown by list_invoices" } },
    ["invoice_number"],
  ),
  tool("get_payment_setup", "Direct Debit mandate status (masked bank details only) and any outstanding payment requests."),
  tool("list_support_tickets", "The customer's support tickets with status and dates."),
  tool(
    "get_support_ticket",
    "One support ticket with its description and the full customer-visible conversation, including OCCTA staff replies.",
    { ticket_id: { type: "string", description: "Ticket id or its 8-character reference from list_support_tickets" } },
    ["ticket_id"],
  ),
  tool(
    "create_support_ticket",
    "Raise a support ticket for the OCCTA team. Only call after the customer has agreed. Write a complete summary so the team never needs to ask the customer to repeat anything.",
    {
      subject: { type: "string", description: "Short summary, 5-100 characters" },
      description: { type: "string", description: "Full detail of the issue, what was checked and what the customer wants, 20-2000 characters. No bank or card numbers." },
      category: { type: "string", enum: TICKET_CATEGORIES },
      priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
    },
    ["subject", "description", "category", "priority"],
  ),
  tool(
    "reply_to_support_ticket",
    "Add the customer's message to one of their existing tickets so the OCCTA team sees it. Only call after the customer has agreed to the wording.",
    {
      ticket_id: { type: "string", description: "Ticket id or its 8-character reference" },
      message: { type: "string", description: "The message to add, written for the customer" },
    },
    ["ticket_id", "message"],
  ),
];

function json(value: unknown): string {
  return JSON.stringify(value);
}

function ticketRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function sumBy(rows: any[], invoiceId: string, field = "amount"): number {
  return Math.round(rows.filter((row) => row.invoice_id === invoiceId)
    .reduce((total, row) => total + Number(row[field] ?? 0), 0) * 100) / 100;
}

async function findTicket(serviceClient: any, userId: string, ticketId: string) {
  const needle = ticketId.trim().toLowerCase();
  if (!/^[0-9a-f-]{8,36}$/.test(needle)) return null;
  const { data } = await serviceClient
    .from("support_tickets")
    .select("id, subject, description, status, priority, category, created_at, updated_at, closed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).find((row: any) => String(row.id).toLowerCase().startsWith(needle)) ?? null;
}

export function createAccountToolkit(serviceClient: any, scope: CustomerScope, deps: ToolDeps): AccountToolkit {
  const fullAccess = scope.signedIn && Boolean(scope.userId);
  const userId = scope.userId;

  const run = async (name: string, input: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case "get_account_overview": {
        if (!fullAccess) {
          return json({
            access: "verified by account number and date of birth",
            name: scope.fullName,
            account_number: maskAccountNumber(scope.accountNumber),
            email: maskEmail(scope.email),
            phone: maskPhone(scope.phone),
          });
        }
        const { data: profile, error } = await serviceClient
          .from("profiles")
          .select("full_name, email, phone, account_number, account_type, address_line1, address_line2, city, postcode, business_company_name, created_at")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw new Error("account_unavailable");
        return json({ access: "signed in", ...(profile ?? {}) });
      }

      case "list_orders": {
        const { canonical, guest, failed } = await deps.loadOrders(serviceClient, scope);
        if (failed) throw new Error("orders_unavailable");
        return json({
          orders: [
            ...canonical.map((order: any) => ({
              reference: order.occta_order_number ?? order.id,
              plan: order.plan_name ?? order.service_type,
              status: order.lifecycle_status ?? order.status,
              placed: order.created_at,
              expected_activation: order.expected_activation_date,
              activated: order.actual_activation_date,
            })),
            ...guest.map((order: any) => ({
              reference: order.order_number ?? order.id,
              plan: order.plan_name ?? order.service_type,
              status: order.status,
              placed: order.created_at,
              monthly_price: order.plan_price,
            })),
          ],
        });
      }

      case "list_services": {
        const columns = "service_type, plan_name, status, price_monthly, activation_date, actual_activation_date, contract_type, minimum_term_months, minimum_term_end_date, notice_period_days, next_billing_date, service_address, suspension_reason, selected_addons";
        let query = serviceClient.from("services").select(columns).is("archived_at", null);
        if (userId) query = query.eq("user_id", userId);
        else if (scope.accountNumber) query = query.eq("identifiers->>account_number", scope.accountNumber);
        else return json({ services: [] });
        const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
        if (error) throw new Error("services_unavailable");
        return json({ currency: "GBP", services: data ?? [] });
      }
    }

    if (!fullAccess || !userId) {
      return json({ error: "sign_in_required", message: "Billing, payments and tickets need the customer to sign in at /auth." });
    }

    switch (name) {
      case "list_invoices": {
        const { data: invoices, error } = await serviceClient
          .from("invoices")
          .select("id, invoice_number, invoice_type, status, issue_date, due_date, billing_period_start, billing_period_end, subtotal, vat_total, total, late_fee_amount, currency")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(12);
        if (error) throw new Error("billing_unavailable");
        const ids = (invoices ?? []).map((row: any) => row.id);
        const [receipts, credits] = ids.length
          ? await Promise.all([
            serviceClient.from("receipts").select("invoice_id, amount").in("invoice_id", ids),
            serviceClient.from("credit_notes").select("invoice_id, amount").in("invoice_id", ids),
          ])
          : [{ data: [] }, { data: [] }];
        return json({
          note: "status is authoritative for whether an invoice is paid",
          invoices: (invoices ?? []).map(({ id, ...invoice }: any) => ({
            ...invoice,
            paid_total: sumBy(receipts.data ?? [], id),
            credited_total: sumBy(credits.data ?? [], id),
          })),
        });
      }

      case "get_invoice": {
        const number = String(input.invoice_number ?? "").trim();
        if (!number) return json({ error: "invoice_number_required" });
        const { data: invoice, error } = await serviceClient
          .from("invoices")
          .select("id, invoice_number, invoice_type, status, issue_date, due_date, billing_period_start, billing_period_end, subtotal, vat_rate, vat_total, total, late_fee_amount, pro_rata, currency")
          .eq("user_id", userId)
          .ilike("invoice_number", number.replace(/[\\%_]/g, "\\$&"))
          .maybeSingle();
        if (error) throw new Error("billing_unavailable");
        if (!invoice) return json({ error: "invoice_not_found" });
        const [lines, receipts, credits] = await Promise.all([
          serviceClient.from("invoice_lines").select("description, qty, unit_price, vat_rate, line_total").eq("invoice_id", invoice.id).order("created_at"),
          serviceClient.from("receipts").select("amount, paid_at, method").eq("invoice_id", invoice.id).order("paid_at"),
          serviceClient.from("credit_notes").select("amount, reason, created_at").eq("invoice_id", invoice.id).order("created_at"),
        ]);
        const { id: _id, ...detail } = invoice;
        return json({ ...detail, lines: lines.data ?? [], payments: receipts.data ?? [], credit_notes: credits.data ?? [] });
      }

      case "get_payment_setup": {
        const [mandates, requests] = await Promise.all([
          serviceClient
            .from("dd_mandates")
            .select("status, provider, masked_account_last4, bank_last4, masked_sort_last2, mandate_reference, created_at, updated_at")
            .eq("user_id", userId)
            .eq("is_test", false)
            .order("created_at", { ascending: false })
            .limit(3),
          serviceClient
            .from("payment_requests")
            .select("payment_request_number, type, amount, currency, status, due_date, created_at, paid_at")
            .eq("user_id", userId)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        if (mandates.error || requests.error) throw new Error("payments_unavailable");
        return json({
          direct_debit_mandates: (mandates.data ?? []).map((row: any) => ({
            status: row.status,
            provider: row.provider,
            account_ending: row.masked_account_last4 ?? row.bank_last4,
            sort_code_ending: row.masked_sort_last2,
            reference: row.mandate_reference,
            created: row.created_at,
            updated: row.updated_at,
          })),
          payment_requests: requests.data ?? [],
          self_service: { set_up_direct_debit: "/dd/setup", pay_an_invoice: "/pay-invoice" },
        });
      }

      case "list_support_tickets": {
        const { data, error } = await serviceClient
          .from("support_tickets")
          .select("id, subject, status, priority, category, created_at, updated_at, closed_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw new Error("tickets_unavailable");
        return json({ tickets: (data ?? []).map((row: any) => ({ ...row, reference: ticketRef(row.id) })) });
      }

      case "get_support_ticket": {
        const ticket = await findTicket(serviceClient, userId, String(input.ticket_id ?? ""));
        if (!ticket) return json({ error: "ticket_not_found" });
        const { data: messages, error } = await serviceClient
          .from("ticket_messages")
          .select("message, is_staff_reply, sender_role, created_at")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: true })
          .limit(30);
        if (error) throw new Error("tickets_unavailable");
        return json({
          ...ticket,
          reference: ticketRef(ticket.id),
          conversation: (messages ?? []).map((row: any) => ({
            from: row.is_staff_reply ? "OCCTA team" : "customer",
            message: row.message,
            at: row.created_at,
          })),
        });
      }

      case "create_support_ticket": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (!supabaseUrl || !anonKey || !deps.authorization) throw new Error("ticket_service_unavailable");
        const category = TICKET_CATEGORIES.includes(String(input.category)) ? String(input.category) : "other";
        const response = await fetch(`${supabaseUrl}/functions/v1/submit-support-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: deps.authorization },
          body: JSON.stringify({
            name: scope.fullName ?? "",
            subject: String(input.subject ?? "").slice(0, 100),
            message: String(input.description ?? "").slice(0, 2000),
            category,
            priority: String(input.priority ?? "normal"),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ticket_id) {
          return json({ error: payload?.error ?? "ticket_create_failed" });
        }
        return json({
          created: true,
          reference: ticketRef(payload.ticket_id),
          acknowledgement_email_sent: Boolean(payload.customer_email_sent),
        });
      }

      case "reply_to_support_ticket": {
        const ticket = await findTicket(serviceClient, userId, String(input.ticket_id ?? ""));
        if (!ticket) return json({ error: "ticket_not_found" });
        const message = String(input.message ?? "").trim().slice(0, 5000);
        if (!message) return json({ error: "message_required" });
        if (/\b(?:\d[ -]?){13,19}\b/.test(message)) return json({ error: "sensitive_data_not_allowed" });
        const { error } = await serviceClient.from("ticket_messages").insert({
          ticket_id: ticket.id,
          user_id: userId,
          message,
          is_staff_reply: false,
          sender_role: "customer",
        });
        if (error) throw new Error("ticket_reply_failed");
        await serviceClient.from("support_tickets")
          .update({ status: "waiting_occta", updated_at: new Date().toISOString() })
          .eq("id", ticket.id);
        await serviceClient.rpc("log_event", {
          _actor_type: "customer",
          _event_type: "support_response_sent",
          _title: "Customer replied to ticket via Ollie",
          _source_module: "support",
          _details: { ticket_id: ticket.id, channel: "ollie" },
          _ticket_id: ticket.id,
        });
        return json({ added: true, reference: ticketRef(ticket.id) });
      }
    }

    return json({ error: "unknown_tool" });
  };

  return {
    tools: fullAccess ? [...VERIFIED_TOOLS, ...SIGNED_IN_TOOLS] : VERIFIED_TOOLS,
    context: fullAccess
      ? `Identity verified: signed in${scope.fullName ? ` as ${scope.fullName}` : ""}. You have full self-service access to this customer's account through your account tools. Look things up before answering; never guess account facts.`
      : `Identity verified by account number and date of birth${scope.fullName ? ` (${scope.fullName})` : ""}. You can see orders, services and a masked overview. Invoices, payments and tickets need the customer to sign in at /auth.`,
    run,
  };
}
