import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  FileText,
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  TicketPlus,
  UserRound,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { RaiseTicketDialog, type TicketPrefill } from "@/components/app/RaiseTicketDialog";
import {
  maskEmail,
  redactSensitiveText,
  type CompanionMessage as CoreMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";
import {
  expandedAccountIntent,
  expandedPublicIntent,
  guideLinksMarkdown,
  matchOcctaGuides,
  normaliseOcctaText,
} from "../../../supabase/functions/_shared/occtaResolution.ts";
import {
  isExplicitHumanRequest,
  resolveIntelligentPublicReply,
  secureAccessLinkSentReply,
  verificationFailureFallback,
} from "@/lib/chat/ollieIntelligence";

type Attachment = {
  path: string;
  name: string;
  size?: number;
  contentType?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawContent?: string;
  createdAt: string;
  agent?: "ollie" | "human";
  attachments?: Attachment[];
};

type Props = {
  embedded?: boolean;
  className?: string;
  initialOpen?: boolean;
  onClose?: () => void;
};

type VerificationMemory = {
  accountNumber?: string;
  dob?: string;
};

const COMPANION_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/occta-companion`;
const HISTORY_KEY = "occta-companion-v4-history";
const SESSION_KEY = "occta-companion-session-v1";
const VERIFICATION_KEY = "occta-companion-verification-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const EMAIL_GLOBAL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ACCOUNT_RE = /\bOCC[A-Z0-9]{6,12}\b/i;
const UK_DOB_RE = /\b(?:[0-2]?\d|3[01])[./-](?:0?\d|1[0-2])[./-](?:19|20)\d{2}\b/;
const ISO_DOB_RE = /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])\b/;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "pptx"]);

const routes: Record<string, string> = {
  "open help centre": "/help",
  "search help centre": "/help",
  "browse occta guides": "/help",
  "check availability": "/order",
  "check broadband availability": "/order",
  "open availability checker": "/order",
  "check my address": "/order",
  "view broadband plans": "/broadband",
  "compare broadband options": "/broadband",
  "view sim plans": "/sim",
  "open service status": "/status",
  "check service status": "/status",
  "open own-router guide": "/help/own-router-setup",
  "open router guide": "/help/router-setup",
  "open no-internet guide": "/help/no-internet-troubleshooting",
  "open slow wi-fi guide": "/help/slow-wifi-fix",
  "open billing guide": "/help/billing",
  "open direct debit guide": "/help/direct-debit-setup-help",
  "open first invoice guide": "/help/first-invoice-explained-help",
  "open digital voice guide": "/help/digital-voice-setup",
  "open sign in": "/auth",
  "sign in": "/auth",
  "open my dashboard": "/dashboard",
  "open about occta": "/about",
  "read cancellation terms": "/cancellation",
  "open cancellation information": "/cancellation",
  "read the complaints code": "/legal/complaints-code",
  "digital voice information": "/landline",
  "start a switch": "/switching",
  "set up direct debit": "/dd/setup",
  "pay invoice": "/pay-invoice",
};

const guestQuick = ["Check broadband availability", "Fix my internet", "Browse OCCTA guides"];
const signedQuick = ["Check my latest invoice", "Track my order", "Check my services"];

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function redact(value: string): string {
  return redactSensitiveText(value)
    .replace(EMAIL_GLOBAL_RE, (email) => maskEmail(email))
    .replace(/\[date of birth provided securely\]/g, "Date of birth provided securely")
    .replace(/\[bank details removed\]/g, "Bank details removed")
    .replace(/\[payment number removed\]/g, "Payment number removed");
}

function isAllowedOcctaUrl(value: string): boolean {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "occta.co.uk" || host === "www.occta.co.uk");
  } catch {
    return false;
  }
}

/** Customer chat must never surface third-party links. Keep the label/text, remove the destination. */
function occtaOnlyLinks(markdown: string): string {
  const withoutExternalMarkdown = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_match, label: string, url: string) => {
    return isAllowedOcctaUrl(url) ? `[${label}](${url})` : label;
  });
  return withoutExternalMarkdown.replace(/https?:\/\/[^\s)\]]+/gi, (url) => isAllowedOcctaUrl(url) ? url : "");
}

function safeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const path = typeof row.path === "string" ? row.path.slice(0, 500) : "";
    if (!path) return [];
    return [{
      path,
      name: typeof row.name === "string" ? row.name.replace(/[\r\n]/g, " ").slice(0, 180) : "Attachment",
      size: Number.isFinite(Number(row.size)) ? Number(row.size) : undefined,
      contentType: typeof row.contentType === "string" ? row.contentType.slice(0, 160) : undefined,
    }];
  });
}

function safeHistory(messages: Message[]): Message[] {
  return messages.slice(-48).map((message) => ({
    ...message,
    content: redact(occtaOnlyLinks(message.content)),
    rawContent: undefined,
    attachments: safeAttachments(message.attachments),
  }));
}

function loadHistory(): Message[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? safeHistory(parsed) : [];
  } catch {
    sessionStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

function welcome(signedIn: boolean, name?: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: signedIn
      ? `Hi${name ? ` ${name}` : ""} — I'm Ollie. Tell me what you need. I can use your signed-in OCCTA account, troubleshoot broadband step by step, and send you the right OCCTA guide or how-to page.`
      : `Hi — I'm Ollie from OCCTA. Tell me what you need in normal words. I’ll try to solve it here first and link only to OCCTA pages. If you’re still not satisfied, you can speak to an OCCTA advisor without starting again.`,
    createdAt: new Date().toISOString(),
    agent: "ollie",
  };
}

