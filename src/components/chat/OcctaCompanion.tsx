import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Download,
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
import { CardRenderer, extractCards } from "./StructuredCards";
import { useFocusTrap } from "./useFocusTrap";
import { RaiseTicketDialog, type TicketPrefill } from "@/components/app/RaiseTicketDialog";
import {
  redactSensitiveText,
  type CompanionMessage as CoreMessage,
} from "../../../supabase/functions/_shared/companionCore.ts";
import { resolvePublicConversationReply } from "@/lib/chat/ollieConversation";

type ChatAttachment = {
  path: string;
  name: string;
  size?: number;
  contentType?: string;
};

type CompanionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawContent?: string;
  createdAt: string;
  agent?: "ollie" | "human";
  attachments?: ChatAttachment[];
};

type Props = {
  embedded?: boolean;
  className?: string;
  initialOpen?: boolean;
  onClose?: () => void;
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/occta-companion`;
const HISTORY_KEY = "occta-companion-history-v2";
const SESSION_KEY = "occta-companion-session-v1";
const VERIFICATION_KEY = "occta-companion-verification-v1";
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif",
  "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "pptx",
]);

const guestActions = [
  "Check broadband availability",
  "Fix my internet",
  "Compare broadband plans",
  "How switching works",
];

const signedInActions = [
  "Check my latest invoice",
  "Track my order",
  "Check my services",
  "Show my support tickets",
];

const actionRoutes: Record<string, string> = {
  "open help centre": "/help",
  "check availability": "/build-plan",
  "check broadband availability": "/build-plan",
  "open availability checker": "/build-plan",
  "check my address": "/build-plan",
  "start an availability check": "/build-plan",
  "view broadband plans": "/broadband",
  "view sim plans": "/sim",
  "open own-router guide": "/help/own-router-setup",
  "read cancellation terms": "/cancellation",
  "read the complaints code": "/legal/complaints-code",
  "open service status": "/status",
  "check service status": "/status",
  "digital voice information": "/landline",
  "start a switch": "/switching",
  "set up direct debit": "/direct-debit-setup",
};

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function redactForDisplay(value: string): string {
  return redactSensitiveText(value)
    .replace(/\[date of birth provided securely\]/g, "Date of birth provided securely")
    .replace(/\[bank details removed\]/g, "Bank details removed")
    .replace(/\[payment number removed\]/g, "Payment number removed");
}

function safeAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const path = typeof row.path === "string" ? row.path.slice(0, 500) : "";
    const name = typeof row.name === "string" ? row.name.replace(/[\r\n]/g, " ").slice(0, 180) : "Attachment";
    if (!path) return [];
    return [{
      path,
      name,
      size: Number.isFinite(Number(row.size)) ? Number(row.size) : undefined,
      contentType: typeof row.contentType === "string" ? row.contentType.slice(0, 160) : undefined,
    }];
  });
}

function clearRawContent(messages: CompanionMessage[]): CompanionMessage[] {
  return messages.map((message) => ({ ...message, rawContent: undefined }));
}

function safeStoredMessages(messages: CompanionMessage[]): CompanionMessage[] {
  return messages.slice(-40).map((message) => ({
    ...message,
    content: redactForDisplay(message.content),
    rawContent: undefined,
    attachments: safeAttachments(message.attachments),
  }));
}

function loadStoredMessages(): CompanionMessage[] {
  try {
    const value = sessionStorage.getItem(HISTORY_KEY);
    const parsed = value ? JSON.parse(value) : null;
    if (!Array.isArray(parsed)) return [];
    return safeStoredMessages(parsed.filter((row) => row && (row.role === "user" || row.role === "assistant")));
  } catch {
    sessionStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

function extractOptions(content: string): { text: string; options: string[] } {
  const match = content.match(/<<<OPTIONS:(\[[\s\S]*?\])>>>\s*$/);
  if (!match) return { text: content.trim(), options: [] };
  let options: string[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) options = parsed.map(String).filter(Boolean).slice(0, 4);
  } catch {
    options = [];
  }
  return { text: content.replace(match[0], "").trim(), options };
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes < 1) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(attachment: ChatAttachment) {
  return attachment.contentType?.startsWith("image/")
    ? <ImageIcon className="h-4 w-4 shrink-0" />
    : <FileText className="h-4 w-4 shrink-0" />;
}

function AssistantBody({ message, onAction }: { message: CompanionMessage; onAction: (value: string) => void }) {
  const { text: cardFree, cards } = extractCards(message.content);
  const { text, options } = extractOptions(cardFree);
  return (
    <div className="space-y-3">
      {text && (
        <Streamdown className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-li:my-0 prose-a:text-primary prose-strong:text-foreground">
          {text}
        </Streamdown>
      )}
      {cards.map((card, index) => <CardRenderer key={index} card={card} />)}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t-2 border-foreground/15 pt-3">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAction(option)}
              className="border-2 border-foreground bg-background px-3 py-2 text-left text-xs font-display uppercase shadow-[2px_2px_0_hsl(var(--foreground))] transition hover:bg-primary hover:text-primary-foreground active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function welcomeMessage(signedIn: boolean, name?: string): CompanionMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: signedIn
      ? `Welcome back${name ? `, ${name}` : ""}. I'm Ollie from OCCTA. I can check your account, troubleshoot a service problem, find the right guide or bring in a human advisor without making you start again.`
      : `Hi, I'm Ollie from OCCTA. Tell me what you need in normal words — I can help with broadband, SIMs, switching, billing questions and faults, remember the conversation as we troubleshoot, and bring in an advisor when needed.`,
    createdAt: new Date().toISOString(),
    agent: "ollie",
  };
}

