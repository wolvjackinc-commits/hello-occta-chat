import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileText,
  Gauge,
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  Paperclip,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  TicketPlus,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { supabase } from "@/integrations/supabase/client";
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
  streaming?: boolean;
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

type CompanionPayload = {
  status?: number;
  content?: string;
  error?: string;
  source?: string;
  verificationToken?: string;
  handoff?: { reason?: string; summary?: string };
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
const VISION_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

// Tapping one of these suggested replies goes straight to the page.
const routes: Record<string, string> = {
  "open help centre": "/help",
  "browse occta guides": "/help",
  "check availability": "/order",
  "check broadband availability": "/order",
  "check my address": "/order",
  "view broadband plans": "/broadband",
  "view sim plans": "/sim",
  "open own-router guide": "/help/own-router-setup",
  "open sign in": "/auth",
  "sign in": "/auth",
  "sign in instead": "/auth",
  "open my dashboard": "/dashboard",
  "set up direct debit": "/dd/setup",
  "read the complaints code": "/legal/complaints-code",
};

type Starter = { label: string; prompt: string; icon: typeof Gauge };

const guestStarters: Starter[] = [
  { label: "My internet is down", prompt: "My internet isn't working", icon: WifiOff },
  { label: "Choose a broadband plan", prompt: "Help me choose the right broadband plan and show me prices", icon: Gauge },
  { label: "Explain my bill", prompt: "Can you explain my latest bill?", icon: Receipt },
  { label: "SIM plans", prompt: "What SIM plans do you have?", icon: Smartphone },
];

const signedStarters: Starter[] = [
  { label: "Explain my latest bill", prompt: "Explain my latest bill line by line", icon: Receipt },
  { label: "Is my Direct Debit set up?", prompt: "Is my Direct Debit set up and is anything outstanding?", icon: ShieldCheck },
  { label: "My internet is down", prompt: "My internet isn't working", icon: WifiOff },
  { label: "Track my order", prompt: "Where is my order and when will it be live?", icon: Gauge },
];

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  return newSessionId();
}

function newSessionId(): string {
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

type AdvisorRow = { id?: string; role?: string; content?: string | null; attachments?: unknown; created_at?: string };

const HANDOFF_STATUSES = new Set(["awaiting_human", "live"]);

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
  return messages.filter((message) => !message.streaming).slice(-48).map((message) => ({
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

function greetingLine(): string {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }));
  if (hour < 5) return "Up late? Same. I don't sleep, which is either dedication or a design flaw.";
  if (hour < 12) return "Morning. Kettle's on, routers are mostly behaving.";
  if (hour < 17) return "Afternoon. Peak time for Wi-Fi to develop opinions.";
  if (hour < 22) return "Evening. Prime time for buffering, so let's not.";
  return "Evening. Still here, still unreasonably keen.";
}

function welcome(signedIn: boolean, name?: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: signedIn
      ? `${greetingLine()}\n\nHiya${name ? ` ${name}` : ""}, I'm **Ollie**. Your account's open, so ask me anything: bills explained line by line, Direct Debits, orders, tickets, or why the Wi-Fi has gone on strike.`
      : `${greetingLine()}\n\nI'm **Ollie**, OCCTA's resident fixer. Broadband, bills, SIMs or a router having a sulk, just tell me in normal words and I'll sort it here. For account questions I'll only need your account number and date of birth.`,
    createdAt: new Date().toISOString(),
    agent: "ollie",
  };
}

const WAITING_QUIPS = [
  "Putting the kettle on",
  "Having a stern word with the router",
  "Reading the small print so you don't have to",
  "Untangling some fibre",
  "Consulting the department of common sense",
  "Asking the Wi-Fi nicely",
];

const PLACEHOLDERS = [
  "Ask Ollie anything…",
  "e.g. Why is my Wi-Fi slower than a Monday?",
  "e.g. Explain my bill like I'm five",
  "e.g. Which broadband do I actually need?",
  "e.g. My router's flashing red. Help.",
];