function parseOptions(content: string): { body: string; options: string[] } {
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

function humanOption(value: string): boolean {
  return /\b(?:human|advisor|agent|call support|talk to support|contact support)\b/i.test(value);
}

function customerDissatisfied(messages: Message[]): boolean {
  return messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .some((message) => /\b(?:still|again|already|tried|not fixed|not working|wrong|not right|not helpful|not satisfied|useless|same problem|same issue|doesn['’]?t work|didn['’]?t work|you keep|i told you)\b/i.test(message.rawContent ?? message.content));
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toCore(messages: Message[]): CoreMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-24)
    .map((message) => ({ role: message.role, content: message.rawContent ?? message.content }));
}

function canonicalAccountMessage(intent: ReturnType<typeof expandedAccountIntent>): string | null {
  switch (intent) {
    case "invoices": return "Check my latest invoice and amount due";
    case "orders": return "Track my order";
    case "installation": return "Check my installation and activation";
    case "services": return "Check my services";
    case "tickets": return "Show my support tickets";
    case "documents": return "Show my documents";
    case "overview": return "Check my account overview";
    default: return null;
  }
}

function captureVerification(raw: string, memory: VerificationMemory): void {
  const account = raw.match(ACCOUNT_RE)?.[0];
  if (account) memory.accountNumber = account.toUpperCase();
  const dob = raw.match(UK_DOB_RE)?.[0] ?? raw.match(ISO_DOB_RE)?.[0];
  if (dob) memory.dob = dob;
}

