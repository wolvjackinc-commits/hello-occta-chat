import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { redact, safeJson, containsForbiddenContent } from "../_shared/aiSafety.ts";

// CORS headers (public web app calls)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getCorsHeaders = (_origin: string | null) => corsHeaders;

// Rate limit configuration
const VERIFICATION_RATE_LIMIT = 5; // Max attempts
const VERIFICATION_WINDOW_MINUTES = 15; // 15 minutes window

// Database-based rate limiting for verification attempts (persistent across cold starts)
async function checkVerificationRateLimitDb(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  identifier: string
): Promise<boolean> {
  try {
    // Use the database check_rate_limit function for persistent rate limiting
    const { data, error } = await supabase.rpc('check_rate_limit', {
      _action: 'ai_chat_verification',
      _identifier: identifier,
      _max_requests: VERIFICATION_RATE_LIMIT,
      _window_minutes: VERIFICATION_WINDOW_MINUTES
    });
    
    if (error) {
      console.error('Rate limit check error:', error);
      // Fall back to allowing the request if rate limit check fails
      return true;
    }
    
    // data is true if request is allowed, false if rate limited
    return data === true;
  } catch (err) {
    console.error('Rate limit exception:', err);
    return true; // Fail open to not break functionality
  }
}


// Business knowledge base
const businessInfo = {
  company: "OCCTA Telecom",
  phone: "0800 260 6626",
  email: "hello@occta.co.uk",
  services: ["Broadband", "SIM/Mobile Plans", "Landline"],
  features: [
    "No contracts - cancel anytime",
    "24/7 UK-based support",
    "Free installation",
    "Competitive pricing (£1-2 cheaper than market average)",
  ],
  broadbandPlans: [
    { name: "ESSENTIAL", speed: "36Mbps", price: "£22.99/mo", description: "Perfect for light browsing" },
    { name: "SUPERFAST", speed: "150Mbps", price: "£26.99/mo", description: "For households that use internet properly", popular: true },
    { name: "ULTRAFAST", speed: "500Mbps", price: "£38.99/mo", description: "For gamers, streamers, WFH" },
    { name: "GIGABIT", speed: "900Mbps", price: "£52.99/mo", description: "The fastest internet" },
  ],
  simPlans: [
    { name: "Starter", data: "5GB", price: "£7.99/mo", description: "For light users" },
    { name: "Essential", data: "15GB", price: "£11.99/mo", description: "Perfect for everyday use" },
    { name: "Plus", data: "50GB", price: "£17.99/mo", description: "For social media enthusiasts", popular: true },
    { name: "Unlimited", data: "Unlimited", price: "£27.99/mo", description: "Never worry about data again" },
  ],
  landlinePlans: [
    { name: "Pay As You Go", price: "£7.99/mo", callRate: "8p/min" },
    { name: "Evening & Weekend", price: "£12.99/mo", callRate: "Free evenings" },
    { name: "Anytime", price: "£17.99/mo", callRate: "Always free", popular: true },
    { name: "International", price: "£26.99/mo", callRate: "300 mins to 50+ countries" },
  ],
  bundleDiscounts: "10% off for 2 services, 15% off for 3+ services",
  faqs: [
    { q: "How do I check my broadband speed?", a: "Use speedtest.net or our app. Test with ethernet for accurate results." },
    { q: "Can I keep my phone number?", a: "Yes! For mobile, text 'PAC' to 65075. For landlines, we handle the transfer." },
    { q: "What happens if I go over my data limit?", a: "No extra charges - just speed reduction to 1Mbps until next billing date." },
    { q: "How do I cancel?", a: "Log in to dashboard or call us. 30 days notice, no exit fees on rolling contracts." },
  ],
};

const formatMoney = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return `£${amount.toFixed(2)}`;
};

const formatDate = (value: unknown) => {
  if (!value || typeof value !== "string") return "not set yet";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const withOptions = (body: string, options: string[]) =>
  `${body.trim()}\n\nWhat next?\n<<<OPTIONS:${JSON.stringify(options.slice(0, 4))}>>>`;

function wantsAccountData(message: string) {
  const lower = message.toLowerCase();
  if (/\b(invoice|invoices|bill|billing|payment|receipt|paid|unpaid)\b/.test(lower)) return "invoices";
  if (/\b(order tracking|track order|installation|activation|appointment|engineer)\b/.test(lower)) return "tracking";
  if (/\b(order|orders)\b/.test(lower)) return "orders";
  if (/\b(service|services|broadband line|sim|landline)\b/.test(lower)) return "services";
  if (/\b(ticket|tickets|case|support request|complaint)\b/.test(lower)) return "tickets";
  if (/\b(my account|account details|profile|details)\b/.test(lower)) return "overview";
  return null;
}

async function buildSignedInAccountReply(
  // deno-lint-ignore no-explicit-any
  supabaseServiceClient: any,
  userId: string,
  message: string,
): Promise<string | null> {
  const intent = wantsAccountData(message);
  if (!intent) return null;

  const { data: profile } = await supabaseServiceClient
    .from("profiles")
    .select("id, full_name, email, account_number, phone, created_at")
    .eq("id", userId)
    .maybeSingle();

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const { data: ordersRaw } = await supabaseServiceClient
    .from("orders")
    .select("id, occta_order_number, status, lifecycle_status, plan_name, service_type, plan_price, created_at, expected_activation_date, actual_activation_date")
    .or(`user_id.eq.${userId},customer_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(10);

  const orderIds = (ordersRaw ?? []).map((order: { id?: string }) => order.id).filter(Boolean);

  const [{ data: guestOrdersRaw }, { data: invoicesByUser }, { data: servicesByUser }, { data: ticketsRaw }] = await Promise.all([
    supabaseServiceClient
      .from("guest_orders")
      .select("id, order_number, account_number, status, plan_name, service_type, plan_price, created_at")
      .or(`user_id.eq.${userId}${profile?.email ? `,email.eq.${profile.email}` : ""}`)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServiceClient
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, subtotal, vat_total, total, billing_period_start, billing_period_end, order_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServiceClient
      .from("services")
      .select("id, service_type, plan_name, status, activation_date, actual_activation_date, price_monthly, order_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServiceClient
      .from("support_tickets")
      .select("id, subject, status, priority, category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const [{ data: invoicesByOrder }, { data: servicesByOrder }, { data: contractSummaries }] = await Promise.all([
    orderIds.length
      ? supabaseServiceClient
          .from("invoices")
          .select("id, invoice_number, status, issue_date, due_date, subtotal, vat_total, total, billing_period_start, billing_period_end, order_id")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabaseServiceClient
          .from("services")
          .select("id, service_type, plan_name, status, activation_date, actual_activation_date, price_monthly, order_id")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabaseServiceClient
      .from("contract_summaries")
      .select("cs_number, status, plan_name, service_type, monthly_price_incl_vat, accepted_at, created_at, account_number")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const invoices = [...(invoicesByUser ?? []), ...(invoicesByOrder ?? [])].filter(
    (invoice, index, all) => all.findIndex((item) => item.id === invoice.id) === index,
  );
  const services = [...(servicesByUser ?? []), ...(servicesByOrder ?? [])].filter(
    (service, index, all) => all.findIndex((item) => item.id === service.id) === index,
  );
  const orders = ordersRaw ?? [];
  const guestOrders = guestOrdersRaw ?? [];

  if (intent === "invoices") {
    if (invoices.length === 0) {
      const latestOrder = orders[0] ?? guestOrders[0];
      const orderLine = latestOrder
        ? ` Your latest order is ${latestOrder.occta_order_number ?? latestOrder.order_number ?? "on file"} for ${latestOrder.plan_name ?? "your service"}, currently ${latestOrder.lifecycle_status ?? latestOrder.status ?? "in progress"}.`
        : "";
      return withOptions(
        `Hi ${firstName} — I checked your account and there are no invoices available yet.${orderLine} As soon as an invoice is generated, it will appear in your dashboard and I can explain it here.`,
        ["Check my orders", "Check my services", "Raise a ticket"],
      );
    }
    const lines = invoices.slice(0, 5).map((invoice) =>
      `• ${invoice.invoice_number}: ${formatMoney(invoice.total)} — ${invoice.status} — due ${formatDate(invoice.due_date)}`,
    );
    return withOptions(
      `Hi ${firstName} — here are your latest invoices:\n${lines.join("\n")}`,
      ["Explain latest invoice", "Check my orders", "Raise a billing ticket"],
    );
  }

  if (intent === "orders" || intent === "tracking") {
    const combined = [
      ...orders.map((order) => ({ ref: order.occta_order_number ?? order.id, ...order })),
      ...guestOrders.map((order) => ({ ref: order.order_number, ...order })),
    ];
    if (combined.length === 0) {
      return withOptions(
        `Hi ${firstName} — I checked your account and I can't see any orders linked to it yet. If you placed an order as a guest, the OCCTA team may need to link it for you.`,
        ["Raise a ticket", "Check my services", "View account details"],
      );
    }
    const lines = combined.slice(0, 5).map((order) => {
      const status = order.lifecycle_status ?? order.status ?? "in progress";
      const activation = order.actual_activation_date || order.expected_activation_date;
      return `• ${order.ref}: ${order.plan_name ?? "Service order"} — ${status}${activation ? ` — activation ${formatDate(activation)}` : ""}`;
    });
    return withOptions(
      `Hi ${firstName} — here is the order status I found:\n${lines.join("\n")}`,
      ["Check my services", "View my invoices", "Raise a ticket"],
    );
  }

  if (intent === "services") {
    if (services.length === 0) {
      const latestOrder = orders[0] ?? guestOrders[0];
      return withOptions(
        latestOrder
          ? `Hi ${firstName} — I don't see a live service record yet. Your latest order (${latestOrder.occta_order_number ?? latestOrder.order_number ?? "on file"}) is ${latestOrder.lifecycle_status ?? latestOrder.status ?? "in progress"}.`
          : `Hi ${firstName} — I don't see any active services linked to your account yet.`,
        ["Check my orders", "Raise a ticket", "View account details"],
      );
    }
    const lines = services.slice(0, 5).map((service) =>
      `• ${service.plan_name ?? service.service_type}: ${service.status}${service.price_monthly ? ` — ${formatMoney(service.price_monthly)}/mo` : ""}${service.actual_activation_date || service.activation_date ? ` — active from ${formatDate(service.actual_activation_date ?? service.activation_date)}` : ""}`,
    );
    return withOptions(
      `Hi ${firstName} — here are the services linked to your account:\n${lines.join("\n")}`,
      ["Check my orders", "View my invoices", "Raise a ticket"],
    );
  }

  if (intent === "tickets") {
    if ((ticketsRaw ?? []).length === 0) {
      return withOptions(
        `Hi ${firstName} — I checked your account and there are no support tickets open right now.`,
        ["Raise a ticket", "Check my orders", "Check my services"],
      );
    }
    const lines = (ticketsRaw ?? []).slice(0, 5).map((ticket) =>
      `• ${ticket.subject}: ${ticket.status} — ${ticket.priority ?? "normal"} priority — opened ${formatDate(ticket.created_at)}`,
    );
    return withOptions(
      `Hi ${firstName} — here are your recent support tickets:\n${lines.join("\n")}`,
      ["Raise another ticket", "Check my orders", "Check my services"],
    );
  }

  const acceptedSummary = (contractSummaries ?? []).find((summary) => summary.status === "accepted");
  return withOptions(
    `Hi ${firstName} — your account is ${profile?.account_number ?? acceptedSummary?.account_number ?? "linked"}. Email: ${profile?.email ?? "not set"}. Phone: ${profile?.phone ?? "not set"}. ${acceptedSummary ? `Latest accepted contract summary: ${acceptedSummary.cs_number} for ${acceptedSummary.plan_name}.` : "No accepted contract summary is showing yet."}`,
    ["Check my orders", "View my invoices", "Check my services"],
  );
}

