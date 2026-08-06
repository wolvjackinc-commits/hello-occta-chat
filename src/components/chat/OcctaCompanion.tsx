import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Download,
  ExternalLink,
  LifeBuoy,
  Loader2,
  MessageCircle,
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
import { redactSensitiveText } from "../../../supabase/functions/_shared/companionCore.ts";

type CompanionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  rawContent?: string;
  createdAt: string;
  agent?: "ollie" | "human";
};

type Props = {
  embedded?: boolean;
  className?: string;
  initialOpen?: boolean;
  onClose?: () => void;
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/occta-companion`;
const HISTORY_KEY = "occta-companion-history-v1";
const SESSION_KEY = "occta-companion-session-v1";
const VERIFICATION_KEY = "occta-companion-verification-v1";

const guestActions = [
  "Compare broadband plans",
  "Fix my internet",
  "How switching works",
  "Check my account",
];

const signedInActions = [
  "Check my latest invoice",
  "Track my order",
  "Check my services",
  "Show my support tickets",
];

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

function clearRawContent(messages: CompanionMessage[]): CompanionMessage[] {
  return messages.map((message) => ({ ...message, rawContent: undefined }));
}

function safeStoredMessages(messages: CompanionMessage[]): CompanionMessage[] {
  return messages.slice(-40).map((message) => ({
    ...message,
    content: redactForDisplay(message.content),
    rawContent: undefined,
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
      ? `Welcome back${name ? `, ${name}` : ""}. I'm Ollie from OCCTA. I can securely check your invoices, orders, services and support cases, or help troubleshoot a problem.`
      : `Hi, I'm Ollie from OCCTA. I can explain plans, help with switching, troubleshoot broadband and securely verify an existing account when you need personal information.`,
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
    .map((message) => `[${new Date(message.createdAt).toLocaleString("en-GB")}] ${message.role === "user" ? "Customer" : message.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redactForDisplay(message.content)}`)
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
  const windowRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(userId);
  const quickActions = signedIn ? signedInActions : guestActions;

  useEffect(() => {
    try {
      const rest = (supabase as unknown as { rest?: { headers?: Record<string, string> } }).rest;
      if (rest?.headers) rest.headers["x-session-id"] = sessionId.current;
    } catch {
      // Guest realtime/history still degrades safely if the client internals change.
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

  const requestHuman = useCallback(async () => {
    const recent = messages.slice(-12).map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `I've passed this conversation to an OCCTA advisor. Keep the chat open and you will not need to repeat yourself. For urgent service-impacting issues, call ${CONTACT_PHONE_DISPLAY}.`,
      createdAt: new Date().toISOString(),
      agent: "ollie",
    }]);
    const id = await logConversation(recent, "requested_human");
    if (!id) toast({ title: "Human support requested", description: `The request was noted. You can also call ${CONTACT_PHONE_DISPLAY}.` });
  }, [messages, logConversation, toast]);

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
        const row = payload.new as { role?: string; content?: string };
        if (row.role !== "admin" || !row.content) return;
        setHumanLive(true);
        setAnnouncement("A human OCCTA advisor has replied.");
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: row.content,
          createdAt: new Date().toISOString(),
          agent: "human",
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
        if (status === "resolved") setHumanLive(false);
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

  const send = useCallback(async (value: string) => {
    const raw = value.trim();
    if (!raw || loading) return;
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
        await logConversation([{ role: "user", content: display }]);
        setMessages((current) => clearRawContent(current));
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const apiMessages = [...previousMessages, userMessage].map((message) => ({
        role: message.role,
        content: message.rawContent ?? message.content,
      }));
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
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
  }, [loading, messages, humanLive, conversationId, signedIn, logConversation, openTicket, requestHuman]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(VERIFICATION_KEY);
    setMessages([welcomeMessage(signedIn, firstName)]);
    setHumanLive(false);
    setConversationId(null);
    setAnnouncement("A new secure chat has started.");
  }, [signedIn, firstName]);

  const downloadTranscript = useCallback(() => {
    const transcript = messages.map((message) =>
      `[${new Date(message.createdAt).toLocaleString("en-GB")}] ${message.role === "user" ? "You" : message.agent === "human" ? "OCCTA advisor" : "Ollie"}: ${redactForDisplay(message.content)}`,
    ).join("\n\n");
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
      className={`${embedded ? "h-full min-h-[580px]" : "fixed inset-x-2 bottom-2 top-2 z-50 sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[min(700px,calc(100dvh-3rem))] sm:w-[430px]"} flex flex-col overflow-hidden border-4 border-foreground bg-card shadow-[10px_10px_0_hsl(var(--foreground))] ${className}`}
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
              {humanLive ? "Human advisor connected" : signedIn ? "Secure access to your account" : "Plans, support and secure verification"}
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
        Never share passwords, bank details, card details or one-time codes in chat.
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
                  : <p className="whitespace-pre-wrap">{message.content}</p>}
                <div className={`mt-1 text-[10px] ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(message.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {message.agent === "human" ? " · advisor" : ""}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {humanLive ? "Sending to the advisor…" : "Ollie is checking…"}
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
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={humanLive ? "Message the OCCTA advisor" : "Ask Ollie anything about OCCTA"}
            maxLength={4000}
            disabled={loading}
            aria-label="Chat message"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send message">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <button type="button" onClick={clearChat} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="h-3 w-3" /> New secure chat</button>
          <a href="/support" className="inline-flex items-center gap-1 hover:text-foreground">Support options <ExternalLink className="h-3 w-3" /></a>
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
