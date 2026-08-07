import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  type AccountIntent,
  type CompanionMessage,
  detectAccountIntent,
  detectPublicIntent,
  extractAccountNumber,
  extractDateOfBirth,
  formatDate,
  formatMoney,
  lastUserText,
  maskAccountNumber,
  maskEmail,
  maskPhone,
  normaliseMessages,
  redactSensitiveText,
  withOptions,
} from "../_shared/companionCore.ts";
import { runOcctaBrain } from "./brain.ts";

const OCCTA_PHONE = "0800 260 6626";
const OCCTA_EMAIL = "hello@occta.co.uk";
const BASE_URL = "https://www.occta.co.uk";
const VERIFICATION_TTL_SECONDS = 15 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerificationClaims = {
  v: 1;
  sessionId: string;
  accountNumber: string;
  exp: number;
};

type CustomerScope = {
  userId: string | null;
  accountNumber: string | null;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  signedIn: boolean;
};

type CompanionReply = {
  content: string;
  verificationToken?: string;
  source?: "account" | "approved_content" | "knowledge_base" | "ai";
};

type OrdersResult = {
  canonical: any[];
  guest: any[];
  failed: boolean;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signVerification(claims: VerificationClaims, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyVerification(
  token: unknown,
  sessionId: string,
  secret: string,
): Promise<VerificationClaims | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [payload, signature] = token.split(".");
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const claims = JSON.parse(decoder.decode(fromBase64Url(payload))) as VerificationClaims;
    if (claims.v !== 1 || claims.sessionId !== sessionId || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!/^OCC[A-Z0-9]{6,12}$/i.test(claims.accountNumber)) return null;
    return claims;
  } catch {
    return null;
  }
}

async function digestIdentifier(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(hash));
}

async function checkRateLimit(
  client: any,
  action: string,
  identifier: string,
  maxRequests: number,
  windowMinutes: number,
  failClosed = false,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      _action: action,
      _identifier: identifier,
      _max_requests: maxRequests,
      _window_minutes: windowMinutes,
    });
    if (error) return !failClosed;
    return data === true;
  } catch {
    return !failClosed;
  }
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

function statusLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "status not confirmed";
  return value.replace(/_/g, " ");
}