// Tools definitions for the AI - includes customer tools and admin tools
const tools = [
  {
    type: "function",
    function: {
      name: "lookup_account",
      description: "Look up a customer's account using their email and date of birth for verification. Use this when the customer wants to view their bills, orders, or account details.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          date_of_birth: { type: "string", description: "Customer's date of birth in YYYY-MM-DD format" },
        },
        required: ["email", "date_of_birth"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_account_by_number",
      description: "Look up a customer's account using their account number (starts with OCC) and date of birth for verification. Use this when the customer wants to view their bills or account details using their account number. Ask for account number first, then date of birth - one at a time.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "Customer's account number (format: OCC followed by 8 digits)" },
          date_of_birth: { type: "string", description: "Customer's date of birth in YYYY-MM-DD format" },
        },
        required: ["account_number", "date_of_birth"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_latest_bill",
      description: "Get the latest bill/invoice details for a verified customer account. Only call this after successful account verification via lookup_account_by_number.",
      parameters: {
        type: "object",
        properties: {
          account_number: { type: "string", description: "Customer's verified account number" },
        },
        required: ["account_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_for_account",
      description: "Get all orders for a verified customer account. Only call this after successful account verification.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's verified email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Create a new support ticket for the customer. Use this when they need help with an issue that can't be resolved immediately.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Brief summary of the issue" },
          description: { type: "string", description: "Detailed description of the issue" },
          category: { 
            type: "string", 
            enum: ["broadband", "mobile", "landline", "billing", "payments", "account"],
            description: "Category of the issue" 
          },
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level of the ticket" 
          },
        },
        required: ["subject", "description", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_plans",
      description: "Compare plans within a service type to help customers choose the best option.",
      parameters: {
        type: "object",
        properties: {
          service_type: { 
            type: "string", 
            enum: ["broadband", "sim", "landline"],
            description: "Type of service to compare" 
          },
          usage_needs: { 
            type: "string", 
            description: "Customer's usage needs (e.g., 'light browsing', 'gaming', 'work from home')" 
          },
        },
        required: ["service_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_bundle_price",
      description: "Calculate the total price for a bundle of services with applicable discounts.",
      parameters: {
        type: "object",
        properties: {
          broadband_plan: { type: "string", description: "Name of broadband plan (optional)" },
          sim_plan: { type: "string", description: "Name of SIM plan (optional)" },
          landline_plan: { type: "string", description: "Name of landline plan (optional)" },
        },
        required: [],
      },
    },
  },
];

// Admin-only tools - only provided when user is an admin
const adminTools = [
  {
    type: "function",
    function: {
      name: "admin_search_customer",
      description: "ADMIN ONLY: Search for a customer by account number, email, or name. No DOB verification required for admins.",
      parameters: {
        type: "object",
        properties: {
          search_term: { type: "string", description: "Account number (OCC...), email, or customer name to search" },
          search_type: { 
            type: "string", 
            enum: ["account_number", "email", "name"],
            description: "Type of search to perform" 
          },
        },
        required: ["search_term", "search_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_get_customer_services",
      description: "ADMIN ONLY: Get all services for a customer by their user ID or account number.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Customer's user ID or account number" },
        },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_get_customer_invoices",
      description: "ADMIN ONLY: Get all invoices for a customer.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Customer's user ID, email, or account number" },
          limit: { type: "number", description: "Maximum number of invoices to return (default 10)" },
        },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_get_open_tickets",
      description: "ADMIN ONLY: Get all open support tickets, optionally filtered by category or priority.",
      parameters: {
        type: "object",
        properties: {
          category: { 
            type: "string", 
            enum: ["broadband", "mobile", "landline", "billing", "payments", "account"],
            description: "Filter by category (optional)" 
          },
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high", "urgent"],
            description: "Filter by priority (optional)" 
          },
          limit: { type: "number", description: "Maximum number of tickets to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_get_system_stats",
      description: "ADMIN ONLY: Get system statistics like total customers, active services, open tickets, and recent orders.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// === New customer-side tools (require verified userId via JWT) ===
const customerAuthedTools = [
  {
    type: "function",
    function: {
      name: "get_my_overview",
      description: "Get the signed-in customer's account overview (profile, account number, latest service status). Requires authenticated user.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_invoices_authed",
      description: "List the signed-in customer's recent invoices and payment status. Requires authenticated user.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Max invoices to return (default 5)" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_services_authed",
      description: "List the signed-in customer's active services (plan, speed, status, install date). Requires authenticated user.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_orders_authed",
      description: "List the signed-in customer's orders and lifecycle status. Requires authenticated user.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Max orders to return (default 5)" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_documents",
      description: "List the signed-in customer's documents (accepted Contract Summaries, receipts) as metadata only. Does NOT expose storage keys.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_tickets",
      description: "List the signed-in customer's recent support tickets.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_my_invoice",
      description: "Fetch one invoice belonging to the signed-in customer for plain-English explanation. Pass invoice_number (e.g. INV-1234).",
      parameters: {
        type: "object",
        properties: { invoice_number: { type: "string" } },
        required: ["invoice_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_team",
      description: "Create a support case for the OCCTA team when you cannot safely complete the customer's request, when identity/billing data conflicts, or when policy requires human review. Returns an escalation card with the ticket reference.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Short summary, max 200 chars" },
          summary: { type: "string", description: "What the customer wants, what you already checked, what info is missing, recommended next step." },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          category: { type: "string", enum: ["broadband", "mobile", "landline", "billing", "payments", "account"] },
        },
        required: ["subject", "summary"],
      },
    },
  },
];

// === New admin copilot tools (read-only summaries + draft + prepare confirmation cards) ===
const adminCopilotTools = [
  {
    type: "function",
    function: {
      name: "admin_customer_360",
      description: "ADMIN ONLY: Return a redacted Customer 360 summary (profile, account, services, latest invoices, open tickets, latest order status).",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "user_id, account number (OCC...) or email" } },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_order_blockers",
      description: "ADMIN ONLY: List the current blockers / missing items for an order's provisioning readiness.",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_draft_reply",
      description: "ADMIN ONLY: Draft a customer-facing reply text for staff to review. Returns the draft only — does NOT send anything.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "What the reply should cover (billing question, cancellation, etc.)" },
          tone: { type: "string", enum: ["professional", "warm", "firm"], description: "Tone of reply" },
          customer_first_name: { type: "string" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_prepare_action",
      description: "ADMIN ONLY: Prepare a high-risk admin action as a confirmation card. Does NOT execute. Staff must click Confirm in the UI for the action to run through the existing safe endpoints.",
      parameters: {
        type: "object",
        properties: {
          action_type: {
            type: "string",
            enum: [
              "confirm_service_live",
              "mark_payment_received",
              "cancel_service",
              "lifecycle_transition",
              "create_admin_task",
              "create_internal_note",
            ],
          },
          target_id: { type: "string", description: "Order / service / customer / invoice ID the action applies to" },
          summary: { type: "string", description: "One-sentence human-readable summary for the confirmation card" },
          details: { type: "object", description: "Optional structured payload (e.g. { go_live_date, reason })", additionalProperties: true },
        },
        required: ["action_type", "target_id", "summary"],
      },
    },
  },
];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  date_of_birth: string | null;
}

interface GuestOrder {
  order_number: string;
  plan_name: string;
  plan_price: number;
  service_type: string;
  status: string;
  created_at: string;
  account_number: string | null;
  full_name: string;
  email: string;
  selected_addons: unknown;
}

interface SupportTicket {
  id: string;
}

// Tool execution functions - uses separate clients based on security needs
// deno-lint-ignore no-explicit-any
async function executeTool(
  toolName: string, 
  args: Record<string, unknown>, 
  supabaseServiceClient: any,
  supabaseAnonClient: any,
  userId?: string,
  isAdmin?: boolean
): Promise<string> {
  switch (toolName) {
    case "lookup_account": {
      const { email, date_of_birth } = args as { email: string; date_of_birth: string };
      
      // Validate inputs
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return JSON.stringify({ success: false, message: "Please provide a valid email address." });
      }
      
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(date_of_birth)) {
        return JSON.stringify({ success: false, message: "Please provide your date of birth in YYYY-MM-DD format." });
      }
      
      // Rate limit check using database function (persistent across cold starts)
      const rateLimitKey = `email:${email.toLowerCase()}`;
      const isAllowed = await checkVerificationRateLimitDb(supabaseServiceClient, rateLimitKey);
      if (!isAllowed) {
        console.log(`SECURITY: Rate limit exceeded for email verification: ${email}`);
        return JSON.stringify({ 
          success: false, 
          message: "Too many verification attempts. Please wait 15 minutes or call us at 0800 260 6626." 
        });
      }
      
      // Use service role ONLY for verification query (necessary to check DOB without RLS)
      console.log(`AUDIT: Account lookup attempt for email: ${email.substring(0, 3)}***`);
      
      const { data, error } = await supabaseServiceClient
        .from("profiles")
        .select("id, email, full_name, date_of_birth")
        .eq("email", email.toLowerCase())
        .single();
      
      const profile = data as Profile | null;
      
      if (error || !profile) {
        console.log(`AUDIT: Account lookup failed - no profile found for email`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to verify account. Please check your email and date of birth are correct." 
        });
      }
      
      // Verify DOB matches
      if (profile.date_of_birth !== date_of_birth) {
        console.log(`AUDIT: DOB mismatch for email verification`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to verify account. Please check your email and date of birth are correct." 
        });
      }
      
      console.log(`AUDIT: Verification successful for email: ${email.substring(0, 3)}***`);
      
      return JSON.stringify({ 
        success: true, 
        message: `Account verified for ${profile.full_name || email}. I can now help you with your orders and account details.`,
        verified_email: email
      });
    }

    case "lookup_account_by_number": {
      const { account_number, date_of_birth } = args as { account_number: string; date_of_birth: string };
      
      // Validate account number format (OCC + 8 digits)
      const accountNumberRegex = /^OCC\d{8}$/i;
      if (!accountNumberRegex.test(account_number)) {
        return JSON.stringify({ 
          success: false, 
          message: "Invalid account number format. Account numbers start with OCC followed by 8 digits (e.g., OCC12345678)." 
        });
      }
      
      // Validate date of birth format (YYYY-MM-DD)
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(date_of_birth)) {
        return JSON.stringify({ 
          success: false, 
          message: "Please provide your date of birth in YYYY-MM-DD format (e.g., 1990-01-15)." 
        });
      }
      
      // Rate limit check for account number verification (using database function)
      const rateLimitKey = `account:${account_number.toUpperCase()}`;
      const isAllowed = await checkVerificationRateLimitDb(supabaseServiceClient, rateLimitKey);
      if (!isAllowed) {
        console.log(`SECURITY: Rate limit exceeded for account verification: ${account_number}`);
        return JSON.stringify({ 
          success: false, 
          message: "Too many verification attempts. Please wait 15 minutes or call us at 0800 260 6626." 
        });
      }
      
      console.log(`AUDIT: Account lookup attempt for: ${account_number.toUpperCase()}`);
      
      // Use service role for verification query (necessary to check DOB without RLS)
      const { data: orderData, error: orderError } = await supabaseServiceClient
        .from("guest_orders")
        .select("account_number, full_name, email, status, date_of_birth")
        .eq("account_number", account_number.toUpperCase())
        .eq("status", "active")
        .single();
      
      if (orderError || !orderData) {
        console.log(`AUDIT: Account lookup failed - no active account found`);
        return JSON.stringify({ 
          success: false, 
          message: "Unable to find an active account with that account number. Please check the number and try again." 
        });
      }
      
      // First, try to verify DOB from the guest_orders table directly
      if (orderData.date_of_birth) {
        if (orderData.date_of_birth !== date_of_birth) {
          console.log(`AUDIT: DOB mismatch for account: ${account_number}`);
          return JSON.stringify({ 
            success: false, 
            message: "The date of birth doesn't match our records. Please check and try again." 
          });
        }
        
        console.log(`AUDIT: Verification successful for account: ${account_number}`);
        
        return JSON.stringify({ 
          success: true, 
          message: `Account verified for ${orderData.full_name}! I can now help you with your billing details.`,
          verified_account: account_number.toUpperCase()
        });
      }
      
      // Fallback: verify DOB against the email in profiles
      const { data: profileData, error: profileError } = await supabaseServiceClient
        .from("profiles")
        .select("date_of_birth")
        .eq("email", orderData.email.toLowerCase())
        .single();
      
      // If no profile found and no DOB on order, we cannot verify
      if (profileError || !profileData || !profileData.date_of_birth) {
        console.log(`AUDIT: No DOB found for verification - denying access`);
        return JSON.stringify({ 
          success: false, 
          message: "We cannot verify your identity without a date of birth on file. Please contact support at 0800 260 6626 to update your account details." 
        });
      }
      
      if (profileData.date_of_birth !== date_of_birth) {
        console.log(`AUDIT: DOB mismatch from profiles for account: ${account_number}`);
        return JSON.stringify({ 
          success: false, 
          message: "The date of birth doesn't match our records. Please check and try again." 
        });
      }
      
      console.log(`AUDIT: Verification successful for account: ${account_number}`);
      
      return JSON.stringify({ 
        success: true, 
        message: `Account verified for ${orderData.full_name}! I can now help you with your billing details.`,
        verified_account: account_number.toUpperCase()
      });
    }

    case "get_latest_bill": {
      const { account_number } = args as { account_number: string };
      
      // Validate account number format
      const accountNumberRegex = /^OCC\d{8}$/i;
      if (!accountNumberRegex.test(account_number)) {
        return JSON.stringify({ success: false, message: "Invalid account number format." });
      }
      
      console.log(`AUDIT: Fetching bill for account: ${account_number}`);
      
      // Use service role to fetch billing data (RLS doesn't allow public access to guest_orders)
      // Note: This should only be called after successful verification via lookup_account_by_number
      const { data, error } = await supabaseServiceClient
        .from("guest_orders")
        .select("order_number, plan_name, plan_price, service_type, status, created_at, full_name, email, selected_addons, account_number")
        .eq("account_number", account_number.toUpperCase())
        .eq("status", "active")
        .single();
      
      const order = data as GuestOrder | null;
      
      if (error || !order) {
        return JSON.stringify({ success: false, message: "Unable to retrieve billing details. Please verify your account first." });
      }
      
      // Calculate billing details
      const planPrice = order.plan_price;
      let addonsTotal = 0;
      const addonsList: string[] = [];
      
      if (order.selected_addons && Array.isArray(order.selected_addons)) {
        for (const addon of order.selected_addons as Array<{ name: string; price: number }>) {
          addonsTotal += addon.price;
          addonsList.push(`${addon.name}: £${addon.price.toFixed(2)}/mo`);
        }
      }
      
      const totalMonthly = planPrice + addonsTotal;
      const nextBillDate = new Date();
      nextBillDate.setMonth(nextBillDate.getMonth() + 1);
      nextBillDate.setDate(1);
      
      const billDetails = {
        accountNumber: order.account_number,
        accountHolder: order.full_name,
        plan: order.plan_name,
        planPrice: `£${planPrice.toFixed(2)}/mo`,
        addons: addonsList.length > 0 ? addonsList : ["No add-ons"],
        addonsTotal: `£${addonsTotal.toFixed(2)}/mo`,
        totalMonthly: `£${totalMonthly.toFixed(2)}/mo`,
        nextBillDate: nextBillDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        paymentStatus: "Up to date ✓",
        serviceType: order.service_type.charAt(0).toUpperCase() + order.service_type.slice(1)
      };
      
      return JSON.stringify({ 
        success: true, 
        bill: billDetails,
        message: "Here are your billing details."
      });
    }

    case "get_orders_for_account": {
      const { email } = args as { email: string };
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return JSON.stringify({ success: false, message: "Invalid email format." });
      }
      
      console.log(`AUDIT: Fetching orders for email: ${email.substring(0, 3)}***`);
      
      // Use service role to fetch orders (RLS doesn't allow public access to guest_orders)
      // Note: This should only be called after successful verification via lookup_account
      const { data, error } = await supabaseServiceClient
        .from("guest_orders")
        .select("order_number, plan_name, plan_price, service_type, status, created_at")
        .eq("email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(5);
      
      const orders = data as GuestOrder[] | null;
      
      if (error) {
        return JSON.stringify({ success: false, message: "Unable to retrieve orders." });
      }
      
      if (!orders || orders.length === 0) {
        return JSON.stringify({ success: true, orders: [], message: "No orders found for this account." });
      }
      
      const formattedOrders = orders.map(o => ({
        orderNumber: o.order_number,
        plan: o.plan_name,
        price: `£${o.plan_price}/mo`,
        service: o.service_type,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString('en-GB')
      }));
      
      return JSON.stringify({ success: true, orders: formattedOrders });
    }

    case "create_support_ticket": {
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          message: "You need to be signed in to create a support ticket. Please sign in or call us at 0800 260 6626." 
        });
      }
      
      const { subject, description, category, priority } = args as { 
        subject: string; description: string; category: string; priority?: string 
      };
      
      // Validate inputs
      if (!subject || subject.length < 3 || subject.length > 200) {
        return JSON.stringify({ success: false, message: "Please provide a subject between 3 and 200 characters." });
      }
      if (!description || description.length < 10 || description.length > 2000) {
        return JSON.stringify({ success: false, message: "Please provide a description between 10 and 2000 characters." });
      }
      
      console.log(`AUDIT: Creating support ticket for user: ${userId}`);
      
      // Use anon client for support tickets (RLS allows authenticated users to create their own)
      const { data, error } = await supabaseAnonClient
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority: priority || "medium",
          status: "open",
        })
        .select("id")
        .single();
      
      const ticket = data as SupportTicket | null;
      
      if (error || !ticket) {
        console.log("Support ticket creation failed:", error);
        return JSON.stringify({ success: false, message: "Failed to create ticket. Please try again or call us." });
      }
      
      return JSON.stringify({ 
        success: true, 
        message: `Support ticket created successfully! Ticket reference: ${ticket.id.slice(0, 8).toUpperCase()}. We'll get back to you within 24 hours.` 
      });
    }

    case "compare_plans": {
      const { service_type, usage_needs } = args as { service_type: string; usage_needs?: string };
      
      let plans: Array<{ name: string; price: string; [key: string]: unknown }> = [];
      let recommendation = "";
      
      switch (service_type) {
        case "broadband":
          plans = businessInfo.broadbandPlans;
          if (usage_needs?.toLowerCase().includes("gaming") || usage_needs?.toLowerCase().includes("stream")) {
            recommendation = "Based on your needs, I recommend ULTRAFAST (500Mbps) for smooth gaming and 4K streaming.";
          } else if (usage_needs?.toLowerCase().includes("work") || usage_needs?.toLowerCase().includes("wfh")) {
            recommendation = "For working from home with video calls, SUPERFAST (150Mbps) is perfect and our most popular choice.";
          } else {
            recommendation = "SUPERFAST (150Mbps) is our most popular plan - great value for most households.";
          }
          break;
        case "sim":
          plans = businessInfo.simPlans;
          if (usage_needs?.toLowerCase().includes("social") || usage_needs?.toLowerCase().includes("video")) {
            recommendation = "Plus (50GB) is ideal for social media and video streaming - our most popular SIM plan.";
          } else if (usage_needs?.toLowerCase().includes("light") || usage_needs?.toLowerCase().includes("basic")) {
            recommendation = "Starter (5GB) or Essential (15GB) would suit light usage perfectly.";
          } else {
            recommendation = "Plus (50GB) offers great value for most users.";
          }
          break;
        case "landline":
          plans = businessInfo.landlinePlans;
          recommendation = "Anytime is our most popular landline plan - unlimited UK calls 24/7.";
          break;
      }
      
      return JSON.stringify({ plans, recommendation });
    }

    case "calculate_bundle_price": {
      const { broadband_plan, sim_plan, landline_plan } = args as { 
        broadband_plan?: string; sim_plan?: string; landline_plan?: string 
      };
      
      let total = 0;
      const selectedPlans: Array<{ name: string; price: number; service: string }> = [];
      
      if (broadband_plan) {
        const plan = businessInfo.broadbandPlans.find(p => 
          p.name.toLowerCase() === broadband_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "Broadband" });
        }
      }
      
      if (sim_plan) {
        const plan = businessInfo.simPlans.find(p => 
          p.name.toLowerCase() === sim_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "SIM" });
        }
      }
      
      if (landline_plan) {
        const plan = businessInfo.landlinePlans.find(p => 
          p.name.toLowerCase() === landline_plan.toLowerCase()
        );
        if (plan) {
          const price = parseFloat(plan.price.replace("£", "").replace("/mo", ""));
          total += price;
          selectedPlans.push({ name: plan.name, price, service: "Landline" });
        }
      }
      
      const serviceCount = selectedPlans.length;
      let discount = 0;
      let discountPercentage = 0;
      
      if (serviceCount >= 3) {
        discountPercentage = 15;
      } else if (serviceCount === 2) {
        discountPercentage = 10;
      }
      
      discount = total * (discountPercentage / 100);
      const finalTotal = total - discount;
      
      return JSON.stringify({
        plans: selectedPlans,
        originalTotal: `£${total.toFixed(2)}/mo`,
        discount: discountPercentage > 0 ? `${discountPercentage}% off (saving £${discount.toFixed(2)}/mo)` : "No bundle discount (add more services for savings!)",
        finalTotal: `£${finalTotal.toFixed(2)}/mo`,
      });
    }

    // ADMIN TOOLS
    case "admin_search_customer": {
      const { search_term, search_type } = args as { search_term: string; search_type: string };
      
      console.log(`ADMIN: Searching customer by ${search_type}: ${search_term}`);
      
      let results: unknown[] = [];
      
      if (search_type === "account_number") {
        const { data, error } = await supabaseServiceClient
          .from("guest_orders")
          .select("account_number, full_name, email, phone, status, plan_name, service_type, created_at")
          .ilike("account_number", `%${search_term}%`)
          .limit(10);
        
        if (!error && data) results = data;
      } else if (search_type === "email") {
        // Search both profiles and guest_orders
        const { data: profileData } = await supabaseServiceClient
          .from("profiles")
          .select("id, full_name, email, phone, account_number, created_at")
          .ilike("email", `%${search_term}%`)
          .limit(5);
        
        const { data: guestData } = await supabaseServiceClient
          .from("guest_orders")
          .select("account_number, full_name, email, phone, status, plan_name, service_type, created_at")
          .ilike("email", `%${search_term}%`)
          .limit(5);
        
        results = [...(profileData || []), ...(guestData || [])];
      } else if (search_type === "name") {
        const { data: profileData } = await supabaseServiceClient
          .from("profiles")
          .select("id, full_name, email, phone, account_number, created_at")
          .ilike("full_name", `%${search_term}%`)
          .limit(5);
        
        const { data: guestData } = await supabaseServiceClient
          .from("guest_orders")
          .select("account_number, full_name, email, phone, status, plan_name, service_type, created_at")
          .ilike("full_name", `%${search_term}%`)
          .limit(5);
        
        results = [...(profileData || []), ...(guestData || [])];
      }
      
      if (results.length === 0) {
        return JSON.stringify({ success: false, message: "No customers found matching your search." });
      }
      
      return JSON.stringify({ success: true, customers: results, count: results.length });
    }

    case "admin_get_customer_services": {
      const { identifier } = args as { identifier: string };
      
      console.log(`ADMIN: Getting services for: ${identifier}`);
      
      // Try to find by account number first
      const isAccountNumber = identifier.toUpperCase().startsWith("OCC");
      
      if (isAccountNumber) {
        const { data: orderData } = await supabaseServiceClient
          .from("guest_orders")
          .select("*")
          .eq("account_number", identifier.toUpperCase());
        
        const { data: servicesData } = await supabaseServiceClient
          .from("services")
          .select("*")
          .eq("identifiers->>account_number", identifier.toUpperCase());
        
        return JSON.stringify({ 
          success: true, 
          orders: orderData || [], 
          services: servicesData || [] 
        });
      } else {
        // Assume it's a user ID
        const { data: servicesData } = await supabaseServiceClient
          .from("services")
          .select("*")
          .eq("user_id", identifier);
        
        return JSON.stringify({ success: true, services: servicesData || [] });
      }
    }

    case "admin_get_customer_invoices": {
      const { identifier, limit = 10 } = args as { identifier: string; limit?: number };
      
      console.log(`ADMIN: Getting invoices for: ${identifier}`);
      
      // Find user by email or account number
      let userId: string | null = null;
      
      if (identifier.includes("@")) {
        const { data: profile } = await supabaseServiceClient
          .from("profiles")
          .select("id")
          .eq("email", identifier.toLowerCase())
          .single();
        userId = profile?.id || null;
      } else if (identifier.toUpperCase().startsWith("OCC")) {
        const { data: order } = await supabaseServiceClient
          .from("guest_orders")
          .select("user_id")
          .eq("account_number", identifier.toUpperCase())
          .single();
        userId = order?.user_id || null;
      } else {
        userId = identifier;
      }
      
      if (!userId) {
        return JSON.stringify({ success: false, message: "Customer not found." });
      }
      
      const { data: invoices } = await supabaseServiceClient
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      return JSON.stringify({ success: true, invoices: invoices || [] });
    }

    case "admin_get_open_tickets": {
      const { category, priority, limit = 10 } = args as { category?: string; priority?: string; limit?: number };
      
      console.log(`ADMIN: Getting open tickets`);
      
      let query = supabaseServiceClient
        .from("support_tickets")
        .select("*, profiles(full_name, email)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (category) {
        query = query.eq("category", category);
      }
      if (priority) {
        query = query.eq("priority", priority);
      }
      
      const { data: tickets } = await query;
      
      return JSON.stringify({ 
        success: true, 
        tickets: tickets || [], 
        count: tickets?.length || 0 
      });
    }

    case "admin_get_system_stats": {
      console.log(`ADMIN: Getting system stats`);
      
      const [
        { count: profilesCount },
        { count: servicesCount },
        { count: openTicketsCount },
        { count: ordersCount },
        { count: guestOrdersCount },
      ] = await Promise.all([
        supabaseServiceClient.from("profiles").select("*", { count: "exact", head: true }),
        supabaseServiceClient.from("services").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabaseServiceClient.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabaseServiceClient.from("orders").select("*", { count: "exact", head: true }),
        supabaseServiceClient.from("guest_orders").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      
      // Get recent orders (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: recentOrdersCount } = await supabaseServiceClient
        .from("guest_orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());
      
      return JSON.stringify({
        success: true,
        stats: {
          totalCustomers: profilesCount || 0,
          activeServices: servicesCount || 0,
          openTickets: openTicketsCount || 0,
          totalOrders: (ordersCount || 0) + (guestOrdersCount || 0),
          activeGuestOrders: guestOrdersCount || 0,
          recentOrders7Days: recentOrdersCount || 0,
        }
      });
    }

    // === Authenticated customer tools ===
    case "get_my_overview": {
      if (!userId) return safeJson({ success: false, message: "Please sign in so I can pull your account details." });
      const { data: profile } = await supabaseServiceClient
        .from("profiles")
        .select("id, full_name, email, account_number, created_at")
        .eq("id", userId)
        .maybeSingle();
      const { data: latestService } = await supabaseServiceClient
        .from("services")
        .select("id, status, plan_name, activation_date, actual_activation_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return safeJson({ success: true, profile, latest_service: latestService ?? null });
    }

    case "get_my_invoices_authed": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view your invoices." });
      const { limit = 5 } = args as { limit?: number };
      const { data, error } = await supabaseServiceClient
        .from("invoices")
        .select("id, invoice_number, total, subtotal, vat_total, status, due_date, issue_date, billing_period_start, billing_period_end")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 20));
      if (error) return safeJson({ success: false, message: "Could not load invoices right now." });
      return safeJson({ success: true, invoices: data ?? [] });
    }

    case "get_my_services_authed": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view your services." });
      const { data, error } = await supabaseServiceClient
        .from("services")
        .select("id, plan_name, service_type, status, activation_date, actual_activation_date, price_monthly, service_address")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return safeJson({ success: false, message: "Could not load services right now." });
      return safeJson({ success: true, services: data ?? [] });
    }

    case "get_my_orders_authed": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view your orders." });
      const { limit = 5 } = args as { limit?: number };
      const { data, error } = await supabaseServiceClient
        .from("orders")
        .select("id, occta_order_number, status, lifecycle_status, plan_name, service_type, expected_activation_date, actual_activation_date, created_at")
        .or(`user_id.eq.${userId},customer_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 20));
      if (error) return safeJson({ success: false, message: "Could not load orders right now." });
      return safeJson({ success: true, orders: data ?? [] });
    }

    case "get_my_documents": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view your documents." });
      const { data: cs } = await supabaseServiceClient
        .from("contract_summaries")
        .select("id, status, accepted_at, service_address, customer_email_snapshot, created_at")
        .eq("customer_id", userId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(10);
      const { data: receipts } = await supabaseServiceClient
        .from("receipts")
        .select("id, invoice_id, amount, paid_at, method, reference")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      // Note: never return storage keys; UI generates signed URLs separately on user action.
      return safeJson({ success: true, contract_summaries: cs ?? [], receipts: receipts ?? [] });
    }

    case "get_my_tickets": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view your tickets." });
      const { data } = await supabaseServiceClient
        .from("support_tickets")
        .select("id, subject, status, priority, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return safeJson({ success: true, tickets: data ?? [] });
    }

    case "explain_my_invoice": {
      if (!userId) return safeJson({ success: false, message: "Please sign in to view that invoice." });
      const { invoice_number } = args as { invoice_number: string };
      const { data: inv } = await supabaseServiceClient
        .from("invoices")
        .select("id, invoice_number, total, subtotal, vat_total, status, due_date, issue_date, billing_period_start, billing_period_end")
        .eq("user_id", userId)
        .eq("invoice_number", invoice_number)
        .maybeSingle();
      if (!inv) return safeJson({ success: false, message: "I couldn't find that invoice on your account." });
      const { data: lines } = await supabaseServiceClient
        .from("invoice_lines")
        .select("description, qty, unit_price, line_total")
        .eq("invoice_id", inv.id);
      return safeJson({ success: true, invoice: inv, lines: lines ?? [] });
    }

    case "escalate_to_team": {
      const { subject, summary, priority = "medium", category = "account" } = args as {
        subject: string; summary: string; priority?: string; category?: string;
      };
      if (!subject || !summary) return safeJson({ success: false, message: "Need subject and summary to create a case." });
      let ticketId: string | null = null;
      if (userId) {
        const { data } = await supabaseAnonClient
          .from("support_tickets")
          .insert({
            user_id: userId,
            subject: subject.slice(0, 200),
            description: `[AI escalation]\n\n${summary}`,
            category,
            priority,
            status: "open",
          })
          .select("id")
          .single();
        ticketId = data?.id ?? null;
      }
      // Always log to admin_tasks for staff visibility (service-role insert is safe; audit logged)
      await supabaseServiceClient.from("admin_tasks").insert({
        title: `AI escalation: ${subject.slice(0, 120)}`,
        description: summary,
        priority,
        status: "open",
        source: "ai_assistant",
        related_user_id: userId ?? null,
      });
      await supabaseServiceClient.from("audit_logs").insert({
        action: "create",
        entity: "support_ticket",
        entity_id: ticketId,
        metadata: { source: "ai_escalation", subject, priority, category, user_id: userId },
      });
      const ref = ticketId ? ticketId.slice(0, 8).toUpperCase() : `CASE-${Date.now().toString(36).toUpperCase()}`;
      return safeJson({
        success: true,
        card: {
          type: "escalation_card",
          reference: ref,
          subject,
          priority,
          message: ticketId
            ? "I've prepared a case for the OCCTA team. They'll follow up shortly."
            : "I've flagged this for the OCCTA team. They'll be in touch — please also call us if it's urgent.",
        },
      });
    }

    // === Admin copilot tools ===
    case "admin_customer_360": {
      if (!isAdmin) return safeJson({ success: false, message: "Admin only." });
      const { identifier } = args as { identifier: string };
      // Resolve to user_id
      let targetUserId: string | null = null;
      let profile: Record<string, unknown> | null = null;
      if (identifier.includes("@")) {
        const { data } = await supabaseServiceClient.from("profiles")
          .select("id, full_name, email, account_number, phone, created_at")
          .eq("email", identifier.toLowerCase()).maybeSingle();
        profile = data; targetUserId = data?.id ?? null;
      } else if (identifier.toUpperCase().startsWith("OCC")) {
        const { data } = await supabaseServiceClient.from("profiles")
          .select("id, full_name, email, account_number, phone, created_at")
          .eq("account_number", identifier.toUpperCase()).maybeSingle();
        profile = data; targetUserId = data?.id ?? null;
      } else {
        targetUserId = identifier;
        const { data } = await supabaseServiceClient.from("profiles")
          .select("id, full_name, email, account_number, phone, created_at")
          .eq("id", identifier).maybeSingle();
        profile = data;
      }
      if (!targetUserId) return safeJson({ success: false, message: "Customer not found." });
      const [{ data: services }, { data: invoices }, { data: tickets }, { data: orders }] = await Promise.all([
        supabaseServiceClient.from("services").select("id, plan_name, status, activation_date, actual_activation_date, service_type").eq("user_id", targetUserId).limit(10),
        supabaseServiceClient.from("invoices").select("invoice_number, total, status, due_date").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(5),
        supabaseServiceClient.from("support_tickets").select("id, subject, status, priority, created_at").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(5),
        supabaseServiceClient.from("orders").select("id, occta_order_number, status, lifecycle_status, created_at").or(`user_id.eq.${targetUserId},customer_id.eq.${targetUserId}`).order("created_at", { ascending: false }).limit(5),
      ]);
      return safeJson({ success: true, profile, services: services ?? [], invoices: invoices ?? [], tickets: tickets ?? [], orders: orders ?? [] });
    }

    case "admin_order_blockers": {
      if (!isAdmin) return safeJson({ success: false, message: "Admin only." });
      const { order_id } = args as { order_id: string };
      const { data: order } = await supabaseServiceClient.from("orders")
        .select("id, occta_order_number, status, lifecycle_status, user_id, customer_id, plan_name").eq("id", order_id).maybeSingle();
      if (!order) return safeJson({ success: false, message: "Order not found." });
      const { data: readiness } = await supabaseServiceClient.from("provisioning_readiness")
        .select("installation_confirmed, router_confirmed, internal_notes_reviewed, admin_review_complete")
        .eq("order_id", order_id).maybeSingle();
      const blockers: string[] = [];
      if (!readiness?.installation_confirmed) blockers.push("Installation/setup choice not confirmed");
      if (!readiness?.router_confirmed) blockers.push("Router choice not confirmed");
      if (!readiness?.internal_notes_reviewed) blockers.push("Internal notes not reviewed");
      if (!readiness?.admin_review_complete) blockers.push("Admin final review not complete");
      return safeJson({ success: true, order, blockers, readiness: readiness ?? null });
    }

    case "admin_draft_reply": {
      if (!isAdmin) return safeJson({ success: false, message: "Admin only." });
      // Return the inputs back; the model itself will produce the draft text in the next turn.
      // We supply structure + branding rules.
      return safeJson({
        success: true,
        instruction: "Write a draft reply for staff to review (do not send). Use OCCTA tone: professional, warm, plain English. Sign off as 'The OCCTA Team'. Never invent prices, dates, or account facts.",
        params: args,
      });
    }

    case "admin_prepare_action": {
      if (!isAdmin) return safeJson({ success: false, message: "Admin only." });
      const { action_type, target_id, summary, details } = args as {
        action_type: string; target_id: string; summary: string; details?: Record<string, unknown>;
      };
      // Build a confirmation card. Nothing is mutated here.
      return safeJson({
        success: true,
        card: {
          type: "confirmation_card",
          action_type,
          target_id,
          summary,
          details: redact(details ?? {}),
          warning: "This action affects the customer account. Click Confirm to run it through the existing safe endpoints. Click Cancel to discard.",
        },
      });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// Helper function to detect intent from user message
function detectIntent(message: string): { intent: string; category: string } {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes("bill") || lowerMsg.includes("invoice") || lowerMsg.includes("payment")) {
    return { intent: "billing_inquiry", category: "billing" };
  }
  if (lowerMsg.includes("switch") || lowerMsg.includes("change provider") || lowerMsg.includes("move to")) {
    return { intent: "switching_inquiry", category: "sales" };
  }
  if (lowerMsg.includes("compare") || lowerMsg.includes("plan") || lowerMsg.includes("broadband") || lowerMsg.includes("sim")) {
    return { intent: "plan_comparison", category: "sales" };
  }
  if (lowerMsg.includes("order") || lowerMsg.includes("track")) {
    return { intent: "order_inquiry", category: "support" };
  }
  if (lowerMsg.includes("problem") || lowerMsg.includes("issue") || lowerMsg.includes("help") || lowerMsg.includes("support")) {
    return { intent: "support_request", category: "support" };
  }
  if (lowerMsg.includes("account") || lowerMsg.includes("login") || lowerMsg.includes("password")) {
    return { intent: "account_inquiry", category: "account" };
  }
  if (lowerMsg.includes("cancel") || lowerMsg.includes("stop")) {
    return { intent: "cancellation_inquiry", category: "retention" };
  }
  return { intent: "general_inquiry", category: "general" };
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages, userId: _clientUserId, sessionId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase clients - use service role ONLY for verification queries
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);

    // SECURITY: Extract userId from verified JWT, never trust client-supplied userId
    let userId: string | null = null;
    let isAdmin = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseServiceClient.auth.getUser(token);
      if (!userError && userData?.user) {
        userId = userData.user.id;
        // Check admin role using verified userId
        const { data: roleData } = await supabaseServiceClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .single();
        isAdmin = !!roleData;
      }
    }

    // === Pre-fetch signed-in user's context so the model never asks for verification ===
    let signedInContextBlock = "";
    if (userId) {
      try {
        const [{ data: profile }, { data: latestOrder }, { data: latestInvoice }, { data: openTickets }, { data: activeServices }] = await Promise.all([
          supabaseServiceClient.from("profiles").select("full_name, email, account_number, phone").eq("id", userId).maybeSingle(),
          supabaseServiceClient.from("orders").select("order_number, status, lifecycle_status, plan_name, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabaseServiceClient.from("invoices").select("invoice_number, total_amount, status, due_date").eq("user_id", userId).order("issued_at", { ascending: false }).limit(1).maybeSingle(),
          supabaseServiceClient.from("support_tickets").select("id, subject, status").eq("user_id", userId).eq("status", "open").limit(3),
          supabaseServiceClient.from("services").select("plan_name, service_type, status").eq("user_id", userId).limit(5),
        ]);
        const firstName = profile?.full_name?.split(" ")[0] ?? "there";
        signedInContextBlock = `

## SIGNED-IN CUSTOMER CONTEXT (already verified via JWT — DO NOT ASK FOR VERIFICATION)
- Name: ${profile?.full_name ?? "Unknown"} (use "${firstName}" when greeting)
- Email: ${profile?.email ?? "n/a"}
- Account number: ${profile?.account_number ?? "n/a"}
- Phone: ${profile?.phone ?? "n/a"}
- Latest order: ${latestOrder ? `${latestOrder.order_number} — ${latestOrder.plan_name ?? ""} — status ${latestOrder.status}${latestOrder.lifecycle_status ? ` / ${latestOrder.lifecycle_status}` : ""}` : "none"}
- Latest invoice: ${latestInvoice ? `${latestInvoice.invoice_number} — £${latestInvoice.total_amount} — ${latestInvoice.status} (due ${latestInvoice.due_date ?? "n/a"})` : "none"}
- Active services: ${(activeServices ?? []).map(s => `${s.plan_name} (${s.service_type}, ${s.status})`).join("; ") || "none on file"}
- Open tickets: ${(openTickets ?? []).length}

### CRITICAL RULES FOR SIGNED-IN USERS
- The customer is ALREADY authenticated. NEVER ask for email, date of birth, account number, or any verification.
- NEVER call lookup_account or lookup_account_by_number for this user.
- When they ask about "my bill / order / services / account", IMMEDIATELY call the matching _authed tool (get_my_overview, get_my_invoices_authed, get_my_orders_authed, get_my_services_authed, get_my_tickets, explain_my_invoice) and answer with the real data.
- Greet them by first name on the first reply of a session.
- After answering, ALWAYS end with a short "What next?" line AND a machine-readable options block so the UI can render clickable chips. Format EXACTLY like this on the final line:
  <<<OPTIONS:["Explain this invoice","Raise a ticket","Check installation status"]>>>
  Use 2–4 short action labels (max ~6 words each). Each label must be a complete request the user could send back as-is. Do not number them. The token must be the very last thing in your reply.
`;
      } catch (e) {
        console.error("Failed to load signed-in context:", e);
      }
    }

    // Get the last user message for analytics
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop();
    const { intent, category } = lastUserMessage ? detectIntent(lastUserMessage.content) : { intent: "unknown", category: "unknown" };

    // Build available tools based on user role
    const baseCustomerTools = [...tools, ...customerAuthedTools];
    const availableTools = isAdmin
      ? [...baseCustomerTools, ...adminTools, ...adminCopilotTools]
      : baseCustomerTools;

    // Ollie — OCCTA Assist (professional, human, safe)
    const personaName = isAdmin ? "OCCTA Copilot" : "Ollie — OCCTA Assist";
    const systemPrompt = `You are ${personaName}, OCCTA Telecom's premium AI assistant. Tone: professional, warm, plain English, lightly human. Never robotic, never pushy, never "as an AI". Light wit is fine for general questions, but stay calm and serious on billing, cancellations, complaints, vulnerable-customer support, and identity questions.
${signedInContextBlock}

## ABSOLUTE SAFETY RULES
- Never invent prices, speeds, offers, fees, notice periods, billing dates, ETF figures, or contract terms. If it's not in approved data, say you'll check or create a case via escalate_to_team.
- Never expose secrets, API keys, Worldpay/Direct Debit credentials, encryption keys, raw tokens, raw bank details, supplier (Giacom) references, costs, margins, internal staff notes, or audit security fields. The tool layer redacts these — never repeat anything that looks like a credential or token.
- Never claim you have done a mutation. You can only "guide", "prepare", "draft", or "raise a case". The OCCTA team performs the final action through approved tools.
- Never bypass identity verification. For sensitive customer data, the user must be signed in OR pass verification via lookup_account_by_number.
- Never send customer emails directly. You may draft replies for staff to review.
- Important account actions are always confirmed by OCCTA staff — say so plainly when relevant: "Important account actions are confirmed by the OCCTA team."

## WHEN TO USE TOOLS
- Signed-in customer (userId present): prefer the _authed tools (get_my_overview, get_my_invoices_authed, get_my_orders_authed, get_my_services_authed, get_my_documents, get_my_tickets, explain_my_invoice) — these are scoped to them automatically.
- Anonymous user asking about their bills/orders: use lookup_account_by_number with account number + DOB. Ask for ONE piece of info at a time.
- If a request needs human review (policy, ETF, identity conflict, refund decision, cancellation outside policy, anything you can't safely complete): call escalate_to_team with a clear subject, what you checked, what's missing, and recommended next step. Then tell the customer politely that a case has been raised.

## ADMIN COPILOT MODE
${isAdmin ? `You are speaking to an OCCTA staff member.
- Use admin_customer_360, admin_order_blockers for fast Customer 360 summaries.
- Use admin_draft_reply to produce reply drafts for the staff member to copy/send themselves.
- For any high-risk action (confirm service live, mark payment received, cancel, lifecycle transition, create admin task or note), call admin_prepare_action with action_type + target_id + a one-line summary. The UI will render a confirmation card. Do NOT pretend the action ran — staff must click Confirm.
- Keep the tone direct, low-emoji, operationally clear.` : "Customer mode — no admin tools available."}

## ESCALATION WORDING
If you cannot safely answer: "I can't safely complete that one myself — I've prepared a case for the OCCTA team to review." Then call escalate_to_team.

## RENDERING STRUCTURED CARDS
Some tools return a "card" field (escalate_to_team → escalation_card, admin_prepare_action → confirmation_card). When that happens, include the card in your reply by wrapping the card JSON exactly like this on its own line, with no extra commentary inside the markers:

<<<CARD:{...the card JSON...}>>>

Always include a short human sentence before the card. Never invent a card; only emit one when a tool literally returned a card object in this turn.

## QUICK REPLY CHIPS (REQUIRED ON EVERY REPLY)
End EVERY reply with a machine-readable options block so the UI can render clickable chips. Format EXACTLY:

<<<OPTIONS:["Short label one","Short label two","Short label three"]>>>

Rules:
- 2–4 options, each ≤6 words, written as something the user could click and send back as-is (e.g. "Compare broadband plans", "Check my latest invoice", "Talk to a human").
- Tailor options to the conversation context (signed-in vs guest, topic just discussed).
- The OPTIONS token must be the very last thing in your reply, on its own line.
- Do NOT also write a numbered list of the same options in prose — just the token.

(Legacy IRA brand context retained below for product/plan answers.)

## IDENTITY & PERSONALITY
IRA is:
- Friendly, witty, calm, reassuring
- Slightly humorous (UK-style, polite, never sarcastic)
- Honest, transparent, non-pushy
- Cost-focused and customer-first
- Never salesy, never aggressive

IRA must NEVER invent prices, NEVER promise coverage, and NEVER give legal advice.

## BRAND & BUSINESS CONTEXT (CRITICAL)
OCCTA operates across the entire United Kingdom.
Do NOT mention Huddersfield or Yorkshire unless referring strictly to registered office (privacy policy / legal context only).

OCCTA Philosophy:
- Cheapest possible plans compared to major UK telecoms (BT, Sky, Virgin, EE, O2)
- No contracts
- No lock-ins
- No hidden price hikes
- Simple monthly pricing
- Customer freedom above everything

Customers choose OCCTA because they:
- Hate long contracts
- Are tired of mid-contract price rises
- Want simple broadband & SIM deals
- Want human-style support without pressure

Reinforce this philosophy naturally in conversation.

## BUSINESS INFORMATION
- Company: ${businessInfo.company}
- Phone: ${businessInfo.phone}
- Email: ${businessInfo.email}
- Services: ${businessInfo.services.join(", ")}

## KEY FEATURES
${businessInfo.features.map(f => `- ${f}`).join("\n")}

## BROADBAND PLANS
${businessInfo.broadbandPlans.map(p => `- ${p.name}: ${p.speed} @ ${p.price} - ${p.description}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

## SIM PLANS
${businessInfo.simPlans.map(p => `- ${p.name}: ${p.data} data @ ${p.price} - ${p.description}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

## LANDLINE PLANS
${businessInfo.landlinePlans.map(p => `- ${p.name}: ${p.price} - ${p.callRate}${p.popular ? " (POPULAR)" : ""}`).join("\n")}

## BUNDLE DISCOUNT
${businessInfo.bundleDiscounts}

## COMMON FAQS
${businessInfo.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

## CONVERSATION FLOWS

### 1️⃣ Plan Comparison
- Ask what the user needs (SIM / Broadband / Both)
- Ask usage questions (light / medium / heavy)
- Explain benefits without pushing
- Always mention: No contracts, Easy switching, No mid-contract hikes

### 2️⃣ Switching to OCCTA
- Explain switching in simple steps
- Reassure: No downtime (where applicable), Keep number if possible, No pressure

### 3️⃣ My OCCTA Account (Logged Out)
- Ask user to log in
- Explain what they can manage once logged in

### 4️⃣ My OCCTA Account (Logged In)
- Greet by name if available
- Offer: View services, Billing help, Support tickets
- Never expose sensitive data in chat

### 5️⃣ FAQs
- Contracts (answer: none)
- Price rises (answer: none mid-contract)
- Coverage (UK-wide, depends on network)
- Installation timelines (give ranges, not guarantees)

## TOOL USAGE GUIDELINES
1. For viewing bills using account number: Use lookup_account_by_number tool. IMPORTANT: Ask for information ONE AT A TIME:
   - First ask: "What's your account number? (It starts with OCC followed by 8 digits)"
   - Wait for their response
   - Then ask: "Thanks! And what's your date of birth? (Format: DD/MM/YYYY)"
   - After verification succeeds, use get_latest_bill to fetch their billing details
2. For order lookups by email: Use lookup_account tool with email and date of birth.
3. Use compare_plans when customers need help choosing a plan.
4. Use calculate_bundle_price to show bundle savings.
5. Create support tickets for issues that need human follow-up.
6. If a customer is signed in (userId is provided), they don't need to verify for creating tickets.

## ADMIN-ONLY BEHAVIOUR
When user has admin role:

IRA CAN:
- Search customers by account number (OCCxxxx) or email
- Explain admin workflows
- Guide through adding services
- Explain errors in simple terms
- Suggest next steps (not execute actions)

IRA CANNOT:
- Modify database records
- Insert / delete services
- Expose secrets, tokens, or credentials
- Bypass permissions

Admin tone: Clear, Direct, Fewer emojis, No humour unless appropriate.

## ERROR & FALLBACK MESSAGES
- Unknown Question: "Hmm — I don't want to guess and give you wrong info. Let me help another way or connect you to support 🙂"
- Too Technical: "That's a bit beyond what I can safely do here — but I can pass this to our team 👍"
- System Error: "Oops — looks like something didn't load properly. Please refresh or try again in a moment."
- Repeated Confusion: "Sorry about that — let's reset 😊 What would you like help with right now?"

## SECURITY & SAFETY RULES
- Never reveal internal tables or API keys
- Never mention Supabase, database names, or schemas
- Never pretend to perform actions
- Always say "I can guide you" instead of "I have done"

## RESPONSE GUIDELINES
1. Be friendly, helpful, and concise. Use a conversational British tone.
2. Always mention our phone number (0800 260 6626) for urgent matters.
3. Keep responses concise - aim for 2-3 sentences unless more detail is needed.
4. Use emojis sparingly but appropriately to be friendly.
5. If you don't know something, be honest and offer to connect them with human support.
6. When displaying bill information, format it nicely with clear sections for the plan, add-ons, and totals.

## UX GOAL
After chatting with IRA, users should feel:
- Relieved
- In control
- Confident
- Not pressured
- Comfortable switching or staying

IRA's success is clarity + trust, not conversion at all costs.`;

    let currentMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call AI with available tools (includes admin tools if admin)
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: currentMessages,
        tools: availableTools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please call us at 0800 260 6626." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    let data = await response.json();
    let assistantMessage = data.choices[0].message;

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${toolName}`, toolArgs);
        
        const result = await executeTool(
          toolName, 
          toolArgs, 
          supabaseServiceClient, 
          supabaseAnonClient, 
          userId ?? undefined,
          isAdmin,
        );
        // Last-line defence: if anything resembling a credential slipped through, scrub it.
        const safeResult = containsForbiddenContent(result)
          ? JSON.stringify({ success: false, message: "Result blocked by safety filter." })
          : result;

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: safeResult,
        });
      }

      // Add assistant message with tool calls and tool results
      currentMessages.push(assistantMessage);
      currentMessages.push(...toolResults);

      // Call AI again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          tools: availableTools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error("AI service error during tool follow-up");
      }

      data = await response.json();
      assistantMessage = data.choices[0].message;
    }

    const responseTime = Date.now() - startTime;

    // Track analytics (non-blocking, fire-and-forget)
    if (sessionId && lastUserMessage) {
      (async () => {
        try {
          await supabaseServiceClient
            .from("chat_analytics")
            .insert([
              {
                session_id: sessionId,
                user_id: userId || null,
                message_type: "user",
                message_content: lastUserMessage.content,
                detected_intent: intent,
                detected_category: category,
                created_at: new Date().toISOString(),
              },
              {
                session_id: sessionId,
                user_id: userId || null,
                message_type: "assistant",
                message_content: assistantMessage.content || "",
                detected_intent: intent,
                detected_category: category,
                response_time_ms: responseTime,
                created_at: new Date().toISOString(),
              },
            ]);
          console.log("Analytics tracked");
        } catch (err) {
          console.error("Analytics error:", err);
        }
      })();
    }

    return new Response(
      JSON.stringify({ 
        content: assistantMessage.content,
        role: "assistant"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI chat error:", error);
    const origin = req.headers.get('Origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ 
        error: "Sorry, I'm having trouble right now. Please try again or call us at 0800 260 6626." 
      }),
      { status: 500, headers: { ...errorCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
