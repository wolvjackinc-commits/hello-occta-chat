import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Download, ExternalLink, LifeBuoy, Loader2, Mail, MessageCircle, PhoneOff, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import {
  detectAccountIntent,
  detectPublicIntent,
  formatDate,
  formatMoney,
  maskAccountNumber,
  maskEmail,
  maskPhone,
  redactSensitiveText,
  type AccountIntent,
  type CompanionMessage as CoreMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  agent?: "ollie" | "human";
};

type LiveState = "off" | "waiting" | "live" | "ended";

type Props = {
  embedded?: boolean;
  className?: string;
  initialOpen?: boolean;
  onClose?: () => void;
};

type JsonObject = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};

const HISTORY_KEY = "occta-live-companion-history-v1";
const SESSION_KEY = "occta-live-companion-session-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const EMAIL_GLOBAL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const guestActions = ["Compare broadband plans", "Fix my internet", "How switching works", "Check my account"];
const signedInActions = ["Check my latest invoice", "Track my order", "Check my services", "Show my support tickets"];

const actionRoutes: Record<string, string> = {
  "check availability": "/build-plan",
  "start an availability check": "/build-plan",
  "view broadband plans": "/broadband",
  "view sim plans": "/sim",
  "open help centre": "/help",
  "open service status": "/status",
  "read cancellation terms": "/cancellation",
  "read the complaints code": "/legal/complaints-code",
  "digital voice information": "/landline",
  "start a switch": "/switching",
  "sign in": "/auth",
  "open my dashboard": "/dashboard",
};

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as JsonObject[] : [];
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function redactForChat(value: string): string {
  return redactSensitiveText(value).replace(EMAIL_GLOBAL_RE, (email) => maskEmail(email));
}

function withOptions(body: string, options: string[]): string {
  return `${body.trim()}\n\n<<<OPTIONS:${JSON.stringify(options.slice(0, 4))}>>>`;
}