function maskReference(value: unknown): string {
  const clean = String(value ?? "").trim();
  if (!clean) return "reference unavailable";
  if (clean.length <= 6) return `••${clean.slice(-4)}`;
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

function safeSessionId(value: unknown): string {
  if (typeof value !== "string") return crypto.randomUUID();
  const trimmed = value.trim();
  return /^[a-zA-Z0-9-]{16,80}$/.test(trimmed) ? trimmed : crypto.randomUUID();
}

function unavailableSection(section: string): string {
  return withOptions(
    `I securely identified the account, but I couldn't load the ${section} section just now. I won't guess or show stale information.`,
    ["Try again", "Open my dashboard", "Talk to a human"],
  );
}

async function getAuthenticatedUser(serviceClient: any, authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const { data, error } = await serviceClient.auth.getUser(token);
  return error ? null : data?.user ?? null;
}

async function scopeFromSignedInUser(serviceClient: any, user: any): Promise<CustomerScope> {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, account_number, phone")
    .eq("id", user.id)
    .maybeSingle();
  const metadataName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null;
  return {
    userId: user.id,
    accountNumber: profile?.account_number ?? null,
    email: profile?.email ?? user?.email ?? null,
    fullName: profile?.full_name ?? metadataName,
    phone: profile?.phone ?? null,
    signedIn: true,
  };
}

async function verifyGuestAccount(
  serviceClient: any,
  accountNumber: string,
  dateOfBirth: string,
): Promise<CustomerScope | null> {
  const normalisedAccount = accountNumber.toUpperCase();
  const identifier = await digestIdentifier(normalisedAccount);
  const allowed = await checkRateLimit(serviceClient, "occta_companion_verification", identifier, 5, 15, true);
  if (!allowed) throw new Error("verification_rate_limited");

  const [{ data: profile }, { data: guestOrder }] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, full_name, email, account_number, phone, date_of_birth")
      .eq("account_number", normalisedAccount)
      .maybeSingle(),
    serviceClient
      .from("guest_orders")
      .select("user_id, full_name, email, phone, account_number, date_of_birth")
      .eq("account_number", normalisedAccount)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const storedDob = String(profile?.date_of_birth ?? guestOrder?.date_of_birth ?? "").slice(0, 10);
  if (!storedDob || storedDob !== dateOfBirth) return null;

  return {
    userId: profile?.id ?? guestOrder?.user_id ?? null,
    accountNumber: profile?.account_number ?? guestOrder?.account_number ?? normalisedAccount,
    email: profile?.email ?? guestOrder?.email ?? null,
    fullName: profile?.full_name ?? guestOrder?.full_name ?? null,
    phone: profile?.phone ?? guestOrder?.phone ?? null,
    signedIn: false,
  };
}

async function scopeFromClaims(serviceClient: any, claims: VerificationClaims): Promise<CustomerScope> {
  const [{ data: profile }, { data: guestOrder }] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, full_name, email, account_number, phone")
      .eq("account_number", claims.accountNumber)
      .maybeSingle(),
    serviceClient
      .from("guest_orders")
      .select("user_id, full_name, email, phone, account_number")
      .eq("account_number", claims.accountNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    userId: profile?.id ?? guestOrder?.user_id ?? null,
    accountNumber: profile?.account_number ?? guestOrder?.account_number ?? claims.accountNumber,
    email: profile?.email ?? guestOrder?.email ?? null,
    fullName: profile?.full_name ?? guestOrder?.full_name ?? null,
    phone: profile?.phone ?? guestOrder?.phone ?? null,
    signedIn: false,
  };
}

async function loadOrders(serviceClient: any, scope: CustomerScope): Promise<OrdersResult> {
  const canonicalPromise = scope.userId
    ? serviceClient
        .from("orders")
        .select("id, occta_order_number, status, lifecycle_status, plan_name, service_type, created_at, expected_activation_date, actual_activation_date")
        .or(`user_id.eq.${scope.userId},customer_id.eq.${scope.userId}`)
        .order("created_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [], error: null });

  if (!scope.accountNumber && !scope.email) {
    const canonicalResult = await canonicalPromise;
    return {
      canonical: canonicalResult.data ?? [],
      guest: [],
      failed: Boolean(canonicalResult.error),
    };
  }

  let guestQuery = serviceClient
    .from("guest_orders")
    .select("id, order_number, account_number, status, plan_name, service_type, plan_price, created_at");
  guestQuery = scope.accountNumber
    ? guestQuery.eq("account_number", scope.accountNumber)
    : guestQuery.eq("email", scope.email!.toLowerCase());

  const [canonicalResult, guestResult] = await Promise.all([
    canonicalPromise,
    guestQuery.order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    canonical: canonicalResult.data ?? [],
    guest: guestResult.data ?? [],
    failed: Boolean(canonicalResult.error || guestResult.error),
  };
}

async function accountReply(
  serviceClient: any,
  scope: CustomerScope,
  intent: AccountIntent,
): Promise<string> {
  const name = firstName(scope.fullName);

  if (intent === "overview") {
    const [{ canonical, guest, failed }, servicesResult, ticketsResult] = await Promise.all([
      loadOrders(serviceClient, scope),
      scope.userId
        ? serviceClient.from("services").select("id, status").eq("user_id", scope.userId).limit(50)
        : Promise.resolve({ data: [], error: null }),
      scope.signedIn && scope.userId
        ? serviceClient.from("support_tickets").select("id, status").eq("user_id", scope.userId).limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const openTickets = (ticketsResult.data ?? []).filter((ticket: any) =>
      ["open", "in_progress", "waiting_customer"].includes(ticket.status)
    ).length;
    const orderCount = new Set([
      ...canonical.map((row: any) => String(row.occta_order_number ?? row.id)),
      ...guest.map((row: any) => String(row.order_number ?? row.id)),
    ]).size;
    const sectionWarning = failed || servicesResult.error || ticketsResult.error
      ? "\n\nSome account sections were temporarily unavailable, so I have not estimated them."
      : "";
    return withOptions(
      `Hi ${name} — your account is securely verified.\n\n**Account:** ${maskAccountNumber(scope.accountNumber)}\n**Email:** ${maskEmail(scope.email)}\n**Phone:** ${maskPhone(scope.phone)}\n**Orders on file:** ${failed ? "not available" : orderCount}\n**Services on file:** ${servicesResult.error ? "not available" : (servicesResult.data ?? []).length}\n**Open support cases:** ${scope.signedIn ? (ticketsResult.error ? "not available" : openTickets) : "sign in to view"}${sectionWarning}`,
      ["Check my latest invoice", "Track my order", "Check my services", "Raise a ticket"],
    );
  }

  if (intent === "orders" || intent === "installation") {
    const { canonical, guest, failed } = await loadOrders(serviceClient, scope);
    if (failed) return unavailableSection("order and installation");
    const seen = new Set<string>();
    const rows = [
      ...canonical.map((order: any) => ({
        ref: order.occta_order_number ?? order.id,
        plan: order.plan_name ?? order.service_type ?? "Service order",
        status: order.lifecycle_status ?? order.status,
        activation: order.actual_activation_date ?? order.expected_activation_date,
      })),
      ...guest.map((order: any) => ({
        ref: order.order_number ?? order.id,
        plan: order.plan_name ?? order.service_type ?? "Service order",
        status: order.status,
        activation: null,
      })),
    ].filter((row) => {
      const key = String(row.ref ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!rows.length) {
      return withOptions(
        `Hi ${name} — I checked the verified account, but I can't see an order linked to it yet. If it was placed very recently, it may still be processing.`,
        ["Check my services", "Raise a ticket", "Talk to a human"],
      );
    }
    const lines = rows.slice(0, 5).map((row) =>
      `• **${maskReference(row.ref)}** — ${row.plan} — ${statusLabel(row.status)}${row.activation ? ` — ${formatDate(row.activation)}` : ""}`
    );
    return withOptions(
      `Hi ${name} — here is the ${intent === "installation" ? "installation and activation" : "latest order"} information I found:\n\n${lines.join("\n")}`,
      ["Check my services", "Check my latest invoice", "Raise a ticket"],
    );
  }

  if (intent === "invoices") {
    if (!scope.signedIn || !scope.userId) {
      return withOptions(
        `Hi ${name} — invoice amounts and billing documents require a signed-in account session. Date-of-birth verification alone does not unlock them.`,
        ["Sign in", "Raise a billing ticket", "Talk to a human"],
      );
    }
    const { data: invoices, error } = await serviceClient
      .from("invoices")
      .select("invoice_number, status, issue_date, due_date, subtotal, vat_total, total")
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return unavailableSection("billing");
    if (!(invoices ?? []).length) {
      return withOptions(
        `Hi ${name} — there are no invoices available on your account yet. New invoices will appear in the dashboard once generated.`,
        ["Track my order", "Check my services", "Raise a billing ticket"],
      );
    }
    const lines = (invoices ?? []).map((invoice: any) =>
      `• **${invoice.invoice_number}** — ${formatMoney(invoice.total)} — ${statusLabel(invoice.status)} — due ${formatDate(invoice.due_date)}`
    );
    return withOptions(
      `Hi ${name} — these are your latest invoices:\n\n${lines.join("\n")}\n\nOpen **Dashboard → Billing** for the full line-by-line documents.`,
      ["Explain my first invoice", "Track my order", "Raise a billing ticket"],
    );
  }

  if (intent === "services") {
    let queryResult: { data: any[] | null; error: any } = { data: [], error: null };
    if (scope.userId) {
      queryResult = await serviceClient
        .from("services")
        .select("service_type, plan_name, status, activation_date, actual_activation_date, price_monthly")
        .eq("user_id", scope.userId)
        .order("created_at", { ascending: false })
        .limit(10);
    } else if (scope.accountNumber) {
      queryResult = await serviceClient
        .from("services")
        .select("service_type, plan_name, status, activation_date, actual_activation_date, price_monthly")
        .eq("identifiers->>account_number", scope.accountNumber)
        .order("created_at", { ascending: false })
        .limit(10);
    }
    if (queryResult.error) return unavailableSection("services");
    const services = queryResult.data ?? [];
    if (!services.length) {
      const orders = await loadOrders(serviceClient, scope);
      const latest = orders.canonical[0] ?? orders.guest[0];
      return withOptions(
        latest
          ? `Hi ${name} — I can't see a live service record yet. The latest order is currently ${statusLabel(latest.lifecycle_status ?? latest.status)}.`
          : `Hi ${name} — I can't see an active service linked to this verified account yet.`,
        ["Track my order", "Raise a ticket", "Talk to a human"],
      );
    }
    const lines = services.slice(0, 6).map((service) =>
      `• **${service.plan_name ?? service.service_type ?? "Service"}** — ${statusLabel(service.status)}${service.price_monthly != null ? ` — ${formatMoney(service.price_monthly)}/month` : ""}${service.actual_activation_date ?? service.activation_date ? ` — active from ${formatDate(service.actual_activation_date ?? service.activation_date)}` : ""}`
    );
    return withOptions(
      `Hi ${name} — these are the services linked to your account:\n\n${lines.join("\n")}`,
      ["Track my order", "Check my latest invoice", "Raise a ticket"],
    );
  }

  if (intent === "tickets") {
    if (!scope.signedIn || !scope.userId) {
      return withOptions(
        `Hi ${name} — support-case subjects and notes require sign-in. Date-of-birth verification alone does not unlock them.`,
        ["Sign in", "Raise a ticket", "Talk to a human"],
      );
    }
    const { data: tickets, error } = await serviceClient
      .from("support_tickets")
      .select("id, subject, status, priority, category, created_at")
      .eq("user_id", scope.userId)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) return unavailableSection("support cases");
    if (!(tickets ?? []).length) {
      return withOptions(
        `Hi ${name} — there are no support cases on your account at the moment.`,
        ["Raise a ticket", "Check my services", "Track my order"],
      );
    }
    const lines = (tickets ?? []).map((ticket: any) =>
      `• **${ticket.subject}** — ${statusLabel(ticket.status)} — ${statusLabel(ticket.priority)} priority — opened ${formatDate(ticket.created_at)}`
    );
    return withOptions(
      `Hi ${name} — here are your recent support cases:\n\n${lines.join("\n")}`,
      ["Raise another ticket", "Check my services", "Track my order"],
    );
  }

  if (intent === "documents") {
    if (!scope.signedIn || !scope.userId) {
      return withOptions(
        `Hi ${name} — contracts, receipts and account documents require sign-in because they contain personal and commercial information.`,
        ["Sign in", "Check my order", "Talk to a human"],
      );
    }
    const [summariesResult, invoiceIdsResult] = await Promise.all([
      serviceClient
        .from("contract_summaries")
        .select("id, cs_number, plan_name, accepted_at, created_at")
        .eq("customer_id", scope.userId)
        .order("created_at", { ascending: false })
        .limit(8),
      serviceClient
        .from("invoices")
        .select("id")
        .eq("user_id", scope.userId)
        .limit(50),
    ]);
    if (summariesResult.error || invoiceIdsResult.error) return unavailableSection("documents");

    const invoiceIds = (invoiceIdsResult.data ?? []).map((row: any) => row.id).filter(Boolean);
    let receipts: any[] = [];
    if (invoiceIds.length) {
      const receiptsResult = await serviceClient
        .from("receipts")
        .select("invoice_id, amount, paid_at")
        .in("invoice_id", invoiceIds)
        .order("paid_at", { ascending: false })
        .limit(8);
      if (receiptsResult.error) return unavailableSection("receipts");
      receipts = receiptsResult.data ?? [];
    }

    const summaryLines = (summariesResult.data ?? []).map((row: any) =>
      `• Contract Summary **${row.cs_number ?? "on file"}** — ${row.plan_name ?? "service"}${row.accepted_at ? ` — accepted ${formatDate(row.accepted_at)}` : ""}`
    );
    const receiptLines = receipts.map((row: any) =>
      `• Receipt — ${formatMoney(row.amount)} — paid ${formatDate(row.paid_at)}`
    );
    const lines = [...summaryLines, ...receiptLines];
    return withOptions(
      lines.length
        ? `Hi ${name} — these documents are listed on your account:\n\n${lines.slice(0, 10).join("\n")}\n\nOpen the dashboard to view or download secure files.`
        : `Hi ${name} — I can't see any customer documents on the account yet.`,
      ["Open my dashboard", "Check my latest invoice", "Raise a ticket"],
    );
  }

  return withOptions(
    `Hi ${name} — your account is securely verified. What would you like me to check?`,
    ["Check my latest invoice", "Track my order", "Check my services"],
  );
}

function approvedPublicReply(intent: string): string | null {
  switch (intent) {
    case "broadband":
      return withOptions(
        `OCCTA has three public broadband tiers, subject to what is available at your address:\n\n• **Essential Fibre** — up to 80Mbps\n• **Superfast Fibre** — up to 330Mbps\n• **Ultrafast Fibre** — up to 1,000Mbps where available\n\nYou can choose a flexible **Flex 30** option or a fixed-term **Price Lock 24** option where eligible. Final speed, monthly price, setup and router choices are confirmed before you order. [Check your address](${BASE_URL}/build-plan).`,
        ["Check availability", "Compare Flex and Price Lock", "Which speed do I need?"],
      );
    case "contract_choice":
      return withOptions(
        `**Flex 30** is designed for customers who value flexibility and do not want a long minimum term. **Price Lock 24** is a 24-month option designed for lower monthly pricing and price certainty. The best choice depends on how long you expect to stay and whether flexibility or long-term value matters more. Setup and eligibility are confirmed for the address before order.`,
        ["Check availability", "Show broadband tiers", "Help me choose a speed"],
      );
    case "speed_need":
      return withOptions(
        `For normal browsing, email and one or two HD streams, **up to 80Mbps** can be enough. A household with several people, 4K streaming, gaming and video calls will usually benefit from **150–330Mbps**. Heavy households, large downloads and creators may benefit from **500–1,000Mbps** where available. Wi-Fi quality and upload needs matter as well as the headline download speed.`,
        ["Check my address", "Explain upload speed", "Improve my Wi-Fi"],
      );
    case "sim":
      return withOptions(
        `Current personal and business SIM options are shown in OCCTA's live catalogue. Network, data allowance, term, roaming and eSIM or physical-SIM availability can vary, so I won't guess. [View current SIM options](${BASE_URL}/sim).`,
        ["View SIM plans", "Explain eSIM", "Talk to support"],
      );
    case "esim":
      return withOptions(
        `An eSIM is a digital SIM installed on a compatible phone instead of a removable plastic card. Whether OCCTA can supply one depends on the current plan, network and device. Check the live SIM options or ask the team to confirm compatibility before ordering. [View SIM options](${BASE_URL}/sim).`,
        ["View SIM plans", "Check phone compatibility", "Talk to support"],
      );
    case "voice":
      return withOptions(
        `OCCTA Digital Home Phone works through broadband and is offered as a broadband add-on or bundle rather than a standalone traditional landline. Number transfer is usually possible, but it must be confirmed for the specific order. [Read about Digital Voice](${BASE_URL}/landline).`,
        ["Keep my phone number", "Check broadband plans", "Digital Voice setup"],
      );
    case "number_porting":
      return withOptions(
        `OCCTA can usually request a transfer of an eligible existing number, but the losing provider, number type and order details must be checked first. Do not cancel the old phone service yourself until the transfer is confirmed, because that can risk losing the number.`,
        ["Start a switch", "Digital Voice information", "Talk to support"],
      );
    case "switching":
      return withOptions(
        `For eligible UK fixed-line switches, the new provider normally manages the One Touch Switch process. Your old provider confirms any final charges before the switch proceeds. Number transfers and the exact changeover depend on the services involved, so OCCTA confirms them during the order. [See how switching works](${BASE_URL}/switching).`,
        ["Start an availability check", "Can I keep my number?", "Compare broadband plans"],
      );
    case "cancellation":
      return withOptions(
        `Cancellation depends on the plan you chose. **Flex 30** is the flexible monthly option and uses its stated notice terms. **Price Lock 24** has a fixed minimum term, so early termination charges may apply if it ends early. Important account actions are confirmed by the OCCTA team. [Read the cancellation information](${BASE_URL}/cancellation).`,
        ["Check my account", "Talk to a human", "Read cancellation terms"],
      );
    case "service_status":
      return withOptions(
        `Check OCCTA's service-status page first for a known incident. If nothing is listed, restart the router and ONT or modem once, then test one device by Ethernet if possible. A local Wi-Fi issue may not appear as a network outage. [Open service status](${BASE_URL}/status).`,
        ["My internet is down", "Explain router lights", "Talk to a human"],
      );
    case "no_internet":
      return withOptions(
        `Let's separate a local Wi-Fi problem from a line fault. Check that the router and ONT or modem have power, make sure cables are firmly connected, then restart the equipment once and allow several minutes to reconnect. If possible, test one device by Ethernet. [Follow the no-internet checklist](${BASE_URL}/help/no-internet-troubleshooting).`,
        ["Tell me my router lights", "Check service status", "Talk to a human"],
      );
    case "router_lights":
      return withOptions(
        `Light labels vary by router and ONT model. A red or unlit **LOS/Optical** light can indicate a fibre signal problem; an Internet light that stays red may indicate authentication or line setup; a Wi-Fi light only shows the local wireless network. Tell me the device model and exact light label before changing settings.`,
        ["My LOS light is red", "My Internet light is red", "Talk to support"],
      );
    case "slow_wifi":
      return withOptions(
        `Slow Wi-Fi is often caused by distance, walls or interference rather than the broadband line. Test by Ethernet first, move the router into the open, use 5GHz near the router and pause large downloads or cloud backups. [Try the slow Wi-Fi fixes](${BASE_URL}/help/slow-wifi-fix).`,
        ["Run a proper speed test", "Improve Wi-Fi coverage", "Talk to support"],
      );
    case "pppoe_missing":
      return withOptions(
        `PPPoE credentials are sensitive. They are normally provided in the OCCTA welcome or go-live information for a compatible own-router setup. Do not post them in chat. If you cannot find them, ask support to resend them through the approved secure channel after account verification.`,
        ["Check my account", "Open own-router guide", "Talk to support"],
      );
    case "router":
      return withOptions(
        `For full fibre, the Ethernet cable runs from the ONT to the router's **WAN/Internet** port. A compatible own router normally uses PPPoE details supplied in the OCCTA welcome or go-live email. Never share those credentials in chat. [Open the own-router guide](${BASE_URL}/help/own-router-setup).`,
        ["My router has a red light", "I cannot find PPPoE details", "Talk to support"],
      );
    case "direct_debit":
      return withOptions(
        `Direct Debit mandates are set up securely and processed through OCCTA's approved payment providers. Never send bank details in chat. Use the secure Direct Debit setup route or contact the billing team if a mandate is pending or rejected. [Direct Debit help](${BASE_URL}/help/direct-debit-setup-help).`,
        ["Set up Direct Debit", "Check my invoice", "Raise a billing ticket"],
      );
    case "first_invoice":
      return withOptions(
        `A first invoice can include the first full billing period plus a part-month amount from activation to the regular billing date, and any clearly disclosed one-off setup or equipment charges. The exact calculation must come from your invoice. [See the first-invoice guide](${BASE_URL}/help/first-invoice-explained-help).`,
        ["Check my latest invoice", "Explain VAT", "Raise a billing ticket"],
      );
    case "vat":
      return withOptions(
        `Residential prices are normally presented including VAT. Business pricing may be shown excluding and including VAT, and the invoice is the definitive tax record. I will not calculate a customer's VAT from a guessed price—use the actual quote or invoice.`,
        ["Check my latest invoice", "Explain my first invoice", "Raise a billing ticket"],
      );
    case "complaints":
      return withOptions(
        `OCCTA first tries to resolve complaints directly. If a complaint remains unresolved, the Complaints Code explains escalation and the applicable independent ADR route and timing. [Read the Complaints Code](${BASE_URL}/legal/complaints-code).`,
        ["Raise a complaint", "Talk to a human", "Read the Complaints Code"],
      );
    case "vulnerable":
      return withOptions(
        `OCCTA can record support needs and discuss appropriate communication or service arrangements. Broadband-based phone services and telecare can be affected by power cuts, so resilience should be discussed before relying on them. [Read the vulnerable-customer policy](${BASE_URL}/legal/vulnerable-customers).`,
        ["Tell OCCTA my support needs", "Ask about battery backup", "Talk to a human"],
      );
    case "human":
      return withOptions(
        `Of course. I can pass the conversation to an OCCTA advisor so you do not have to start again. For urgent service-impacting issues, you can also call **${OCCTA_PHONE}**.`,
        ["Connect me to a human", "Raise a ticket", "Keep troubleshooting"],
      );
    default:
      return null;
  }
}

async function searchKnowledgeBase(serviceClient: any, query: string, includeCustomer: boolean): Promise<string> {
  if (query.trim().length < 3) return "";
  try {
    const { data, error } = await serviceClient.rpc("search_kb_for_ai", {
      _q: query.slice(0, 200),
      _include_customer: includeCustomer,
      _limit: 5,
    });
    if (error || !Array.isArray(data) || !data.length) return "";
    return data.map((row: any) => {
      const excerpt = String(row.summary && row.summary.length > 20 ? row.summary : row.content ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 450)
        .trim();
      const route = row.kind === "blog" ? `/blog/${row.slug}` : row.kind === "guide" ? `/guides/${row.slug}` : `/help/${row.slug}`;
      return `• **${row.title}** — ${excerpt} [Open guide](${BASE_URL}${route})`;
    }).join("\n");
  } catch {
    return "";
  }
}

function knowledgeFallback(kbContext: string): string {
  if (kbContext) {
    return withOptions(
      `I found these approved OCCTA resources that match your question:\n\n${kbContext}\n\nI have not filled in any missing account or commercial details.`,
      ["Open Help Centre", "Ask a more specific question", "Talk to a human"],
    );
  }
  return withOptions(
    `I don't have enough verified information to answer that safely, and I won't make it up. Tell me whether this is about broadband, SIM, Digital Voice, billing, switching or an existing account. You can also contact ${OCCTA_EMAIL} or call ${OCCTA_PHONE}.`,
    ["Broadband help", "Billing help", "Check my account", "Talk to a human"],
  );
}

async function recordAnalytics(
  serviceClient: any,
  sessionId: string,
  userId: string | null,
  userText: string,
  assistantText: string,
  intent: string,
  responseTime: number,
) {
  try {
    await serviceClient.from("chat_analytics").insert([
      {
        session_id: sessionId,
        user_id: userId,
        message_type: "user",
        message_content: redactSensitiveText(userText),
        detected_intent: intent,
        detected_category: intent.startsWith("account_") ? "account" : "support",
        created_at: new Date().toISOString(),
      },
      {
        session_id: sessionId,
        user_id: userId,
        message_type: "assistant",
        message_content: redactSensitiveText(assistantText),
        detected_intent: intent,
        detected_category: intent.startsWith("account_") ? "account" : "support",
        response_time_ms: responseTime,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch {
    // Analytics must never interrupt support.
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const messages = normaliseMessages(body.messages);
    const sessionId = safeSessionId(body.sessionId);
    if (!messages.length) return jsonResponse({ error: "Please send a message." }, 400);

    const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
    if (totalCharacters > 24000) return jsonResponse({ error: "This conversation is too long. Please start a new chat." }, 413);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("server_configuration");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const authUser = await getAuthenticatedUser(serviceClient, request.headers.get("Authorization"));
    const generalRateKey = await digestIdentifier(authUser?.id ?? sessionId);
    const allowed = await checkRateLimit(serviceClient, "occta_companion_message", generalRateKey, 40, 5, false);
    if (!allowed) return jsonResponse({ error: "Please wait a moment before sending another message." }, 429);

    const accountIntent = detectAccountIntent(messages);
    const latestUserText = lastUserText(messages);
    const publicIntent = detectPublicIntent(latestUserText);
    let reply: CompanionReply | null = null;

    if (accountIntent) {
      if (authUser?.id) {
        const scope = await scopeFromSignedInUser(serviceClient, authUser);
        reply = { content: await accountReply(serviceClient, scope, accountIntent), source: "account" };
      } else {
        const claims = await verifyVerification(body.verificationToken, sessionId, serviceRoleKey);
        if (claims) {
          const scope = await scopeFromClaims(serviceClient, claims);
          reply = { content: await accountReply(serviceClient, scope, accountIntent), source: "account" };
        } else {
          const accountNumber = extractAccountNumber(messages);
          const dob = extractDateOfBirth(messages);
          if (!accountNumber) {
            reply = {
              content: withOptions(
                `I can check that securely. What is the OCCTA account number? It starts with **OCC**. Please do not send bank details, passwords or one-time codes.`,
                ["I need help finding it", "Sign in instead", "Talk to a human"],
              ),
              source: "account",
            };
          } else if (!dob) {
            reply = {
              content: withOptions(
                `Thanks — I have account ${maskAccountNumber(accountNumber)}. For a secure check, enter the account holder's date of birth as **DD/MM/YYYY**. It is used only for this verification and is not shown back in chat history.`,
                ["Sign in instead", "Talk to a human"],
              ),
              source: "account",
            };
          } else {
            const verified = await verifyGuestAccount(serviceClient, accountNumber, dob);
            if (!verified) {
              reply = {
                content: withOptions(
                  `I couldn't verify those details. Check the account number and date of birth. For security, I won't say which detail did not match.`,
                  ["Try verification again", "Sign in instead", "Talk to a human"],
                ),
                source: "account",
              };
            } else {
              const verificationToken = await signVerification({
                v: 1,
                sessionId,
                accountNumber: verified.accountNumber ?? accountNumber,
                exp: Math.floor(Date.now() / 1000) + VERIFICATION_TTL_SECONDS,
              }, serviceRoleKey);
              reply = {
                content: await accountReply(serviceClient, verified, accountIntent),
                verificationToken,
                source: "account",
              };
            }
          }
        }
      }
    }

    if (!reply) {
      const approved = approvedPublicReply(publicIntent);
      if (approved) reply = { content: approved, source: "approved_content" };
    }

    if (!reply) {
      const kb = await searchKnowledgeBase(serviceClient, latestUserText, Boolean(authUser?.id));
      reply = { content: knowledgeFallback(kb), source: "knowledge_base" };
    }

    const intentLabel = accountIntent ? `account_${accountIntent}` : publicIntent;
    await recordAnalytics(
      serviceClient,
      sessionId,
      authUser?.id ?? null,
      latestUserText,
      reply.content,
      intentLabel,
      Date.now() - startedAt,
    );

    return jsonResponse({
      content: reply.content,
      role: "assistant",
      verificationToken: reply.verificationToken,
      source: reply.source,
    });
  } catch (error) {
    if ((error as Error).message === "verification_rate_limited") {
      return jsonResponse({
        error: `Too many verification attempts. Please wait 15 minutes or call ${OCCTA_PHONE}.`,
      }, 429);
    }
    console.error("occta-companion error", (error as Error).message);
    return jsonResponse({
      error: `I couldn't load that safely just now. Please try again or call ${OCCTA_PHONE}.`,
    }, 500);
  }
});