function buildTicketPrefill(messages: CompanionMessage[]): TicketPrefill {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => redactForDisplay(message.content))
    .join(" ")
    .toLowerCase();
  const category = /invoice|bill|charge|vat/.test(userText)
    ? "billing"
    : /payment|direct debit|card/.test(userText)
      ? "payments"
      : /sim|mobile|roaming/.test(userText)
        ? "mobile"
        : /landline|digital voice|home phone/.test(userText)
          ? "landline"
          : /account|login|profile/.test(userText)
            ? "account"
            : /broadband|internet|router|wi-?fi|fibre/.test(userText)
              ? "broadband"
              : "other";
  const priority: TicketPrefill["priority"] = /no internet|outage|line down|urgent/.test(userText) ? "high" : "normal";
  const first = messages.find((message) => message.role === "user")?.content ?? "Support request from chat";
  const transcript = messages
    .map((message) => {
      const attachments = message.attachments?.length ? `\nAttachments: ${message.attachments.map((item) => item.name).join(", ")}` : "";
      return `[${new Date(message.createdAt).toLocaleString("en-GB")}] ${message.role === "user" ? "Customer" : message.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redactForDisplay(message.content)}${attachments}`;
    })
    .join("\n\n");
  return {
    category,
    priority,
    subject: redactForDisplay(first).replace(/\s+/g, " ").slice(0, 110),
    message: `Please review the issue discussed with Ollie.\n\n${transcript.slice(-1600)}`,
    transcript: transcript.slice(-7000),
  };
}