function extractOptions(content: string): { body: string; options: string[] } {
  const match = content.match(/<<<OPTIONS:(\[[\s\S]*?\])>>>\s*$/);
  if (!match) return { body: content.trim(), options: [] };
  try {
    const parsed = JSON.parse(match[1]);
    return {
      body: content.replace(match[0], "").trim(),
      options: Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 4) : [],
    };
  } catch {
    return { body: content.replace(match[0], "").trim(), options: [] };
  }
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && (row.role === "user" || row.role === "assistant" || row.role === "system"))
      .slice(-40)
      .map((row) => ({
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        role: row.role,
        content: redactForChat(String(row.content ?? "")),
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        agent: row.agent === "human" ? "human" : "ollie",
      }));
  } catch {
    sessionStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

function publicReply(intent: string): string | null {
  switch (intent) {
    case "broadband":
      return withOptions(
        "OCCTA keeps broadband simple: **Essential Fibre** up to 80Mbps, **Superfast Fibre** up to 330Mbps, and **Ultrafast Fibre** up to 1,000Mbps where the address supports it. You can choose **Flex 30** for flexibility or **Price Lock 24** for a longer fixed-term option. I won't guess the speed or price at your address — the availability checker confirms that before you order.",
        ["Check availability", "Which speed do I need?", "Compare Flex and Price Lock"],
      );
    case "contract_choice":
      return withOptions(
        "**Flex 30** is for customers who value flexibility. **Price Lock 24** is a 24-month option aimed at price certainty and better long-term value. The right one depends on how long you expect to stay and whether flexibility or certainty matters more.",
        ["Check availability", "View broadband plans", "Which speed do I need?"],
      );
    case "speed_need":
      return withOptions(
        "For browsing, email and a couple of HD streams, up to **80Mbps** can be enough. Several people streaming, gaming and video-calling usually benefit from **150–330Mbps**. Heavy households, creators and big downloads can benefit from **500–1,000Mbps** where available. Wi‑Fi quality matters too, not just the headline speed.",
        ["Check availability", "Fix slow Wi-Fi", "View broadband plans"],
      );
    case "sim":
    case "esim":
      return withOptions(
        "For SIMs I use OCCTA's current catalogue rather than quoting an old allowance or offer. Network, data, roaming and eSIM availability can vary by plan, so the live SIM page is the source of truth.",
        ["View SIM plans", "Open Help Centre", "Talk to a human"],
      );
    case "voice":
      return withOptions(
        "OCCTA Digital Home Phone works through broadband. It is a broadband add-on or bundle, not a standalone traditional copper landline. Keeping an existing number is often possible, but it must be confirmed for the specific order.",
        ["Digital Voice information", "Can I keep my number?", "Check availability"],
      );
    case "switching":
    case "number_porting":
      return withOptions(
        "For eligible UK fixed-line switches, the new provider normally manages the One Touch Switch process. Number transfer depends on the services involved, so OCCTA confirms it against the actual order rather than promising it blindly.",
        ["Start a switch", "Check availability", "Talk to a human"],
      );
    case "no_internet":
      return withOptions(
        "Let's work out whether this is Wi‑Fi or the broadband line. Check power to the router and ONT/modem, reseat the cables, restart the equipment once, then allow several minutes to reconnect. If you can, test one device by Ethernet. If the line is still down, I can hand this to support with the context attached.",
        ["Open service status", "My router has a red light", "Talk to a human"],
      );
    case "slow_wifi":
      return withOptions(
        "Slow Wi‑Fi is often a coverage problem rather than a slow line. Test by Ethernet first, keep the router in the open, use 5GHz near the router, and pause large downloads or cloud backups during the test. That tells us whether the issue is the line or the wireless signal.",
        ["Open Help Centre", "Check my services", "Talk to a human"],
      );
    case "router":
    case "router_lights":
    case "pppoe_missing":
      return withOptions(
        "On full fibre, the ONT connects by Ethernet to the router's **WAN/Internet** port. If you use your own router, never paste PPPoE credentials into chat. If a red/LOS light remains after one restart and checking cables, treat it as a possible service fault and contact support.",
        ["Open Help Centre", "Open service status", "Talk to a human"],
      );
    case "direct_debit":
      return withOptions(
        "Direct Debit details should only be entered through OCCTA's secure payment flow — never in chat. If you're signed in, I can check the **masked mandate status** shown on your account; I will never display a full sort code or bank account number.",
        ["Check my Direct Debit", "Check my latest invoice", "Talk to a human"],
      );
    case "first_invoice":
    case "vat":
      return withOptions(
        "A first invoice can include the first full billing period, a part-month amount from activation to the regular billing date, and any clearly disclosed one-off items. I won't calculate it from a guessed plan price. If you're signed in, I can read the actual invoice on your account.",
        ["Check my latest invoice", "Open my dashboard", "Talk to a human"],
      );
    case "cancellation":
      return withOptions(
        "Cancellation depends on the plan you actually chose. Flex 30 uses its stated flexible notice terms; Price Lock 24 has a fixed minimum term and early termination charges may apply. For an account-specific answer, sign in so I can use the contract data rather than guess.",
        ["Read cancellation terms", "Check my account", "Talk to a human"],
      );
    case "complaints":
      return withOptions(
        "OCCTA will try to resolve a complaint directly first. The Complaints Code explains the escalation process and independent ADR route. I can also pass this conversation to an advisor so you don't need to repeat the issue.",
        ["Read the Complaints Code", "Talk to a human", "Open Help Centre"],
      );
    case "service_status":
      return withOptions(
        "The service-status page is the right place for a current network notice. For a fault affecting only your line, sign in and I can check the service/order information linked to your account.",
        ["Open service status", "Check my services", "Talk to a human"],
      );
    case "human":
      return withOptions(
        `Of course. I can pass the conversation to an OCCTA advisor with the chat context attached. For an urgent service-impacting issue you can also call **${CONTACT_PHONE_DISPLAY}**.`,
        ["Talk to a human", "Keep troubleshooting"],
      );
    default:
      return null;
  }
}

function accountReply(intent: AccountIntent, overviewValue: unknown): string {
  const overview = asObject(overviewValue);
  const profile = asObject(overview.profile);
  const order = asObject(overview.order);
  const service = asObject(overview.service);
  const dd = asObject(overview.direct_debit);
  const invoices = asObjects(overview.invoices);
  const receipts = asObjects(overview.receipts);
  const documents = asObject(overview.documents);
  const errors = Array.isArray(overview.section_errors) ? overview.section_errors.map(String) : [];
  const firstName = textValue(profile.full_name)?.split(/\s+/)[0] ?? "there";
  const partialWarning = errors.length ? "\n\nOne account section is temporarily unavailable, so I have not filled in anything from memory." : "";

  if (intent === "overview") {
    return withOptions(
      `Hi ${firstName} — I've checked your signed-in OCCTA account.\n\n**Account:** ${maskAccountNumber(textValue(profile.account_number) ?? textValue(overview.account_number))}\n**Email:** ${maskEmail(textValue(profile.email))}\n**Phone:** ${maskPhone(textValue(profile.phone))}\n**Latest order:** ${textValue(order.lifecycle_status) ?? textValue(order.status) ?? "none shown"}\n**Service:** ${textValue(service.status) ?? "none shown"}${partialWarning}`,
      ["Check my latest invoice", "Track my order", "Check my services", "Check my Direct Debit"],
    );
  }

  if (intent === "invoices") {
    if (!invoices.length) return withOptions("I checked your signed-in account and there isn't an invoice available yet.", ["Track my order", "Open my dashboard", "Talk to a human"]);
    const lines = invoices.slice(0, 5).map((invoice) => `• **${textValue(invoice.invoice_number) ?? "Invoice"}** — ${formatMoney(invoice.total)} — ${textValue(invoice.status) ?? "status unavailable"} — due ${formatDate(invoice.due_date)}`);
    return withOptions(`Here are the latest invoices on your account:\n\n${lines.join("\n")}\n\nFor the complete document, open **Dashboard → Billing**.${partialWarning}`, ["Open my dashboard", "Explain my first invoice", "Talk to a human"]);
  }

  if (intent === "orders" || intent === "installation") {
    if (!Object.keys(order).length) return withOptions("I checked your account but there isn't an order record available yet.", ["Check my services", "Open my dashboard", "Talk to a human"]);
    const ref = textValue(order.occta_order_number);
    const maskedRef = ref && ref.length > 7 ? `${ref.slice(0, 3)}••••${ref.slice(-4)}` : "reference available in your dashboard";
    const start = textValue(order.actual_activation_date) ?? textValue(order.preferred_start_date) ?? textValue(order.expected_activation_date);
    return withOptions(
      `Your latest order is **${maskedRef}**.\n\n**Plan:** ${textValue(order.plan_name) ?? textValue(order.service_type) ?? "not shown"}\n**Status:** ${textValue(order.lifecycle_status) ?? textValue(order.status) ?? "not shown"}\n**Activation/start:** ${start ? formatDate(start) : "not confirmed yet"}${partialWarning}`,
      ["Check my services", "Open my dashboard", "Talk to a human"],
    );
  }

  if (intent === "services") {
    if (!Object.keys(service).length) return withOptions("I can't see a live service record on the account yet. If you've just ordered, check the order status instead.", ["Track my order", "Open my dashboard", "Talk to a human"]);
    return withOptions(
      `Your latest service record shows:\n\n**Service:** ${textValue(service.plan_name) ?? textValue(service.service_type) ?? "not shown"}\n**Status:** ${textValue(service.status) ?? "not shown"}\n**Monthly price:** ${service.monthly_price != null ? formatMoney(service.monthly_price) : "not shown"}\n**Activation:** ${textValue(service.activation_date) ? formatDate(service.activation_date) : "not shown"}${partialWarning}`,
      ["Track my order", "Check my latest invoice", "Open my dashboard"],
    );
  }

  if (intent === "documents") {
    const summary = asObject(documents.contract_summary);
    const certificate = asObject(documents.acceptance_certificate);
    const lines: string[] = [];
    if (Object.keys(summary).length) lines.push(`• Contract Summary **${textValue(summary.cs_number) ?? "on file"}** — ${textValue(summary.plan_name) ?? "service"}`);
    if (Object.keys(certificate).length) lines.push(`• Acceptance certificate **${textValue(certificate.certificate_number) ?? "on file"}**`);
    receipts.slice(0, 3).forEach((receipt) => lines.push(`• Receipt — ${formatMoney(receipt.amount)} — ${formatDate(receipt.paid_at)}`));
    return withOptions(lines.length ? `These secure records are listed on your account:\n\n${lines.join("\n")}\n\nOpen your dashboard to view the actual files.` : "I can't see a contract document or receipt on the account yet.", ["Open my dashboard", "Check my latest invoice", "Talk to a human"]);
  }

  return withOptions("Your account is securely signed in. Tell me whether you want me to check the invoice, order, service, Direct Debit or documents.", ["Check my latest invoice", "Track my order", "Check my services", "Check my Direct Debit"]);
}

function directDebitReply(overviewValue: unknown): string {
  const overview = asObject(overviewValue);
  const dd = asObject(overview.direct_debit);
  const method = asObject(overview.payment_method);
  if (!Object.keys(dd).length && !Object.keys(method).length) {
    return withOptions("I checked your account and there isn't a Direct Debit mandate status available yet. I won't infer one from an order or invoice.", ["Open my dashboard", "Check my latest invoice", "Talk to a human"]);
  }
  const status = textValue(dd.status) ?? textValue(method.dd_setup_status) ?? "status unavailable";
  const last4 = textValue(dd.masked_account_last4) ?? textValue(method.last4);
  return withOptions(`Your **masked Direct Debit status** is **${status.replace(/_/g, " ")}**${last4 ? `, for the account ending **${last4}**` : ""}. I do not display or request full bank details in chat.`, ["Check my latest invoice", "Open my dashboard", "Talk to a human"]);
}

async function searchKnowledge(query: string): Promise<string> {
  try {
    const client = supabase as unknown as RpcClient;
    const { data, error } = await client.rpc("search_public_kb", { _q: query.slice(0, 180), _kind: null, _limit: 4 });
    if (error || !Array.isArray(data) || !data.length) return "";
    const lines = data.slice(0, 4).map((row) => {
      const item = asObject(row);
      const kind = textValue(item.kind) ?? "help";
      const slug = textValue(item.slug) ?? "";
      const route = kind === "blog" ? `/blog/${slug}` : kind === "guide" ? `/guides/${slug}` : `/help/${slug}`;
      const summary = textValue(item.summary) ?? "Approved OCCTA help article";
      return `• **${textValue(item.title) ?? "OCCTA help"}** — ${summary.slice(0, 220)} [Open](${route})`;
    });
    return withOptions(`I found these approved OCCTA resources that match your question:\n\n${lines.join("\n")}\n\nI haven't filled in any missing commercial or account detail.`, ["Open Help Centre", "Talk to a human"]);
  } catch {
    return "";
  }
}

export default function OcctaCompanionLive({ embedded = false, className = "", initialOpen = false, onClose }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(embedded || initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | undefined>();
  const [awaitingAccountEmail, setAwaitingAccountEmail] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveState>("off");
  const [emailingTranscript, setEmailingTranscript] = useState(false);
  const [transcriptEmail, setTranscriptEmail] = useState("");
  const pollSince = useRef<string>(new Date().toISOString());
  const sessionId = useRef(getSessionId());
  const endRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(userId);
  const quickActions = useMemo(() => signedIn ? signedInActions : guestActions, [signedIn]);

  const addAssistant = useCallback((content: string, agent: "ollie" | "human" = "ollie") => {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: redactForChat(content), createdAt: new Date().toISOString(), agent }]);
  }, []);

  const addSystem = useCallback((content: string) => {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "system", content, createdAt: new Date().toISOString() }]);
  }, []);

  useEffect(() => {
    const initialise = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
      const name = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name;
      setFirstName(typeof name === "string" ? name.split(/\s+/)[0] : undefined);
      if (messages.length === 0) {
        addAssistant(session?.user ? `Welcome back${typeof name === "string" ? `, ${name.split(/\s+/)[0]}` : ""}. I'm Ollie from OCCTA. I can check your real account data or help solve a service question.` : "Hi, I'm Ollie from OCCTA. I can help with broadband, SIMs, switching and faults. For personal account information, I'll use a secure sign-in rather than asking for sensitive details in chat.");
      }
    };
    void initialise();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      const name = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name;
      setFirstName(typeof name === "string" ? name.split(/\s+/)[0] : undefined);
      if (!session) setAwaitingAccountEmail(false);
    });
    return () => subscription.unsubscribe();
  }, [addAssistant]);

  useEffect(() => {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40).map((message) => ({ ...message, content: redactForChat(message.content) }))));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While a human session is open (waiting or live) poll for advisor activity and
  // status changes. Polling works for both signed-in and guest visitors.
  useEffect(() => {
    if (!conversationId) return;
    if (liveState !== "waiting" && liveState !== "live") return;
    let cancelled = false;

    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("chat-handoff", {
          body: { sessionId: sessionId.current, mode: "poll", since: pollSince.current },
        });
        if (error || cancelled || !data) return;
        const rows = Array.isArray(data.messages) ? data.messages as Array<{ role?: string; content?: string; created_at?: string }> : [];
        if (typeof data.serverTime === "string") pollSince.current = data.serverTime;
        const advisorJoined = data.status === "live" || data.assigned === true;
        if (advisorJoined && liveState === "waiting") {
          setLiveState("live");
          addSystem("An OCCTA advisor has joined the chat. Ollie has stepped aside.");
        }
        rows.forEach((row) => {
          if (!row.content) return;
          if (row.role === "admin") addAssistant(row.content, "human");
          else if (row.role === "system") addSystem(row.content);
        });
        if (data.status === "resolved" || data.status === "closed") {
          setLiveState("ended");
          addSystem("The advisor has ended this chat. You can download or email a copy of the transcript below.");
        }
      } catch { /* transient network issue — retry on next tick */ }
    };

    void tick();
    const timer = window.setInterval(() => { void tick(); }, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [conversationId, liveState, addAssistant, addSystem]);

  const handoff = useCallback(async () => {
    setLoading(true);
    try {
      const transcript = messages.slice(-16).map((message) => ({ role: message.role, content: redactForChat(message.content) }));
      const { data, error } = await supabase.functions.invoke("chat-handoff", {
        body: {
          sessionId: sessionId.current,
          reason: "requested_human",
          summary: redactForChat(messages.find((message) => message.role === "user")?.content ?? "Customer requested an advisor"),
          transcript,
        },
      });
      if (error) throw error;
      if (data?.conversationId) setConversationId(String(data.conversationId));
      pollSince.current = new Date().toISOString();
      setLiveState("waiting");
      addSystem(`We're assigning an OCCTA advisor to your chat. Ollie has stopped replying so nothing crosses over — your conversation has been passed across with sensitive details redacted. For an urgent service-impacting issue, call ${CONTACT_PHONE_DISPLAY}.`);
    } catch {
      addAssistant(`I couldn't open the live handoff just now. Please call ${CONTACT_PHONE_DISPLAY} and the team will help.`);
    } finally {
      setLoading(false);
    }
  }, [messages, addAssistant, addSystem]);

  const endChat = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("chat-handoff", { body: { sessionId: sessionId.current, mode: "end" } });
      setLiveState("ended");
      addSystem("You ended the chat. You can download or email a copy of the transcript below.");
    } catch {
      toast({ title: "Couldn't end the chat", description: "Please try again in a moment.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [addSystem, toast]);

  const transcriptText = useCallback(() => (
    messages
      .map((message) => {
        const who = message.role === "user" ? "You" : message.role === "system" ? "System" : message.agent === "human" ? "OCCTA advisor" : "Ollie (OCCTA Assist)";
        return `[${new Date(message.createdAt).toLocaleString("en-GB")}] ${who}: ${extractOptions(message.content).body}`;
      })
      .join("\n\n")
  ), [messages]);

  const downloadTranscript = useCallback(() => {
    const blob = new Blob([`OCCTA chat transcript\nSession ${sessionId.current}\n\n${transcriptText()}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `occta-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [transcriptText]);

  const emailTranscript = useCallback(async () => {
    const email = transcriptEmail.trim();
    if (!signedIn && !EMAIL_RE.test(email)) {
      toast({ title: "Enter a valid email", description: "We need a valid email address to send your transcript.", variant: "destructive" });
      return;
    }
    setEmailingTranscript(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-handoff", {
        body: { sessionId: sessionId.current, mode: "email_transcript", customerEmail: email || undefined },
      });
      if (error || data?.error) throw new Error(String(data?.error ?? "email_failed"));
      toast({ title: "Transcript sent", description: "Check your inbox for a copy of this chat." });
    } catch {
      toast({ title: "Couldn't email the transcript", description: "Please download it instead, or contact support.", variant: "destructive" });
    } finally {
      setEmailingTranscript(false);
    }
  }, [transcriptEmail, signedIn, toast]);

  const claimAccount = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("claim-dashboard-link", { body: { email } });
      if (error) throw error;
      addAssistant(withOptions(`If **${maskEmail(email)}** matches an OCCTA customer record, we've sent a secure account-access email. For privacy, I won't confirm here whether that email exists in our records.`, ["Sign in", "Open Help Centre", "Talk to a human"]));
    } catch {
      addAssistant(withOptions("I couldn't send the secure account-access email just now. Please try again later or speak to an advisor.", ["Talk to a human", "Open Help Centre"]));
    } finally {
      setAwaitingAccountEmail(false);
      setLoading(false);
    }
  }, [addAssistant]);

  const loadOverview = useCallback(async (): Promise<unknown> => {
    const client = supabase as unknown as RpcClient;
    const { data, error } = await client.rpc("get_my_customer_overview");
    if (error) throw new Error(error.message ?? "overview_failed");
    return data;
  }, []);

  const loadTickets = useCallback(async () => {
    if (!userId) return withOptions("Support-case details require sign-in.", ["Sign in", "Talk to a human"]);
    const { data, error } = await supabase.from("support_tickets").select("subject,status,priority,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(6);
    if (error) return withOptions("I couldn't load the support-case list just now, so I won't guess its status.", ["Open my dashboard", "Talk to a human"]);
    if (!data?.length) return withOptions("There are no support cases on your account at the moment.", ["Open my dashboard", "Talk to a human"]);
    const lines = data.map((ticket) => `• **${ticket.subject}** — ${String(ticket.status).replace(/_/g, " ")} — opened ${formatDate(ticket.created_at)}`);
    return withOptions(`Here are your recent support cases:\n\n${lines.join("\n")}`, ["Open my dashboard", "Talk to a human"]);
  }, [userId]);

  const answer = useCallback(async (raw: string, conversation: ChatMessage[]) => {
    const lower = raw.toLowerCase();

    if (awaitingAccountEmail && !signedIn) {
      if (!EMAIL_RE.test(raw)) {
        addAssistant(withOptions("Please enter the email address used with OCCTA. I won't ask you for a password, bank details or one-time code.", ["Sign in", "Talk to a human"]));
        return;
      }
      await claimAccount(raw);
      return;
    }

    if (/^(talk to a human|connect me to a human|human|advisor|speak to support)$/i.test(raw)) {
      await handoff();
      return;
    }

    if (/^(check my direct debit|direct debit status|my direct debit)$/i.test(raw) && signedIn) {
      try {
        addAssistant(directDebitReply(await loadOverview()));
      } catch {
        addAssistant(withOptions("I couldn't load your Direct Debit status safely just now.", ["Open my dashboard", "Talk to a human"]));
      }
      return;
    }

    if (/support tickets?|support cases?|my tickets?/i.test(lower) && signedIn) {
      addAssistant(await loadTickets());
      return;
    }

    const coreMessages: CoreMessage[] = conversation
      .filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }));
    const accountIntent = detectAccountIntent(coreMessages);

    if (accountIntent) {
      if (!signedIn) {
        setAwaitingAccountEmail(true);
        addAssistant(withOptions("For personal account information, I use secure account access rather than asking for date of birth or payment details in chat. Enter the **email address used with OCCTA** and I'll send the secure sign-in link if it matches our records.", ["Sign in", "Talk to a human"]));
        return;
      }
      try {
        addAssistant(accountReply(accountIntent, await loadOverview()));
      } catch {
        addAssistant(withOptions("I securely recognised your sign-in, but I couldn't load the account section just now. I won't substitute stale or guessed information.", ["Open my dashboard", "Talk to a human"]));
      }
      return;
    }

    const publicIntent = detectPublicIntent(raw);
    const approved = publicReply(publicIntent);
    if (approved) {
      addAssistant(approved);
      return;
    }

    const kb = await searchKnowledge(raw);
    addAssistant(kb || withOptions("I don't have enough verified information to answer that reliably, so I won't make it up. Ask me about broadband, SIM, Digital Voice, billing, switching or your signed-in account — or I can pass you to an advisor.", ["Open Help Centre", "Talk to a human", "Check my account"]));
  }, [awaitingAccountEmail, signedIn, addAssistant, claimAccount, handoff, loadOverview, loadTickets]);

  const send = useCallback(async (value: string) => {
    const raw = value.trim();
    if (!raw || loading) return;

    // A human advisor owns this conversation (or one is being assigned):
    // relay the message to the advisor and never let Ollie answer.
    if (liveState === "waiting" || liveState === "live") {
      const safe = redactForChat(raw);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: safe, createdAt: new Date().toISOString() }]);
      setInput("");
      try {
        await supabase.functions.invoke("chat-handoff", { body: { sessionId: sessionId.current, mode: "customer_message", message: safe } });
      } catch {
        toast({ title: "Message not delivered", description: "Please try sending that again.", variant: "destructive" });
      }
      return;
    }

    const route = actionRoutes[raw.toLowerCase()];
    if (route) {
      window.location.assign(route);
      return;
    }
    if (/^(talk to a human|connect me to a human)$/i.test(raw)) {
      await handoff();
      return;
    }

    const safeDisplay = redactForChat(raw);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: safeDisplay, createdAt: new Date().toISOString() };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      await answer(raw, next);
    } catch {
      addAssistant(withOptions(`Something went wrong while checking that. I haven't guessed an answer. Please try again or call ${CONTACT_PHONE_DISPLAY}.`, ["Try again", "Talk to a human"]));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, answer, addAssistant, handoff, liveState, toast]);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  if (!embedded && !open) {
    return (
      <button onClick={() => setOpen(true)} className={`fixed bottom-4 right-4 z-[9999] rounded-full border-2 border-foreground bg-primary p-4 text-primary-foreground shadow-[4px_4px_0_hsl(var(--foreground))] ${className}`} aria-label="Open Ollie, OCCTA customer support">
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className={embedded ? className : "fixed inset-x-3 bottom-3 z-[9999] sm:left-auto sm:right-4 sm:w-[430px]"}>
      <div className="overflow-hidden rounded-xl border-2 border-foreground bg-background shadow-[6px_6px_0_hsl(var(--foreground))]">
        <div className="flex items-center justify-between border-b-2 border-foreground bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="rounded-full border-2 border-primary-foreground/80 p-2"><Bot className="h-5 w-5" /></div>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wide">Ollie — OCCTA Assist</div>
              <div className="flex items-center gap-1 text-xs opacity-90"><ShieldCheck className="h-3.5 w-3.5" /> Verified-data support · no AI guessing</div>
            </div>
          </div>
          {!embedded && <button onClick={close} className="rounded p-1 hover:bg-primary-foreground/10" aria-label="Close chat"><X className="h-5 w-5" /></button>}
        </div>

        <ScrollArea className="h-[430px] bg-muted/20 p-4">
          <div className="space-y-4 pr-2">
            {messages.map((message) => {
              const parsed = extractOptions(message.content);
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-foreground/30 bg-background">{message.agent === "human" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>}
                  <div className={`max-w-[84%] rounded-lg border px-3 py-2 text-sm ${isUser ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 bg-background"}`}>
                    {isUser ? <div className="whitespace-pre-wrap">{parsed.body}</div> : <Streamdown className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-li:my-0 prose-a:text-primary">{parsed.body}</Streamdown>}
                    {!isUser && parsed.options.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-foreground/10 pt-2">
                        {parsed.options.map((option) => <button key={option} onClick={() => void send(option)} className="rounded-md border border-foreground/30 bg-background px-2 py-1 text-left text-xs font-medium hover:bg-muted">{option}</button>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Ollie is checking the verified source…</div>}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="border-t-2 border-foreground bg-background p-3">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {quickActions.map((action) => <button key={action} onClick={() => void send(action)} className="whitespace-nowrap rounded-full border border-foreground/30 px-3 py-1.5 text-xs hover:bg-muted">{action}</button>)}
          </div>
          <div className="flex gap-2">
            <Input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder={signedIn ? `Ask about your OCCTA account${firstName ? `, ${firstName}` : ""}…` : "Ask Ollie about OCCTA…"} disabled={loading} aria-label="Message Ollie" />
            <Button onClick={() => void send(input)} disabled={loading || !input.trim()} size="icon" aria-label="Send message"><Send className="h-4 w-4" /></Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><LifeBuoy className="h-3 w-3" /> Human handoff available</span>
            <a href="/help" className="flex items-center gap-1 hover:text-foreground">Help Centre <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
