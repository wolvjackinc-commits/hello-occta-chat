import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ExternalLink,
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
  redactSensitiveText,
  type CompanionMessage as CoreMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";
import {
  isExplicitHumanRequest,
  resolveIntelligentPublicReply,
  secureAccessLinkSentReply,
  shouldOfferHuman,
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

const COMPANION_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/occta-companion`;
const HISTORY_KEY = "occta-companion-v3-history";
const SESSION_KEY = "occta-companion-session-v1";
const VERIFICATION_KEY = "occta-companion-verification-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "pptx"]);

const routes: Record<string, string> = {
  "open help centre": "/help",
  "search help centre": "/help",
  "check availability": "/build-plan",
  "check broadband availability": "/build-plan",
  "open availability checker": "/build-plan",
  "view broadband plans": "/broadband",
  "compare broadband options": "/broadband",
  "view sim plans": "/sim",
  "open service status": "/status",
  "check service status": "/status",
  "open own-router guide": "/help/own-router-setup",
  "open sign in": "/auth",
  "sign in": "/auth",
  "open my dashboard": "/dashboard",
  "open about occta": "/about",
  "open pricing": "/pricing",
  "read occta policies": "/legal/code-of-practice",
  "read cancellation terms": "/cancellation",
  "open cancellation information": "/cancellation",
  "read the complaints code": "/legal/complaints-code",
  "digital voice information": "/landline",
  "start a switch": "/switching",
  "set up direct debit": "/dd/setup",
  "pay invoice": "/pay-invoice",
};

const guestQuick = ["What plans do you have?", "Check broadband availability", "Fix my internet"];
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
    .replace(/\[date of birth provided securely\]/g, "Date of birth provided securely")
    .replace(/\[bank details removed\]/g, "Bank details removed")
    .replace(/\[payment number removed\]/g, "Payment number removed");
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
    content: redact(message.content),
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
      ? `Hi${name ? ` ${name}` : ""} — I'm Ollie. Tell me what you need in normal words. I can use your signed-in OCCTA data, troubleshoot step by step, find the right guide and keep the conversation together until we resolve it.`
      : `Hi — I'm Ollie from OCCTA. Tell me what you need in normal words. I'll try to answer or solve it here first, use OCCTA's published guides when useful, and only bring in an advisor when you ask or when we've genuinely reached a point that needs a person.`,
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
  const { body, options } = parseOptions(message.content);
  const visibleOptions = allowHuman ? options : options.filter((option) => !humanOption(option));
  return (
    <div className="space-y-3">
      {body && (
        <Streamdown className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-li:my-0 prose-a:text-primary prose-strong:text-foreground">
          {body}
        </Streamdown>
      )}
      {message.attachments?.map((attachment) => (
        <button key={attachment.path} type="button" onClick={() => onAttachment(attachment)} className="flex w-full items-center gap-2 border-2 border-foreground/30 bg-muted/30 p-2 text-left text-xs">
          {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <ExternalLink className="h-3.5 w-3.5" />
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

export default function OcctaCompanionV3({ embedded = false, className = "", initialOpen = false, onClose }: Props) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(userId);
  const allowHuman = humanLive || shouldOfferHuman(toCore(messages));
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
          mode: reason ? undefined : "log",
          reason,
          summary: redact(turns.find((turn) => turn.role === "user")?.content || "OCCTA customer chat"),
          lastMessage: redact([...turns].reverse().find((turn) => turn.role === "user")?.content || ""),
          transcript: turns.map((turn) => ({ ...turn, content: redact(turn.content) })),
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
        ? `I've passed the conversation to an OCCTA advisor with the recent context, so you shouldn't need to repeat it. Keep this chat open for their reply. For an urgent service-impacting issue, call ${CONTACT_PHONE_DISPLAY}.`
        : `I couldn't confirm the live handoff just now. For urgent help call ${CONTACT_PHONE_DISPLAY}; otherwise keep the chat open and try the handoff again.`,
    }]);
  }, [logConversation, messages]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`ollie-v3-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as { role?: string; content?: string; attachments?: unknown; created_at?: string };
        if (row.role !== "admin") return;
        setHumanLive(true);
        setMessages((current) => [...current, {
          id: crypto.randomUUID(), role: "assistant", agent: "human", createdAt: row.created_at || new Date().toISOString(),
          content: row.content || "Your OCCTA advisor sent an attachment.", attachments: safeAttachments(row.attachments),
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
        content: `I can keep troubleshooting here, but creating a formal account ticket requires secure account access. Enter the **email registered on the OCCTA account** and I can request a secure sign-in/reset link. I won't confirm in chat whether an email exists in our records.\n\n<<<OPTIONS:["Open sign in","Keep troubleshooting"]>>>`,
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
        { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: `Thanks — **${file.name}** is securely attached and will stay with this conversation. Tell me what the attachment shows or what you want me to help with; if an advisor later takes over, they can see the same file.`, createdAt: new Date().toISOString() },
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
    const route = routes[raw.toLowerCase()];
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
      const displayed = redact(raw);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: displayed, createdAt: new Date().toISOString() }]);
      try {
        await supabase.functions.invoke("claim-dashboard-link", { body: { email: raw } });
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: secureAccessLinkSentReply(), createdAt: new Date().toISOString() }]);
        setAwaitingSecureEmail(false);
      } finally {
        setLoading(false);
      }
      return;
    }

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
      let answer = resolveIntelligentPublicReply(core);
      let source = answer ? "conversation" : "";

      if (!answer) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(COMPANION_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: core, sessionId: sessionId.current, verificationToken: sessionStorage.getItem(VERIFICATION_KEY) }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || "companion_request_failed");
        if (typeof payload?.verificationToken === "string" && payload.verificationToken) sessionStorage.setItem(VERIFICATION_KEY, payload.verificationToken);
        answer = String(payload?.content || "");
        source = String(payload?.source || "");

        if (/couldn't verify those details/i.test(answer)) {
          answer = verificationFailureFallback();
          setAwaitingSecureEmail(true);
          sessionStorage.removeItem(VERIFICATION_KEY);
        }

        const genericFallback = source === "knowledge_base" && /don't have enough verified information|won't make it up|tell me whether this is about/i.test(answer);
        if (genericFallback) {
          const { data: research } = await supabase.functions.invoke("occta-research", { body: { query: raw, sessionId: sessionId.current } });
          if (typeof research?.content === "string" && research.content.trim()) {
            answer = research.content;
            source = String(research.source || "research");
          }
        }
      }

      if (!answer) {
        answer = `I haven't found a reliable answer yet, so I don't want to guess. Tell me one more detail about what you're trying to do and I'll narrow it down. If we've already tried this twice and you're still stuck, I'll offer an advisor.\n\n<<<OPTIONS:["Ask a more specific question","Search Help Centre"]>>>`;
      }

      setMessages((current) => [
        ...current.map((message) => ({ ...message, rawContent: undefined })),
        { id: crypto.randomUUID(), role: "assistant", agent: "ollie", content: answer, createdAt: new Date().toISOString() },
      ]);
      void logConversation([{ role: "user", content: redact(raw) }, { role: "assistant", content: answer }]);
      void source;
    } catch (error) {
      const text = error instanceof Error ? error.message : "request_failed";
      setMessages((current) => [...current.map((message) => ({ ...message, rawContent: undefined })), {
        id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(),
        content: `I couldn't complete that check just now${text.includes("wait") ? `: ${text}` : "."} I won't invent a result. Try once more; if it still fails, I'll make the advisor option available.\n\n<<<OPTIONS:["Try again","Open Help Centre"]>>>`,
      }]);
    } finally {
      setLoading(false);
    }
  }, [awaitingSecureEmail, conversationId, humanLive, loading, logConversation, messages, openTicket, requestHuman, uploading]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(VERIFICATION_KEY);
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
            <div className="truncate text-[11px] text-primary-foreground/85">{humanLive ? "Human advisor · full conversation retained" : "Conversation · account data · OCCTA guides · trusted research"}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => window.location.assign("/help")} className="p-2 text-primary-foreground" aria-label="Help Centre"><LifeBuoy className="h-4 w-4" /></button>
          <button type="button" onClick={openTicket} className="p-2 text-primary-foreground" aria-label="Raise ticket"><TicketPlus className="h-4 w-4" /></button>
          {!embedded && <button type="button" onClick={() => { setOpen(false); onClose?.(); }} className="p-2 text-primary-foreground" aria-label="Close"><X className="h-5 w-5" /></button>}
        </div>
      </header>

      <div className="flex items-center gap-2 border-b-2 border-foreground/20 bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Ollie uses verified OCCTA/account sources first. Never send passwords, bank/card details or one-time codes.
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
          {(loading || uploading) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{uploading ? "Scanning and attaching…" : humanLive ? "Sending to your advisor…" : "Ollie is checking…"}</div>}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {messages.length <= 1 && <div className="flex flex-wrap gap-2 border-t-2 border-foreground/20 px-4 py-3">{quickActions.map((action) => <button key={action} type="button" onClick={() => void send(action)} className="border-2 border-foreground bg-background px-3 py-2 text-xs font-display uppercase hover:bg-secondary">{action}</button>)}</div>}

      {allowHuman && !humanLive && messages.length > 2 && (
        <div className="border-t-2 border-foreground/15 px-3 py-2 text-xs">
          <button type="button" onClick={() => void requestHuman()} className="inline-flex items-center gap-2 font-medium underline underline-offset-4"><UserRound className="h-3.5 w-3.5" />Still stuck? Speak to an OCCTA advisor</button>
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
          <span>Attachments up to 15 MB · safety scanned</span>
        </div>
      </form>

      <RaiseTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} prefill={ticketPrefill} onSubmitted={({ ref }) => {
        if (!ref) return;
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", agent: "ollie", createdAt: new Date().toISOString(), content: `Your support ticket was **created successfully**. Reference: **${ref}**. I've only said that because the ticket backend confirmed it.` }]);
      }} />
    </div>
  );

  if (embedded) return panel;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Open OCCTA chat"><MessageCircle className="h-7 w-7" /></button>;
  return panel;
}