function parseOptions(content: string): { body: string; options: string[] } {
  const match = content.match(/<<<OPTIONS:(\[[\s\S]*?\])>>>\s*$/);
  if (!match) return { body: content.replace(/<<<[\s\S]*$/, "").replace(/<{1,2}$/, "").trim(), options: [] };
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

function plainText(markdown: string): string {
  return parseOptions(markdown).body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

function customerDissatisfied(messages: Message[]): boolean {
  return messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .some((message) => /\b(?:still|again|already tried|not fixed|not working|wrong|not helpful|not satisfied|useless|same problem|same issue|doesn['’]?t work|didn['’]?t work|you keep|i told you)\b/i.test(message.rawContent ?? message.content));
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toCore(messages: Message[]): CoreMessage[] {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && !message.streaming)
    .slice(-24)
    .map((message) => ({
      role: message.role,
      content: message.agent === "human" ? `[OCCTA advisor] ${message.content}` : message.rawContent ?? message.content,
    }));
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
  if (/\]\((?:https:\/\/(?:www\.)?occta\.co\.uk)?\/help\//i.test(answer)) return answer;
  const guides = guideLinksMarkdown(query, intent, 2);
  if (!guides) return answer;
  return `${answer.trim()}\n\n**Relevant OCCTA guide${guides.includes("\n") ? "s" : ""}:**\n${guides}`;
}

function internalFallback(query: string, intent: string): string {
  const guides = matchOcctaGuides(query, intent, 3);
  if (guides.length) {
    return `I found OCCTA help pages that match what you're trying to do:\n\n${guides.map((guide) => `• [**${guide.title}**](/help/${guide.slug})`).join("\n")}\n\nTell me what you see or which step you're stuck on and I'll carry on from there.\n\n<<<OPTIONS:["I'm still stuck","Talk to an advisor"]>>>`;
  }
  return `I'm having trouble reaching my full brain for a moment. Tell me **what you're trying to do** or **what isn't working** in one sentence and I'll narrow it down, or I can pass you to an advisor.\n\n<<<OPTIONS:["Try again","Talk to an advisor","Browse OCCTA guides"]>>>`;
}

function buildTicketPrefill(messages: Message[]): TicketPrefill {
  const userText = messages.filter((m) => m.role === "user").map((m) => redact(m.content)).join(" ").toLowerCase();
  const category = /invoice|bill|charge|vat|refund/.test(userText)
    ? "billing"
    : /payment|direct debit/.test(userText)
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
  const transcript = messages.slice(-20).map((m) => `${m.role === "user" ? "Customer" : m.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redact(plainText(m.content))}`).join("\n\n");
  return {
    category,
    priority,
    subject: redact(lastUser).replace(/\s+/g, " ").slice(0, 110),
    message: `Please review the issue discussed with Ollie.\n\n${transcript.slice(-1800)}`,
    transcript: transcript.slice(-7000),
  };
}

/** Reads the occta-companion server-sent event stream. */
async function readEventStream(
  response: Response,
  handlers: { onStatus: (label: string) => void; onDelta: (text: string) => void },
): Promise<CompanionPayload | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let final: CompanionPayload | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      const event = chunk.match(/^event: (.+)$/m)?.[1]?.trim();
      const dataLine = chunk.match(/^data: (.*)$/m)?.[1];
      if (!event || !dataLine) continue;
      let data: Record<string, unknown> & CompanionPayload;
      try { data = JSON.parse(dataLine); } catch { continue; }
      if (event === "status" && typeof data.label === "string") handlers.onStatus(data.label);
      else if (event === "delta" && typeof data.text === "string") handlers.onDelta(data.text);
      else if (event === "done") final = data;
    }
  }
  return final;
}