function appendGuides(answer: string, query: string, intent: string): string {
  if (/occta\.co\.uk\/help\//i.test(answer)) return answer;
  const guides = guideLinksMarkdown(query, intent, 2);
  if (!guides) return answer;
  return `${answer.trim()}\n\n**Relevant OCCTA guide${guides.includes("\n") ? "s" : ""}:**\n${guides}`;
}

function internalFallback(query: string, intent: string): string {
  const guides = matchOcctaGuides(query, intent, 3);
  if (guides.length) {
    return `I found OCCTA help pages that match what you’re trying to do:\n\n${guides.map((guide) => `• [**${guide.title} →**](https://www.occta.co.uk/help/${guide.slug})`).join("\n")}\n\nTell me what you see or which step you’re stuck on and I’ll continue from there.\n\n<<<OPTIONS:["Browse OCCTA guides","I'm still stuck"]>>>`;
  }
  return `I haven’t matched that to the right OCCTA answer yet. Tell me **what you’re trying to do** or **what is not working** in one sentence and I’ll narrow it down without sending you to unrelated pages.\n\n[**Browse the OCCTA Help Centre →**](https://www.occta.co.uk/help)\n\n<<<OPTIONS:["Broadband problem","Account or bill question","Browse OCCTA guides"]>>>`;
}

function availabilityReply(query: string): string {
  const place = /huddersfield/i.test(query) ? " in Huddersfield" : "";
  return `OCCTA broadband availability${place} is checked **address by address**. I don’t want to tell you an entire town is covered when one street can differ from another.\n\n[**Check your postcode and address on OCCTA →**](https://www.occta.co.uk/order)\n\nIf you enter your postcode there, the availability journey can show what can actually be supplied at that property.\n\n<<<OPTIONS:["Check broadband availability","View broadband plans"]>>>`;
}

function providerComparisonReply(query: string): string {
  const value = normaliseOcctaText(query);
  const provider = value.match(/\b(bt|sky|virgin(?: media)?|talktalk|plusnet|vodafone|ee|zen)\b/)?.[0]?.toUpperCase() || "another provider";
  return `OCCTA is **not automatically faster or slower than ${provider} everywhere**. The useful comparison is the actual broadband technology and speed available at your address, not the company name alone.\n\nOCCTA offers broadband tiers up to **1,000Mbps where available**, but your address check is what confirms the real option.\n\n[**Check your OCCTA availability →**](https://www.occta.co.uk/order)\n[**See OCCTA broadband options →**](https://www.occta.co.uk/broadband)\n\n<<<OPTIONS:["Check broadband availability","Help me choose a speed"]>>>`;
}

function buildTicketPrefill(messages: Message[]): TicketPrefill {
  const userText = messages.filter((m) => m.role === "user").map((m) => redact(m.content)).join(" ").toLowerCase();
  const category = /invoice|bill|charge|vat|refund/.test(userText)
    ? "billing"
    : /payment|direct debit|card/.test(userText)
      ? "payments"
      : /sim|mobile|roaming/.test(userText)
        ? "mobile"
        : /landline|digital voice|home phone/.test(userText)
          ? "landline"
          : /account|login|dashboard|profile/.test(userText)
            ? "account"
            : /broadband|internet|router|wi-?fi|fibre/.test(userText)
              ? "broadband"
              : "other";
  const priority: TicketPrefill["priority"] = /no internet|outage|line down|urgent|still.*refund/.test(userText) ? "high" : "normal";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "Support request from Ollie chat";
  const transcript = messages.slice(-20).map((m) => `${m.role === "user" ? "Customer" : m.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redact(m.content)}`).join("\n\n");
  return {
    category,
    priority,
    subject: redact(lastUser).replace(/\s+/g, " ").slice(0, 110),
    message: `Please review the issue discussed with Ollie.\n\n${transcript.slice(-1800)}`,
    transcript: transcript.slice(-7000),
  };
}

function AssistantMessage({ message, allowHuman, onAction, onAttachment }: {
  message: Message;
  allowHuman: boolean;
  onAction: (value: string) => void;
  onAttachment: (attachment: Attachment) => void;
}) {
  const { body, options } = parseOptions(occtaOnlyLinks(message.content));
  const visibleOptions = allowHuman ? options : options.filter((option) => !humanOption(option));
  return (
    <div className="space-y-3">
      {body && (
        <Streamdown className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-li:my-0 prose-a:text-primary prose-a:font-semibold prose-strong:text-foreground">
          {body}
        </Streamdown>
      )}
      {message.attachments?.map((attachment) => (
        <button key={attachment.path} type="button" onClick={() => onAttachment(attachment)} className="flex w-full items-center gap-2 border-2 border-foreground/30 bg-muted/30 p-2 text-left text-xs">
          {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
        </button>
      ))}
      {visibleOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t-2 border-foreground/15 pt-3">
          {visibleOptions.map((option) => (
            <button key={option} type="button" onClick={() => onAction(option)} className="border-2 border-foreground bg-background px-3 py-2 text-left text-xs font-display uppercase hover:bg-secondary">
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OcctaCompanionV4({ embedded = false, className = "", initialOpen = false, onClose }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(embedded || initialOpen);
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [humanLive, setHumanLive] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<TicketPrefill>();
  const [awaitingSecureEmail, setAwaitingSecureEmail] = useState(false);
  const sessionId = useRef(getSessionId());
  const verificationMemory = useRef<VerificationMemory>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(userId);
  const allowHuman = humanLive || customerDissatisfied(messages);
  const quickActions = signedIn ? signedQuick : guestQuick;

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
      const meta = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name;
      setFirstName(typeof meta === "string" ? meta.split(/\s+/)[0] : undefined);
      if (session?.user?.id) {
        const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
        if (data?.full_name) setFirstName(data.full_name.split(/\s+/)[0]);
      }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (!session) sessionStorage.removeItem(VERIFICATION_KEY);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMessages((current) => current.length ? current : [welcome(signedIn, firstName)]);
  }, [signedIn, firstName]);

  useEffect(() => {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(safeHistory(messages)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("chat_conversations").select("id,status").eq("session_id", sessionId.current).maybeSingle();
      if (!cancelled && data?.id) {
        setConversationId(data.id);
        setHumanLive(data.status === "live");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const logConversation = useCallback(async (turns: { role: string; content: string }[], reason?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId: sessionId.current,
          mode: reason ? "handoff" : "log",
          reason,
          summary: redact(turns.find((turn) => turn.role === "user")?.content || "OCCTA customer chat"),
          lastMessage: redact([...turns].reverse().find((turn) => turn.role === "user")?.content || ""),
          transcript: turns.map((turn) => ({ ...turn, content: redact(occtaOnlyLinks(turn.content)) })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.conversationId) setConversationId(payload.conversationId);
      return payload?.conversationId as string | undefined;
    } catch {
      return undefined;
    }
  }, []);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    return await logConversation(messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))) ?? null;
  }, [conversationId, logConversation, messages]);

  const requestHuman = useCallback(async () => {
    const recent = messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
    const id = await logConversation(recent, "requested_human");
    setMessages((current) => [...current, {
      id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
      content: id
        ? `I’ve passed this conversation to an **OCCTA advisor** with the recent context, so you should not need to repeat yourself. Keep this chat open for their reply. For an urgent service-impacting issue, call ${CONTACT_PHONE_DISPLAY}.`
        : `I couldn’t confirm the live handoff just now. For urgent help call ${CONTACT_PHONE_DISPLAY}.`,
    }]);
  }, [logConversation, messages]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`ollie-v4-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as { role?: string; content?: string; attachments?: unknown; created_at?: string };
        if (row.role !== "admin") return;
        setHumanLive(true);
        setMessages((current) => [...current, {
          id: crypto.randomUUID(), role: "assistant", agent: "human", createdAt: row.created_at || new Date().toISOString(),
          content: occtaOnlyLinks(row.content || "Your OCCTA advisor sent an attachment."), attachments: safeAttachments(row.attachments),
        }]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_conversations", filter: `id=eq.${conversationId}` }, (payload) => {
        const status = (payload.new as { status?: string }).status;
        setHumanLive(status === "live");
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  const openTicket = useCallback(() => {
    if (!signedIn) {
      setAwaitingSecureEmail(true);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
        content: `Creating a formal account ticket requires secure account access. Enter the **email registered on the OCCTA account** and I can request a secure sign-in/reset link. I won’t confirm in chat whether an email exists in our records.\n\n<<<OPTIONS:["Open sign in"]>>>`,
      }]);
      return;
    }
    setTicketPrefill(buildTicketPrefill(messages));
    setTicketOpen(true);
  }, [messages, signedIn]);

  const openAttachment = useCallback(async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.functions.invoke("chat-handoff", { body: { sessionId: sessionId.current, mode: "customer_download", path: attachment.path } });
      if (error || !data?.url) throw error ?? new Error("attachment_unavailable");
      window.open(String(data.url), "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Attachment unavailable", description: "It may still be scanning or may have been blocked for safety.", variant: "destructive" });
    }
  }, [toast]);

  const uploadAttachment = useCallback(async (file: File) => {
    if (uploading) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      toast({ title: "Unsupported file", description: "Use an image, PDF, text/CSV or common Office document.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({ title: "File too large", description: "Attachments can be up to 15 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const convId = await ensureConversation();
      if (!convId) throw new Error("Could not create the secure conversation");
      const { data: { session } } = await supabase.auth.getSession();
      const prefix = session?.user?.id ? `user/${session.user.id}` : `guest/${sessionId.current}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "attachment";
      const path = `${prefix}/${convId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      const { data: scan, error: scanError } = await supabase.functions.invoke("chat-attachment-scan", { body: { path, conversation_id: convId, content_type: file.type || undefined, session_id: sessionId.current } });
      if (scanError || scan?.status !== "clean") throw new Error("The file did not pass the attachment safety check");
      const attachment: Attachment = { path, name: file.name, size: file.size, contentType: file.type || undefined };
      const { error: messageError } = await supabase.functions.invoke("chat-handoff", { body: { sessionId: sessionId.current, mode: "customer_attachment", message: `Attachment: ${file.name}`, attachments: [attachment] } });
      if (messageError) throw messageError;
      setMessages((current) => [...current,
        { id: crypto.randomUUID(), role: "user", content: `Attached: ${file.name}`, attachments: [attachment], createdAt: new Date().toISOString() },
        { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: `Thanks — **${file.name}** is securely attached to this conversation. Tell me what it shows or what you want help with.`, createdAt: new Date().toISOString() },
      ]);
    } catch (error) {
      toast({ title: "Attachment not sent", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [ensureConversation, toast, uploading]);

  const send = useCallback(async (value: string) => {
    const raw = value.trim();
    if (!raw || loading || uploading) return;
    const route = routes[normaliseOcctaText(raw)];
    if (route) { window.location.assign(route); return; }

    if (/\b(?:pay|settle)\b.{0,20}\b(?:my )?(?:bill|invoice)\b/i.test(raw)) {
      window.location.assign("/pay-invoice");
      return;
    }

    if (/\b(?:raise|create|open|log|submit)\b.{0,35}\b(?:ticket|support case|case)\b|\bbilling ticket\b/i.test(raw)) {
      openTicket();
      return;
    }

    if (isExplicitHumanRequest(raw)) {
      void requestHuman();
      return;
    }

    if (awaitingSecureEmail && EMAIL_RE.test(raw)) {
      setInput("");
      setLoading(true);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: redact(raw), createdAt: new Date().toISOString() }]);
      try {
        await supabase.functions.invoke("claim-dashboard-link", { body: { email: raw } });
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: secureAccessLinkSentReply(), createdAt: new Date().toISOString() }]);
        setAwaitingSecureEmail(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    captureVerification(raw, verificationMemory.current);
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: redact(raw), rawContent: raw, createdAt: new Date().toISOString() };
    const before = messages;
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (humanLive && conversationId) {
        const { error } = await supabase.functions.invoke("chat-handoff", { body: { sessionId: sessionId.current, mode: "customer_message", message: redact(raw) } });
        if (error) throw error;
        return;
      }

      const core = toCore([...before, userMessage]);
      const accountIntent = expandedAccountIntent(raw);
      const expandedIntent = expandedPublicIntent(raw);
      let answer: string | null = null;
      let intent = expandedIntent || "general";

      {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const endpointMessages: CoreMessage[] = [...core];
        const canonical = canonicalAccountMessage(accountIntent);
        if (canonical) endpointMessages.push({ role: "user", content: canonical });
        if (verificationMemory.current.accountNumber) endpointMessages.push({ role: "user", content: verificationMemory.current.accountNumber });
        if (verificationMemory.current.dob) endpointMessages.push({ role: "user", content: verificationMemory.current.dob });

        try {
          const response = await fetch(COMPANION_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
            body: JSON.stringify({ messages: endpointMessages, sessionId: sessionId.current, verificationToken: sessionStorage.getItem(VERIFICATION_KEY) }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error || "companion_request_failed");
          if (typeof payload?.verificationToken === "string" && payload.verificationToken) {
            sessionStorage.setItem(VERIFICATION_KEY, payload.verificationToken);
            verificationMemory.current = {};
          }
          answer = String(payload?.content || "").trim() || null;
          intent = String(payload?.source || expandedIntent || "general");

          if (answer && /couldn['’]?t verify those details/i.test(answer)) {
            answer = verificationFailureFallback();
            setAwaitingSecureEmail(true);
            sessionStorage.removeItem(VERIFICATION_KEY);
            verificationMemory.current = {};
          }

          if (answer && /don['’]?t have enough verified information|won['’]?t make it up|tell me whether this is about broadband/i.test(answer)) {
            answer = null;
          }
        } catch (endpointError) {
          console.warn("companion endpoint unavailable, using local fallback", endpointError);
        }
      }

      // Local fallbacks only if the AI assistant could not answer.
      if (!answer) {
        if (expandedIntent === "availability") answer = availabilityReply(raw);
        else if (expandedIntent === "provider_comparison") answer = providerComparisonReply(raw);
        else if (!accountIntent) {
          answer = resolveIntelligentPublicReply(core);
          if (answer) intent = expandedIntent || "conversation";
        }
      }

      if (!answer) answer = internalFallback(raw, expandedIntent || "general");

      const topicForGuides = expandedIntent || (accountIntent ? "account" : intent);
      if (!accountIntent) answer = appendGuides(answer, raw, topicForGuides);
      answer = occtaOnlyLinks(answer);

      setMessages((current) => [
        ...current.map((message) => ({ ...message, rawContent: undefined })),
        { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: answer, createdAt: new Date().toISOString() },
      ]);
      void logConversation([{ role: "user", content: redact(raw) }, { role: "assistant", content: answer }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "request_failed";
      setMessages((current) => [...current.map((message) => ({ ...message, rawContent: undefined })), {
        id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
        content: `I couldn’t complete that check just now${text.includes("wait") ? `: ${text}` : "."} I haven’t guessed an answer. Try once more. If it still fails, tell me **“speak to an advisor”** and I’ll pass this conversation across.\n\n<<<OPTIONS:["Try again","Browse OCCTA guides"]>>>`,
      }]);
    } finally {
      setLoading(false);
    }
  }, [awaitingSecureEmail, conversationId, humanLive, loading, logConversation, messages, openTicket, requestHuman, uploading]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(VERIFICATION_KEY);
    verificationMemory.current = {};
    setAwaitingSecureEmail(false);
    setConversationId(null);
    setHumanLive(false);
    setMessages([welcome(signedIn, firstName)]);
  }, [firstName, signedIn]);

  const panel = (
    <div className={`${embedded ? "h-full min-h-[580px]" : "fixed inset-x-2 bottom-2 top-2 z-[9999] sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(740px,calc(100dvh-3rem))] sm:w-[450px]"} ${className} flex flex-col overflow-hidden border-4 border-foreground bg-card shadow-[10px_10px_0_hsl(var(--foreground))]`}>
      <header className="flex items-center justify-between border-b-4 border-foreground bg-primary px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border-2 border-primary-foreground bg-background">{humanLive ? <UserRound className="h-5 w-5" /> : <Bot className="h-5 w-5" />}</div>
          <div className="min-w-0">
            <div className="font-display uppercase text-primary-foreground">{humanLive ? "OCCTA Advisor" : "Ollie — OCCTA Assist"}</div>
            <div className="truncate text-[11px] text-primary-foreground/85">{humanLive ? "Human advisor · conversation retained" : "OCCTA account help · troubleshooting · guides"}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => window.location.assign("/help")} className="p-2 text-primary-foreground" aria-label="OCCTA Help Centre"><LifeBuoy className="h-4 w-4" /></button>
          <button type="button" onClick={openTicket} className="p-2 text-primary-foreground" aria-label="Raise ticket"><TicketPlus className="h-4 w-4" /></button>
          {!embedded && <button type="button" onClick={() => { setOpen(false); onClose?.(); }} className="p-2 text-primary-foreground" aria-label="Close"><X className="h-5 w-5" /></button>}
        </div>
      </header>

      <div className="flex items-center gap-2 border-b-2 border-foreground/20 bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Ollie links only to OCCTA pages. Never send passwords, bank/card details or one-time codes.
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-foreground bg-secondary">{message.agent === "human" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>}
              <div className={`${message.role === "user" ? "max-w-[82%] bg-primary text-primary-foreground" : "max-w-[90%] border-2 border-foreground bg-background"} px-3 py-2 text-sm`}>
                {message.role === "assistant"
                  ? <AssistantMessage message={message} allowHuman={allowHuman} onAction={(option) => void send(option)} onAttachment={(attachment) => void openAttachment(attachment)} />
                  : <>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.attachments?.map((attachment) => <div key={attachment.path} className="mt-2 flex items-center gap-2 border border-primary-foreground/60 p-2 text-xs">{attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}<span className="min-w-0 flex-1 truncate">{attachment.name}</span><span>{formatSize(attachment.size)}</span></div>)}
                    </>}
                <div className={`mt-1 text-[10px] ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{message.agent === "human" ? " · advisor" : ""}</div>
              </div>
            </div>
          ))}
          {(loading || uploading) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{uploading ? "Scanning and attaching…" : humanLive ? "Sending to your advisor…" : "Ollie is checking OCCTA information…"}</div>}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {messages.length <= 1 && <div className="flex flex-wrap gap-2 border-t-2 border-foreground/20 px-4 py-3">{quickActions.map((action) => <button key={action} type="button" onClick={() => void send(action)} className="border-2 border-foreground bg-background px-3 py-2 text-xs font-display uppercase hover:bg-secondary">{action}</button>)}</div>}

      {allowHuman && !humanLive && messages.length > 2 && (
        <div className="border-t-2 border-foreground/15 px-3 py-2 text-xs">
          <button type="button" onClick={() => void requestHuman()} className="inline-flex items-center gap-2 font-medium underline underline-offset-4"><UserRound className="h-3.5 w-3.5" />Still not satisfied? Speak to an OCCTA advisor</button>
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="border-t-4 border-foreground bg-background p-3">
        <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); }} />
        <div className="flex gap-2">
          <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading || uploading} aria-label="Attach file">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</Button>
          <Input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={humanLive ? "Message your OCCTA advisor…" : awaitingSecureEmail ? "Registered account email…" : "Ask Ollie in normal words…"} maxLength={4000} disabled={loading || uploading} />
          <Button type="submit" size="icon" disabled={loading || uploading || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <button type="button" onClick={clearChat} className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" />New chat</button>
          <span>OCCTA-only links · attachments safety scanned</span>
        </div>
      </form>

      <RaiseTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} prefill={ticketPrefill} onSubmitted={({ ref }) => {
        if (!ref) return;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(), content: `Your support ticket was **created successfully**. Reference: **${ref}**.` }]);
      }} />
    </div>
  );

  if (embedded) return panel;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Open OCCTA chat"><MessageCircle className="h-7 w-7" /></button>;
  return panel;
}