export default function OcctaCompanion({ embedded = false, className = "", initialOpen = false, onClose }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(embedded || initialOpen);
  const [messages, setMessages] = useState<CompanionMessage[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [humanLive, setHumanLive] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<TicketPrefill | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  const sessionId = useRef(getSessionId());
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(userId);
  const quickActions = signedIn ? signedInActions : guestActions;

  useEffect(() => {
    try {
      const rest = (supabase as unknown as { rest?: { headers?: Record<string, string> } }).rest;
      if (rest?.headers) rest.headers["x-session-id"] = sessionId.current;
    } catch {
      // Guest realtime/history safely degrades if client internals change.
    }
  }, []);

  useEffect(() => {
    const initialise = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id ?? null);
        const metadataName = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name;
        setFirstName(typeof metadataName === "string" ? metadataName.split(/\s+/)[0] : undefined);
        if (session?.user?.id) {
          const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle();
          if (data?.full_name) setFirstName(data.full_name.split(/\s+/)[0]);
        }
      } finally {
        setAuthReady(true);
      }
    };
    void initialise();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      const name = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name;
      setFirstName(typeof name === "string" ? name.split(/\s+/)[0] : undefined);
      if (!session) sessionStorage.removeItem(VERIFICATION_KEY);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setMessages((current) => {
      const hasCustomerTurn = current.some((message) => message.role === "user");
      if (current.length === 0 || (!hasCustomerTurn && current.length === 1 && current[0].role === "assistant")) {
        return [welcomeMessage(signedIn, firstName)];
      }
      return current;
    });
  }, [authReady, signedIn, firstName]);

  useEffect(() => {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(safeStoredMessages(messages)));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("id, status")
        .eq("session_id", sessionId.current)
        .maybeSingle();
      if (cancelled || !data?.id) return;
      setConversationId(data.id);
      setHumanLive(data.status === "live");
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusTrap({
    active: !embedded && open,
    container: windowRef,
    onEscape: useCallback(() => {
      setOpen(false);
      onClose?.();
    }, [onClose]),
  });

  const logConversation = useCallback(async (turns: { role: string; content: string }[], reason?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId: sessionId.current,
          mode: reason ? undefined : "log",
          reason,
          summary: redactForDisplay(turns.find((turn) => turn.role === "user")?.content ?? "Customer chat"),
          lastMessage: redactForDisplay(latestUserTurn?.content ?? ""),
          transcript: turns.map((turn) => ({ ...turn, content: redactForDisplay(turn.content) })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.conversationId) setConversationId(payload.conversationId);
      return payload?.conversationId as string | undefined;
    } catch {
      return undefined;
    }
  }, []);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    const recent = messages.slice(-10).map((message) => ({ role: message.role, content: message.content }));
    const id = await logConversation(recent.length ? recent : [{ role: "assistant", content: "OCCTA customer chat started" }]);
    return id ?? null;
  }, [conversationId, messages, logConversation]);

  const requestHuman = useCallback(async () => {
    const recent = messages.slice(-14).map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `I’ve passed this conversation to an OCCTA advisor with the recent context attached. Keep the chat open and you won’t need to repeat yourself. For an urgent service-impacting issue, call ${CONTACT_PHONE_DISPLAY}.`,
      createdAt: new Date().toISOString(),
      agent: "ollie",
    }]);
    const id = await logConversation(recent, "requested_human");
    if (!id) toast({ title: "Human support requested", description: `The request was noted. You can also call ${CONTACT_PHONE_DISPLAY}.` });
  }, [messages, logConversation, toast]);

  const openAttachment = useCallback(async (attachment: ChatAttachment) => {
    try {
      const { data, error } = await supabase.functions.invoke("chat-handoff", {
        body: { sessionId: sessionId.current, mode: "customer_download", path: attachment.path },
      });
      if (error || !data?.url) throw error ?? new Error("No download URL");
      window.open(String(data.url), "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Attachment unavailable", description: "The file may still be scanning or was blocked for safety.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`customer-companion-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as { role?: string; content?: string; attachments?: unknown; created_at?: string };
        if (row.role !== "admin") return;
        setHumanLive(true);
        setAnnouncement("A human OCCTA advisor has replied.");
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: row.content || (safeAttachments(row.attachments).length ? "Attachment from your OCCTA advisor" : "OCCTA advisor replied"),
          createdAt: row.created_at || new Date().toISOString(),
          agent: "human",
          attachments: safeAttachments(row.attachments),
        }]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_conversations",
        filter: `id=eq.${conversationId}`,
      }, (payload) => {
        const status = (payload.new as { status?: string }).status;
        if (status === "live") setHumanLive(true);
        if (status === "resolved" || status === "closed") setHumanLive(false);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  const openTicket = useCallback(() => {
    if (!signedIn) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `To protect your account, the secure ticket form requires sign-in. You can sign in now, ask me to connect a human advisor, or call ${CONTACT_PHONE_DISPLAY}.\n\n<<<OPTIONS:["Sign in","Connect me to a human","Keep troubleshooting"]>>>`,
        createdAt: new Date().toISOString(),
        agent: "ollie",
      }]);
      return;
    }
    setTicketPrefill(buildTicketPrefill(messages));
    setTicketOpen(true);
  }, [signedIn, messages]);

  const uploadAttachment = useCallback(async (file: File) => {
    if (uploadingAttachment) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_ATTACHMENT_EXTENSIONS.has(extension)) {
      toast({
        title: "File type not supported",
        description: "Attach an image, PDF, text/CSV file, or common Office document.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({ title: "File too large", description: "Chat attachments can be up to 15 MB.", variant: "destructive" });
      return;
    }

    setUploadingAttachment(true);
    try {
      const convId = await ensureConversation();
      if (!convId) throw new Error("Could not create the secure chat thread");
      const { data: { session } } = await supabase.auth.getSession();
      const ownerPrefix = session?.user?.id ? `user/${session.user.id}` : `guest/${sessionId.current}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "attachment";
      const path = `${ownerPrefix}/${convId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { data: scanData, error: scanError } = await supabase.functions.invoke("chat-attachment-scan", {
        body: {
          path,
          conversation_id: convId,
          content_type: file.type || undefined,
          session_id: sessionId.current,
        },
      });
      if (scanError || scanData?.status !== "clean") {
        throw new Error("This file could not pass the attachment safety check");
      }

      const attachment: ChatAttachment = {
        path,
        name: file.name,
        size: file.size,
        contentType: file.type || undefined,
      };
      const { error: messageError } = await supabase.functions.invoke("chat-handoff", {
        body: {
          sessionId: sessionId.current,
          mode: "customer_attachment",
          message: `Attachment: ${file.name}`,
          attachments: [attachment],
        },
      });
      if (messageError) throw messageError;

      const attachmentMessage: CompanionMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: `Attached: ${file.name}`,
        createdAt: new Date().toISOString(),
        attachments: [attachment],
      };
      setMessages((current) => [...current, attachmentMessage]);

      if (!humanLive) {
        const recentText = messages.slice(-5).map((message) => message.content).join(" ").toLowerCase();
        const note = /internet|router|ont|light|wi-?fi|broadband/.test(recentText)
          ? `Thanks — **${file.name}** is securely attached to this conversation and will be visible to an OCCTA advisor if we hand the fault over. I won’t pretend I can read details hidden inside the file; if it’s a router/ONT photo, tell me the light label you can read and I’ll keep troubleshooting with you.`
          : `Thanks — **${file.name}** is securely attached to this conversation and will be visible to an OCCTA advisor if needed. Tell me what you want help with in the file and I’ll keep the conversation moving.`;
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: note,
          createdAt: new Date().toISOString(),
          agent: "ollie",
        }]);
      }
      setAnnouncement("Attachment uploaded securely.");
    } catch (error) {
      const description = error instanceof Error ? error.message : "Please try again.";
      toast({ title: "Attachment not sent", description, variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploadingAttachment, ensureConversation, humanLive, messages, toast]);

  const send = useCallback(async (value: string) => {
    const raw = value.trim();
    if (!raw || loading || uploadingAttachment) return;
    const actionRoute = actionRoutes[raw.toLowerCase()];
    if (actionRoute) {
      window.location.assign(actionRoute);
      return;
    }
    if (/^(sign in|login)$/i.test(raw)) {
      window.location.assign("/auth");
      return;
    }
    if (/open my dashboard/i.test(raw)) {
      window.location.assign("/dashboard");
      return;
    }
    if (/raise .*ticket|raise a ticket|billing ticket/i.test(raw)) {
      openTicket();
      return;
    }
    if (/connect me to a human|talk to a human|speak to (a )?(human|advisor|agent)/i.test(raw)) {
      void requestHuman();
      return;
    }

    const display = redactForDisplay(raw);
    const userMessage: CompanionMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: display,
      rawContent: raw,
      createdAt: new Date().toISOString(),
    };
    const previousMessages = messages;
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setAnnouncement("Ollie is checking that now.");

    try {
      if (humanLive && conversationId) {
        const { error } = await supabase.functions.invoke("chat-handoff", {
          body: { sessionId: sessionId.current, mode: "customer_message", message: display },
        });
        if (error) throw error;
        setMessages((current) => clearRawContent(current));
        return;
      }

      const coreMessages: CoreMessage[] = [...previousMessages, userMessage]
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.rawContent ?? message.content }));

      // Handle known public/support conversations locally from approved OCCTA
      // playbooks. Because the full history is passed in, short replies such as
      // "Red lights" continue the fault instead of starting a new question.
      const humanSupportReply = resolvePublicConversationReply(coreMessages);
      if (humanSupportReply) {
        setMessages((current) => [
          ...clearRawContent(current),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: humanSupportReply,
            createdAt: new Date().toISOString(),
            agent: "ollie",
          },
        ]);
        setAnnouncement("Ollie has replied.");
        void logConversation([
          { role: "user", content: display },
          { role: "assistant", content: humanSupportReply },
        ]);
        return;
      }

      // Account-specific requests and questions not covered by a deterministic
      // playbook go to the secure companion endpoint. That endpoint uses verified
      // account data and approved OCCTA knowledge, not a Lovable model runtime.
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: coreMessages,
          sessionId: sessionId.current,
          verificationToken: sessionStorage.getItem(VERIFICATION_KEY),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "companion_request_failed");
      const verifiedNow = typeof payload?.verificationToken === "string" && payload.verificationToken.length > 0;
      if (verifiedNow) sessionStorage.setItem(VERIFICATION_KEY, payload.verificationToken);
      const assistantContent = String(payload?.content ?? "I couldn't load a reliable answer just now.");
      const verificationPending = !signedIn && payload?.source === "account" && !verifiedNow;
      setMessages((current) => [
        ...(verificationPending ? current : clearRawContent(current)),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
          createdAt: new Date().toISOString(),
          agent: "ollie",
        },
      ]);
      setAnnouncement("Ollie has replied.");
      void logConversation([
        { role: "user", content: display },
        { role: "assistant", content: assistantContent },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "request_failed";
      setMessages((current) => [
        ...clearRawContent(current),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${message.includes("wait") ? message : "I couldn't load that safely just now."} Please try again or call ${CONTACT_PHONE_DISPLAY}.\n\n<<<OPTIONS:["Try again","Open Help Centre","Talk to a human"]>>>`,
          createdAt: new Date().toISOString(),
          agent: "ollie",
        },
      ]);
      setAnnouncement("The request could not be completed.");
    } finally {
      setLoading(false);
    }
  }, [loading, uploadingAttachment, messages, humanLive, conversationId, signedIn, logConversation, openTicket, requestHuman]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(VERIFICATION_KEY);
    setMessages([welcomeMessage(signedIn, firstName)]);
    setHumanLive(false);
    setConversationId(null);
    setAnnouncement("A new secure chat has started.");
  }, [signedIn, firstName]);

  const downloadTranscript = useCallback(() => {
    const transcript = messages.map((message) => {
      const attachments = message.attachments?.length ? `\nAttachments: ${message.attachments.map((item) => item.name).join(", ")}` : "";
      return `[${new Date(message.createdAt).toLocaleString("en-GB")}] ${message.role === "user" ? "You" : message.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redactForDisplay(message.content)}${attachments}`;
    }).join("\n\n");
    const blob = new Blob([`OCCTA chat transcript\nGenerated: ${new Date().toLocaleString("en-GB")}\n\n${transcript}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `occta-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const chatPanel = (
    <motion.div
      ref={windowRef}
      role="dialog"
      aria-modal={!embedded}
      aria-labelledby="occta-companion-title"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      className={`${embedded ? "h-full min-h-[580px]" : "fixed inset-x-2 bottom-2 top-2 z-[9999] sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(720px,calc(100dvh-3rem))] sm:w-[440px]"} flex flex-col overflow-hidden border-4 border-foreground bg-card shadow-[10px_10px_0_hsl(var(--foreground))] ${className}`}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <header className="flex items-center justify-between border-b-4 border-foreground bg-primary px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-primary-foreground bg-background">
            {humanLive ? <UserRound className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div id="occta-companion-title" className="font-display uppercase text-primary-foreground">
              {humanLive ? "OCCTA Advisor" : "Ollie — OCCTA Assist"}
            </div>
            <div className="truncate text-[11px] text-primary-foreground/85">
              {humanLive ? "Human advisor connected · conversation retained" : signedIn ? "Account-aware support · guides" : "Human-style support · guides"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => window.location.assign("/help")} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Open Help Centre"><LifeBuoy className="h-4 w-4" /></button>
          <button type="button" onClick={openTicket} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Raise support ticket"><TicketPlus className="h-4 w-4" /></button>
          <button type="button" onClick={downloadTranscript} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Download transcript"><Download className="h-4 w-4" /></button>
          {!embedded && <button type="button" onClick={() => { setOpen(false); onClose?.(); }} className="p-2 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Close chat"><X className="h-5 w-5" /></button>}
        </div>
      </header>

      <div className="flex items-center gap-2 border-b-2 border-foreground/20 bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        Conversation context is retained in this session. Never share passwords, bank/card details or one-time codes.
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-foreground bg-secondary">
                  {message.agent === "human" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
              )}
              <div className={`${message.role === "user" ? "max-w-[82%] bg-primary text-primary-foreground" : "max-w-[88%] border-2 border-foreground bg-background text-foreground"} px-3 py-2 text-sm`}>
                {message.role === "assistant"
                  ? <AssistantBody message={message} onAction={(option) => void send(option)} />
                  : message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment) => (
                      <button
                        key={attachment.path}
                        type="button"
                        onClick={() => void openAttachment(attachment)}
                        className={`flex w-full items-center gap-2 border-2 px-2 py-2 text-left text-xs ${message.role === "user" ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-foreground/30 bg-muted/40"}`}
                      >
                        {attachmentIcon(attachment)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{attachment.name}</span>
                          {formatFileSize(attachment.size) && <span className="block opacity-70">{formatFileSize(attachment.size)}</span>}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                <div className={`mt-1 text-[10px] ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(message.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {message.agent === "human" ? " · advisor" : ""}
                </div>
              </div>
            </div>
          ))}
          {(loading || uploadingAttachment) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadingAttachment ? "Scanning and attaching the file…" : humanLive ? "Sending to the advisor…" : "Ollie is checking the conversation…"}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t-2 border-foreground/20 px-4 py-3">
          {quickActions.map((action) => (
            <button key={action} type="button" onClick={() => void send(action)} className="border-2 border-foreground bg-background px-3 py-2 text-xs font-display uppercase hover:bg-secondary">
              {action}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="border-t-4 border-foreground bg-background p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAttachment(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploadingAttachment}
            aria-label="Attach a file"
            title="Attach image or document"
          >
            {uploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={humanLive ? "Message your OCCTA advisor…" : "Tell Ollie what happened…"}
            maxLength={4000}
            disabled={loading || uploadingAttachment}
            aria-label="Chat message"
          />
          <Button type="submit" size="icon" disabled={loading || uploadingAttachment || !input.trim()} aria-label="Send message">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <button type="button" onClick={clearChat} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="h-3 w-3" /> New chat</button>
          <span className="hidden sm:inline">Attachments up to 15 MB · safety scanned</span>
          <a href="/support" className="inline-flex items-center gap-1 hover:text-foreground">Support <ExternalLink className="h-3 w-3" /></a>
        </div>
      </form>

      <RaiseTicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        prefill={ticketPrefill}
        onSubmitted={({ ref }) => {
          if (!ref) return;
          setMessages((current) => [...current, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Your support ticket has been created. Reference: **${ref}**. The team can see the attached chat summary.`,
            createdAt: new Date().toISOString(),
            agent: "ollie",
          }]);
        }}
      />
    </motion.div>
  );

  if (embedded) return chatPanel;

  return (
    <>
      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
          aria-label="Open OCCTA chat"
        >
          <MessageCircle className="h-7 w-7" />
        </motion.button>
      )}
      <AnimatePresence>{open ? chatPanel : null}</AnimatePresence>
    </>
  );
}