function OllieAvatar({ human = false, size = "sm" }: { human?: boolean; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  return (
    <div className={`${box} relative flex shrink-0 items-center justify-center border-2 border-foreground ${human ? "bg-background" : "bg-primary"} text-foreground`}>
      {human ? <UserRound className="h-4 w-4" /> : <span className={`font-display ${size === "lg" ? "text-lg" : "text-sm"} leading-none`}>O</span>}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/70" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function AssistantMessage({ message, onAction, onAttachment, onFeedback, isLatest }: {
  message: Message;
  onAction: (value: string) => void;
  onAttachment: (attachment: Attachment) => void;
  onFeedback: (message: Message, helpful: boolean) => void;
  isLatest: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<boolean | null>(null);
  const rate = (helpful: boolean) => {
    if (rated !== null) return;
    setRated(helpful);
    onFeedback(message, helpful);
  };
  const { body, options } = parseOptions(occtaOnlyLinks(message.content));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(message.content));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing to do.
    }
  };
  return (
    <div className="group space-y-2">
      {body && (
        <Streamdown className="prose prose-sm max-w-none text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-a:font-semibold prose-a:text-foreground prose-a:underline prose-a:decoration-primary prose-a:decoration-2 prose-a:underline-offset-2 prose-strong:text-foreground">
          {body}
        </Streamdown>
      )}
      {message.streaming && !body && <TypingDots />}
      {message.attachments?.map((attachment) => (
        <button key={attachment.path} type="button" onClick={() => onAttachment(attachment)} className="flex w-full items-center gap-2 border-2 border-foreground/30 bg-muted/30 p-2 text-left text-xs">
          {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
        </button>
      ))}
      {!message.streaming && body && message.agent !== "human" && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100">
          <span>{new Date(message.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Copy reply">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}
          </button>
          {rated === null ? (
            <span className="ml-auto inline-flex items-center gap-1">
              <button type="button" onClick={() => rate(true)} className="p-0.5 hover:text-foreground" aria-label="This was helpful" title="Helpful"><ThumbsUp className="h-3 w-3" /></button>
              <button type="button" onClick={() => rate(false)} className="p-0.5 hover:text-foreground" aria-label="This wasn't helpful" title="Not helpful"><ThumbsDown className="h-3 w-3" /></button>
            </span>
          ) : (
            <span className="ml-auto italic">{rated ? "Cheers, that's made my day." : "Noted. I'll have a quiet word with myself."}</span>
          )}
        </div>
      )}
      {isLatest && !message.streaming && options.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAction(option)}
              className="border-2 border-foreground bg-background px-3 py-1.5 text-left text-xs font-semibold shadow-[2px_2px_0_hsl(var(--foreground))] transition-all hover:-translate-y-px hover:bg-primary active:translate-y-0 active:shadow-none"
            >
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
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<TicketPrefill>();
  const [awaitingSecureEmail, setAwaitingSecureEmail] = useState(false);
  const [verified, setVerified] = useState(() => Boolean(sessionStorage.getItem(VERIFICATION_KEY)));
  const [atBottom, setAtBottom] = useState(true);
  const sessionId = useRef(getSessionId());
  const verificationMemory = useRef<VerificationMemory>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollSince = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [quip, setQuip] = useState(0);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const humanLive = handoffStatus === "live";
  const awaitingHuman = handoffStatus === "awaiting_human";
  const signedIn = Boolean(userId);
  const showAdvisorLink = !humanLive && !awaitingHuman && messages.length > 2 && customerDissatisfied(messages);
  const starters = signedIn ? signedStarters : guestStarters;
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

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
  }, [messages]);

  // Follow the conversation unless the customer has scrolled up to read.
  useEffect(() => {
    const node = scrollRef.current;
    if (node && atBottom) node.scrollTop = node.scrollHeight;
  }, [messages, status, atBottom]);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    setAtBottom(true);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Grow the composer with its content, up to a few lines.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [input]);

  // Advisor replies arrive by polling chat-handoff. Realtime cannot be used here:
  // guest chats are only readable with an x-session-id header, which Realtime never sends.
  const pollAdvisor = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("chat-handoff", {
      body: { sessionId: sessionId.current, mode: "poll", since: pollSince.current ?? undefined },
    });
    if (error || !data?.ok) return;
    if (typeof data.conversationId === "string") setConversationId(data.conversationId);
    setHandoffStatus(typeof data.status === "string" ? data.status : null);
    const rows: AdvisorRow[] = Array.isArray(data.messages) ? data.messages : [];
    if (!rows.length) return;
    const latest = rows[rows.length - 1]?.created_at;
    if (latest) pollSince.current = latest;
    setMessages((current) => {
      const seen = new Set(current.map((message) => message.id));
      const fresh: Message[] = rows
        .filter((row) => row.id && !seen.has(String(row.id)))
        .map((row) => ({
          id: String(row.id),
          role: "assistant",
          agent: "human",
          createdAt: row.created_at || new Date().toISOString(),
          content: occtaOnlyLinks(row.content || "Your OCCTA advisor sent an attachment."),
          attachments: safeAttachments(row.attachments),
        }));
      return fresh.length ? [...current, ...fresh] : current;
    });
  }, []);

  // After a reload, pick the handoff back up if this chat already has one.
  useEffect(() => {
    const history = loadHistory();
    if (history.length <= 1) return;
    pollSince.current = new Date(Date.parse(history[0].createdAt) - 5 * 60_000).toISOString();
    void pollAdvisor();
  }, [pollAdvisor]);

  useEffect(() => {
    if (!handoffStatus || !HANDOFF_STATUSES.has(handoffStatus)) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void pollAdvisor();
    }, handoffStatus === "live" ? 4000 : 8000);
    return () => window.clearInterval(timer);
  }, [handoffStatus, pollAdvisor]);

  const logConversation = useCallback(async (turns: { role: string; content: string }[], reason?: string, summaryOverride?: string) => {
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
          summary: redact(summaryOverride || turns.find((turn) => turn.role === "user")?.content || "OCCTA customer chat"),
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

  const requestHuman = useCallback(async (handoff?: { reason: string; summary: string; turns: { role: string; content: string }[] }) => {
    const recent = handoff?.turns ?? messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
    pollSince.current = new Date(Date.now() - 60_000).toISOString();
    const id = await logConversation(recent, handoff ? `ollie_${handoff.reason}` : "requested_human", handoff?.summary);
    if (id) setHandoffStatus("awaiting_human");
    // Ollie already told the customer about its own transfer; only speak up if it failed.
    if (handoff && id) return;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
      content: id
        ? `I've passed this conversation to an **OCCTA advisor** with the full context, so you won't need to repeat yourself. Keep this chat open: their reply will appear right here, and I can keep helping while you wait. For an urgent service-impacting issue, call ${CONTACT_PHONE_DISPLAY}.`
        : `I couldn't confirm the handoff just now. For urgent help call ${CONTACT_PHONE_DISPLAY}.`,
    }]);
  }, [logConversation, messages]);

  const openTicket = useCallback(() => {
    if (!signedIn) {
      // Ollie can verify a guest and raise the ticket itself with a full summary.
      void sendRef.current?.("I'd like to raise a support ticket");
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

  // Uploads and scans straight away, then waits in the composer to go with the next message.
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
      setPending((current) => [...current, { path, name: file.name, size: file.size, contentType: file.type || undefined }].slice(-3));
      inputRef.current?.focus();
    } catch (error) {
      toast({ title: "Attachment not added", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [ensureConversation, toast, uploading]);

  // Something to read while Ollie thinks, until a real status arrives.
  useEffect(() => {
    if (!loading) return;
    setQuip(Math.floor(Math.random() * WAITING_QUIPS.length));
    const timer = window.setInterval(() => setQuip((value) => (value + 1) % WAITING_QUIPS.length), 2400);
    return () => window.clearInterval(timer);
  }, [loading]);

  // Rotate example prompts in the empty composer.
  useEffect(() => {
    if (input) return;
    const timer = window.setInterval(() => setPlaceholderIndex((value) => (value + 1) % PLACEHOLDERS.length), 4500);
    return () => window.clearInterval(timer);
  }, [input]);

  // Esc closes the floating chat.
  useEffect(() => {
    if (embedded || !open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || ticketOpen) return;
      abortRef.current?.abort();
      setOpen(false);
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, onClose, open, ticketOpen]);

  const sendFeedback = useCallback(async (message: Message, helpful: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(COMPANION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "feedback", sessionId: sessionId.current, helpful, excerpt: redact(plainText(message.content)).slice(0, 500) }),
      });
    } catch {
      // Feedback is best-effort.
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (value: string) => {
    const typed = value.trim();
    const attachments = pending;
    if ((!typed && !attachments.length) || loading || uploading) return;
    const raw = typed || (attachments.some((a) => VISION_EXTENSIONS.has(a.name.split(".").pop()?.toLowerCase() ?? ""))
      ? "Here's a photo. What can you tell from it?"
      : "I've attached a file.");

    if (!attachments.length) {
      const route = routes[normaliseOcctaText(raw)];
      if (route) { window.location.assign(route); return; }
    }

    // The first ask for a person goes to Ollie, who offers to sort it first. Asking again connects straight away.
    const humanAsk = isExplicitHumanRequest(raw);
    if (humanAsk && messages.some((m) => m.role === "user" && isExplicitHumanRequest(m.rawContent ?? m.content))) {
      setInput("");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: redact(raw), createdAt: new Date().toISOString() }]);
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
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: redact(raw),
      rawContent: raw,
      createdAt: new Date().toISOString(),
      attachments: attachments.length ? attachments : undefined,
    };
    const before = messages;
    const replyId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPending([]);
    setLoading(true);
    setStatus(null);
    setAtBottom(true);

    // Advisors see attachments in their console too.
    if (attachments.length) {
      void supabase.functions.invoke("chat-handoff", {
        body: { sessionId: sessionId.current, mode: "customer_attachment", message: `Attachment: ${attachments.map((a) => a.name).join(", ")}`, attachments },
      });
    }

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
      let handoff: { reason: string; summary: string } | null = null;
      let streamed = false;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const endpointMessages: CoreMessage[] = [...core];
      // The canonical phrasing only helps start the verification flow for unverified guests.
      const isVerified = Boolean(session?.access_token) || Boolean(sessionStorage.getItem(VERIFICATION_KEY));
      const canonical = isVerified ? null : canonicalAccountMessage(accountIntent);
      if (canonical) endpointMessages.push({ role: "user", content: canonical });
      if (verificationMemory.current.accountNumber) endpointMessages.push({ role: "user", content: verificationMemory.current.accountNumber });
      if (verificationMemory.current.dob) endpointMessages.push({ role: "user", content: verificationMemory.current.dob });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(COMPANION_ENDPOINT, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: endpointMessages,
            sessionId: sessionId.current,
            verificationToken: sessionStorage.getItem(VERIFICATION_KEY),
            attachments: attachments.map(({ path, name }) => ({ path, name })),
            stream: true,
          }),
        });

        let payload: CompanionPayload | null;
        if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
          payload = await readEventStream(response, {
            onStatus: (label) => setStatus(label),
            onDelta: (text) => {
              streamed = true;
              setStatus(null);
              setMessages((current) => {
                const existing = current.find((message) => message.id === replyId);
                if (existing) return current.map((message) => message.id === replyId ? { ...message, content: message.content + text } : message);
                return [...current, { id: replyId, role: "assistant", agent: "ollie", content: text, streaming: true, createdAt: new Date().toISOString() }];
              });
            },
          });
        } else {
          payload = await response.json().catch(() => null);
          if (payload && !response.ok) payload.status = response.status;
        }

        if (!payload || (payload.status && payload.status >= 400) || payload.error) {
          throw new Error(payload?.error || "companion_request_failed");
        }
        if (typeof payload.verificationToken === "string" && payload.verificationToken) {
          sessionStorage.setItem(VERIFICATION_KEY, payload.verificationToken);
          verificationMemory.current = {};
          setVerified(true);
        }
        answer = String(payload.content || "").trim() || null;
        if (payload.handoff && typeof payload.handoff.reason === "string") {
          handoff = { reason: payload.handoff.reason, summary: String(payload.handoff.summary || "") };
        }

        if (answer && /couldn['’]?t verify those details/i.test(answer)) {
          answer = verificationFailureFallback();
          setAwaitingSecureEmail(true);
          sessionStorage.removeItem(VERIFICATION_KEY);
          verificationMemory.current = {};
          setVerified(false);
        }
      } catch (endpointError) {
        if ((endpointError as Error)?.name === "AbortError") {
          setMessages((current) => current.map((message) => message.id === replyId
            ? { ...message, streaming: false, content: `${parseOptions(message.content).body}\n\n_Stopped._` }
            : message));
          return;
        }
        if (/wait|too many|too long/i.test((endpointError as Error)?.message ?? "")) throw endpointError;
        console.warn("companion endpoint unavailable, using local fallback", endpointError);
      } finally {
        abortRef.current = null;
      }

      // If Ollie is unavailable, a request for a person must still get through.
      if (!answer && humanAsk) {
        setMessages((current) => current.filter((message) => message.id !== replyId));
        void requestHuman();
        return;
      }

      // Local fallbacks only if the assistant could not answer at all.
      if (!answer) {
        if (!accountIntent) answer = resolveIntelligentPublicReply(core);
        if (!answer) answer = internalFallback(raw, expandedIntent || "general");
        answer = appendGuides(answer, raw, expandedIntent || "general");
      }
      answer = occtaOnlyLinks(answer);

      const finalMessage: Message = { id: replyId, role: "assistant", agent: "ollie", content: answer, createdAt: new Date().toISOString() };
      setMessages((current) => {
        const cleared = current.map((message) => ({ ...message, rawContent: undefined }));
        return streamed || cleared.some((message) => message.id === replyId)
          ? cleared.map((message) => message.id === replyId ? finalMessage : message)
          : [...cleared, finalMessage];
      });
      if (handoff) {
        const turns = [...before, userMessage].slice(-15).map((m) => ({ role: m.role, content: redact(m.content) }));
        void requestHuman({ ...handoff, turns: [...turns, { role: "assistant", content: answer }] });
      } else {
        void logConversation([{ role: "user", content: redact(raw) }, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "request_failed";
      setMessages((current) => [...current.filter((message) => message.id !== replyId).map((message) => ({ ...message, rawContent: undefined })), {
        id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
        content: `I couldn't finish that just now${/wait|too many|too long/i.test(text) ? `: ${text}` : "."} I haven't guessed an answer. Try again, or I can pass you to an advisor.\n\n<<<OPTIONS:["Try again","Talk to an advisor"]>>>`,
      }]);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }, [awaitingSecureEmail, conversationId, humanLive, loading, logConversation, messages, pending, requestHuman, uploading]);

  const sendRef = useRef(send);
  sendRef.current = send;

  const lastUserRaw = [...messages].reverse().find((message) => message.role === "user");
  const onAction = useCallback((option: string) => {
    if (/^try again$/i.test(option) && lastUserRaw) {
      void send(lastUserRaw.rawContent ?? lastUserRaw.content);
      return;
    }
    void send(option);
  }, [lastUserRaw, send]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }, [input, send]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(VERIFICATION_KEY);
    verificationMemory.current = {};
    setAwaitingSecureEmail(false);
    setConversationId(null);
    setHandoffStatus(null);
    setPending([]);
    setVerified(false);
    pollSince.current = null;
    sessionId.current = newSessionId();
    setMessages([welcome(signedIn, firstName)]);
  }, [firstName, signedIn]);

  const streamingNow = messages.some((message) => message.streaming);
  const canSend = (input.trim().length > 0 || pending.length > 0) && !loading && !uploading;

  const panel = (
    <div
      role="dialog"
      aria-label="Chat with Ollie, OCCTA's assistant"
      className={`${embedded ? "h-full min-h-[580px]" : "fixed inset-0 z-[9999] h-[100dvh] animate-in fade-in slide-in-from-bottom-4 duration-200 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(760px,calc(100dvh-3rem))] sm:w-[460px] sm:border-4 sm:shadow-[10px_10px_0_hsl(var(--foreground))]"} ${embedded ? "border-4 shadow-[10px_10px_0_hsl(var(--foreground))]" : ""} ${className} flex flex-col overflow-hidden border-foreground bg-card`}
    >
      <header className="flex items-center justify-between border-b-4 border-foreground bg-primary px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <OllieAvatar human={humanLive} size="lg" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-500" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg uppercase leading-tight text-primary-foreground">{humanLive ? "OCCTA Advisor" : "Ollie"}</div>
            <div className="truncate text-[11px] font-medium text-primary-foreground/80">
              {humanLive ? "A real person has joined · history kept" : awaitingHuman ? "Advisor on the way · Ollie still here" : "Replies in seconds · tea-powered · humans on standby"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => window.location.assign("/help")} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="OCCTA Help Centre" title="Help Centre"><LifeBuoy className="h-4 w-4" /></button>
          <button type="button" onClick={openTicket} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Raise a ticket" title="Raise a ticket"><TicketPlus className="h-4 w-4" /></button>
          <button type="button" onClick={clearChat} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Start a new chat" title="New chat"><RefreshCw className="h-4 w-4" /></button>
          {!embedded && <button type="button" onClick={() => { abortRef.current?.abort(); setOpen(false); onClose?.(); }} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Close chat"><X className="h-5 w-5" /></button>}
        </div>
      </header>

      {(signedIn || verified) && !humanLive && (
        <div className="flex items-center gap-2 border-b-2 border-foreground/15 bg-emerald-50 px-4 py-1.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          {signedIn ? "Signed in: Ollie can check your account securely" : "Identity verified for this chat"}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain" aria-live="polite" aria-busy={loading}>
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex animate-in fade-in slide-in-from-bottom-1 gap-2 duration-300 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <div className="mt-0.5"><OllieAvatar human={message.agent === "human"} /></div>}
                <div className={message.role === "user"
                  ? "max-w-[82%] border-2 border-foreground bg-foreground px-3 py-2 text-sm text-background"
                  : `max-w-[88%] border-2 border-foreground ${message.agent === "human" ? "bg-secondary/40" : "bg-background"} px-3 py-2 text-sm`}
                >
                  {message.role === "assistant" && message.agent === "human" && (
                    <div className="mb-1 text-[10px] font-display uppercase tracking-wide text-muted-foreground">OCCTA advisor</div>
                  )}
                  {message.role === "assistant"
                    ? <AssistantMessage message={message} isLatest={message.id === lastAssistantId && !loading} onAction={onAction} onAttachment={(attachment) => void openAttachment(attachment)} onFeedback={(target, helpful) => void sendFeedback(target, helpful)} />
                    : <>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        {message.attachments?.map((attachment) => (
                          <div key={attachment.path} className="mt-2 flex items-center gap-2 border border-background/40 p-2 text-xs">
                            {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                            <span className="opacity-70">{formatSize(attachment.size)}</span>
                          </div>
                        ))}
                      </>}
                </div>
              </div>
            ))}

            {loading && !streamingNow && (
              <div className="flex items-center gap-2">
                <OllieAvatar />
                <div className="inline-flex items-center gap-2 border-2 border-foreground/30 bg-background px-3 py-2 text-xs text-muted-foreground">
                  {status ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{status}…</> : humanLive ? <>Sending to your advisor…</> : <><TypingDots /><span key={quip} className="animate-in fade-in duration-300">{WAITING_QUIPS[quip]}…</span></>}
                </div>
              </div>
            )}
            {loading && streamingNow && status && (
              <div className="ml-10 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{status}…</div>
            )}

            {messages.length <= 1 && !loading && (
              <div className="pt-1 text-[11px] font-display uppercase tracking-wide text-muted-foreground">Popular right now</div>
            )}
            {messages.length <= 1 && !loading && (
              <div className="grid grid-cols-2 gap-2">
                {starters.map(({ label, prompt, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="flex items-start gap-2 border-2 border-foreground bg-background p-3 text-left text-xs font-semibold shadow-[3px_3px_0_hsl(var(--foreground))] transition-all hover:-translate-y-px hover:bg-primary active:translate-y-0 active:shadow-none"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {!atBottom && (
          <button type="button" onClick={scrollToBottom} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 border-2 border-foreground bg-background px-3 py-1 text-xs font-semibold shadow-[2px_2px_0_hsl(var(--foreground))]" aria-label="Scroll to latest message">
            <ArrowDown className="h-3.5 w-3.5" />Latest
          </button>
        )}
      </div>

      {awaitingHuman && (
        <div className="flex items-center gap-2 border-t-2 border-foreground/15 bg-secondary/40 px-3 py-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />An OCCTA advisor will reply here shortly. Ollie can keep helping meanwhile.
        </div>
      )}

      {showAdvisorLink && (
        <div className="border-t-2 border-foreground/15 px-3 py-2 text-xs">
          <button type="button" onClick={() => void requestHuman()} className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"><UserRound className="h-3.5 w-3.5" />Not sorted? Speak to an OCCTA advisor</button>
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="border-t-4 border-foreground bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); }} />
        {(pending.length > 0 || uploading) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((attachment) => (
              <span key={attachment.path} className="inline-flex max-w-full items-center gap-1.5 border-2 border-foreground/40 bg-muted/40 px-2 py-1 text-xs">
                {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                <span className="max-w-[180px] truncate">{attachment.name}</span>
                <button type="button" onClick={() => setPending((current) => current.filter((item) => item.path !== attachment.path))} aria-label={`Remove ${attachment.name}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
            {uploading && <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Safety-scanning…</span>}
          </div>
        )}
        <div className="flex items-end gap-2 border-2 border-foreground bg-background p-1.5 focus-within:shadow-[3px_3px_0_hsl(var(--primary))]">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loading || uploading || pending.length >= 3} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Attach a photo or file" title="Attach a photo or file (router lights, bills, error screens)">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={humanLive ? "Message your OCCTA advisor…" : awaitingSecureEmail ? "Your registered account email…" : pending.length ? "Add a note about the attachment…" : PLACEHOLDERS[placeholderIndex]}
            maxLength={4000}
            aria-label="Message Ollie"
            className="max-h-[132px] min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && !humanLive ? (
            <button type="button" onClick={stop} className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-foreground bg-background hover:bg-secondary" aria-label="Stop Ollie">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={!canSend} className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-foreground bg-primary text-primary-foreground transition-opacity disabled:opacity-40" aria-label="Send message">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Never share passwords, bank/card details or codes</span>
          <span className="hidden sm:inline">Enter to send · Shift+Enter new line</span>
        </div>
      </form>

      <RaiseTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} prefill={ticketPrefill} onSubmitted={({ ref }) => {
        if (!ref) return;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(), content: `Your support ticket has been **created**. Reference: **${ref}**. The team will reply by email and in your dashboard.` }]);
      }} />
    </div>
  );

  if (embedded) return panel;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 border-4 border-foreground bg-primary px-4 py-3 font-display uppercase text-primary-foreground shadow-[6px_6px_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5"
        aria-label="Open chat with Ollie"
      >
        <Sparkles className="h-5 w-5" />Ask Ollie
      </button>
    );
  }
  return panel;
}
