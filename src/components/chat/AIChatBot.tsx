import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { extractCards, CardRenderer } from "./StructuredCards";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

// Extract a trailing <<<OPTIONS:[...]>>> block OR fallback to parsing numbered
// inline options like "1) Foo, 2) Bar, 3) Baz?" so we can render clickable chips.
function extractQuickReplies(content: string): { text: string; options: string[] } {
  let text = content;
  let options: string[] = [];

  const tokenMatch = text.match(/<<<OPTIONS:(\[[\s\S]*?\])>>>/);
  if (tokenMatch) {
    try {
      const parsed = JSON.parse(tokenMatch[1]);
      if (Array.isArray(parsed)) {
        options = parsed.map((o) => String(o)).filter(Boolean).slice(0, 5);
      }
    } catch {
      /* ignore */
    }
    text = text.replace(tokenMatch[0], "").trim();
  }

  if (options.length === 0) {
    // Look at the last non-empty line for a pattern like "1) X, 2) Y, 3) Z?"
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] ?? "";
    const matches = [...last.matchAll(/\d+\)\s*([^,?\n][^,?\n]*?)(?=(?:\s*,\s*\d+\))|\s*\?|\s*$)/g)];
    if (matches.length >= 2) {
      options = matches.map((m) => m[1].trim()).filter(Boolean).slice(0, 5);
      // Remove the numbered list portion from the last line
      const stripped = last.replace(/(\d+\)\s*[^,?\n]+(?:,\s*)?)+\??/g, "").trim();
      lines[lines.length - 1] = stripped;
      text = lines.filter(Boolean).join("\n");
    }
  }

  return { text: text.trim(), options };
}

function AssistantMessageBody({
  message,
  onQuickReply,
}: {
  message: { role: string; content: string };
  onQuickReply?: (msg: string) => void;
}) {
  if (message.role !== "assistant") {
    return <p className="whitespace-pre-wrap">{message.content}</p>;
  }
  const { text: afterCards, cards } = extractCards(message.content);
  const { text, options } = extractQuickReplies(afterCards);
  return (
    <div className="space-y-3">
      {text && (
        <Streamdown className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground prose-p:my-2 prose-strong:text-foreground prose-li:my-0 prose-ul:my-2 prose-ol:my-2 prose-a:text-primary">
          {text}
        </Streamdown>
      )}
      {cards.map((card, i) => (
        <CardRenderer key={i} card={card} />
      ))}
      {options.length > 0 && onQuickReply && (
         <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-foreground/20 pt-3">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onQuickReply(opt)}
              className="px-3 py-2 text-xs font-display uppercase border-2 border-foreground bg-background hover:bg-primary hover:text-primary-foreground transition-colors text-left shadow-[3px_3px_0_hsl(var(--foreground))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2,
  Minimize2,
  Maximize2,
  Paperclip,
  Download,
  BookOpen,
  LifeBuoy,
  HelpCircle,
  TicketPlus
} from "lucide-react";
import ChatHelpPanel from "./ChatHelpPanel";
import { RaiseTicketDialog, type TicketPrefill } from "@/components/app/RaiseTicketDialog";

type AttachmentMeta = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: AttachmentMeta[];
};

interface AIChatBotProps {
  embedded?: boolean;
  className?: string;
  autoFocusInput?: boolean;
  initialOpen?: boolean;
  onClose?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// Default quick actions for customers
const defaultQuickActions = [
  { label: "Compare plans", message: "Help me compare your broadband and SIM plans" },
  { label: "Broadband deals", message: "Tell me about your broadband plans" },
  { label: "SIM only", message: "What SIM-only plans do you offer?" },
  { label: "Switch to OCCTA", message: "How do I switch to OCCTA from my current provider?" },
  { label: "Speak to support", message: "I need to speak to human support" },
];

// Self-service links (never routed through the LLM — they take users straight
// to the answer so they can resolve queries themselves).
const selfServiceLinks: { label: string; href: string; icon: typeof BookOpen }[] = [
  { label: "Help Centre", href: "/help", icon: LifeBuoy },
  { label: "FAQ", href: "/faq", icon: HelpCircle },
  { label: "Guides", href: "/guides", icon: BookOpen },
];

const signedInQuickActions = [
  { label: "View invoices", message: "View my invoices" },
  { label: "Track order", message: "Track my order" },
  { label: "Check services", message: "Check my services" },
  { label: "Support tickets", message: "Show my support tickets" },
  { label: "Account details", message: "Show my account details" },
  { label: "Raise a ticket", message: "Raise a support ticket" },
];

// Admin quick actions
const adminQuickActions = [
  { label: "Find customer", message: "I need to look up a customer account" },
  { label: "Add service", message: "Help me add a new service for a customer" },
  { label: "Open ticket", message: "I need to create a support ticket" },
  { label: "System status", message: "What's the current system status?" },
];

const STORAGE_KEY = "occta-ai-chat";
const SESSION_KEY = "occta-chat-session";

// Get or create session ID for analytics
const getSessionId = () => {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

const AIChatBot = forwardRef<HTMLDivElement, AIChatBotProps>(
  ({ embedded = false, className = "", autoFocusInput = false, initialOpen = false, onClose }, ref) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(embedded || initialOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUserOpened, setHasUserOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<TicketPrefill | undefined>(undefined);
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const sessionId = useRef(getSessionId());
  const isFreshChat = messages.length <= 1 && messages[0]?.role === "assistant";

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!autoFocusInput) return;
    const focusTimer = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(focusTimer);
  }, [autoFocusInput]);

  // Restore persisted chat history
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    // Welcome message is set in the userState useEffect
  }, []);

  // Persist chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Get current user and check admin status
  useEffect(() => {
    const checkAdminStatus = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .single();
      setIsAdmin(!!data);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set welcome message based on user state
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return; // Already have messages

    let welcomeContent: string;
    if (isAdmin) {
      welcomeContent = "🔐 Admin mode active.\nHi! I'm IRA, ready to help with customers, services, tickets, or system checks.";
    } else if (user) {
      welcomeContent = `Welcome back! 😊\nI'm IRA — want help with your services, billing, or something else today?`;
    } else {
      welcomeContent = "👋 Hey! I'm IRA, your Intelligent Reliable Assistant.\nI can help you compare broadband & SIM plans, explain how switching works, or answer questions — no pressure, no contracts 🙂";
    }

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeContent,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [user, isAdmin]);

  // Get the appropriate quick actions based on user role
  const quickActions = isAdmin 
    ? [...signedInQuickActions, ...adminQuickActions] 
    : user ? signedInQuickActions : defaultQuickActions;

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && hasUserOpened) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized, hasUserOpened]);

  // Listen for external open-ai-chat event (from Support page "Start Chat" button)
  useEffect(() => {
    if (embedded) return; // Only for floating version
    const handleOpenChat = () => {
      setHasUserOpened(true);
      setIsOpen(true);
    };
    window.addEventListener('open-ai-chat', handleOpenChat);
    return () => window.removeEventListener('open-ai-chat', handleOpenChat);
  }, [embedded]);

  // Allow other parts of the app to pre-seed the next user message.
  useEffect(() => {
    const handleSeed = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) setInputValue(detail.message);
    };
    window.addEventListener("ai-chat-seed", handleSeed as EventListener);
    return () => window.removeEventListener("ai-chat-seed", handleSeed as EventListener);
  }, []);

  const formatAttachmentSize = useCallback((size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const formatAttachmentSummary = useCallback((attachments: AttachmentMeta[]) => {
    if (!attachments.length) return "";
    return attachments
      .map((file) => `- ${file.name} (${file.type || "unknown"}, ${formatAttachmentSize(file.size)})`)
      .join("\n");
  }, [formatAttachmentSize]);

  const sendMessage = useCallback(async (messageText: string, attachments: AttachmentMeta[] = []) => {
    const trimmedMessage = messageText.trim();
    if ((!trimmedMessage && attachments.length === 0) || isLoading) return;
    const effectiveMessage = trimmedMessage || "Shared attachment(s).";

    const userMessage: Message = { 
      id: crypto.randomUUID(),
      role: "user", 
      content: effectiveMessage,
      createdAt: new Date().toISOString(),
      attachments: attachments.length ? attachments : undefined,
    };
    pendingMessageRef.current = userMessage.content;
    setLastFailedMessage(null);
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setPendingAttachments([]);
    setIsLoading(true);

    try {
      const messagesForApi = [...messages, userMessage].map((message) => {
        if (message.role === "user" && message.attachments?.length) {
          return {
            role: message.role,
            content: `${message.content}\n\nAttachments:\n${formatAttachmentSummary(message.attachments)}`,
          };
        }
        return { role: message.role, content: message.content };
      });
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: messagesForApi,
          userId: user?.id,
          sessionId: sessionId.current,
        }),
      });

      if (response.status === 429) {
        toast({
          title: "Too many requests",
          description: "Please wait a moment before sending another message.",
          variant: "destructive"
        });
        setLastFailedMessage(userMessage.content);
        return;
      }

      if (response.status === 402) {
        toast({
          title: "Service unavailable",
          description: `Please call us at ${CONTACT_PHONE_DISPLAY} for assistance.`,
          variant: "destructive"
        });
        setLastFailedMessage(userMessage.content);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.error) {
        setMessages(prev => [...prev, { 
          id: crypto.randomUUID(),
          role: "assistant", 
          content: data.error,
          createdAt: new Date().toISOString(),
        }]);
        setLastFailedMessage(userMessage.content);
      } else {
        setMessages(prev => [...prev, { 
          id: crypto.randomUUID(),
          role: "assistant", 
          content: data.content,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(),
        role: "assistant", 
        content: `Sorry, I'm having trouble right now. Please try again or call us at ${CONTACT_PHONE_DISPLAY}.`,
        createdAt: new Date().toISOString(),
      }]);
      setLastFailedMessage(userMessage.content);
    } finally {
      setIsLoading(false);
      pendingMessageRef.current = null;
    }
  }, [messages, user?.id, isLoading, toast, formatAttachmentSummary]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue, pendingAttachments);
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    const resetMessage = isAdmin 
      ? "🔐 Fresh start! What would you like help with?"
      : "Fresh start! 😊 What can I help you with today?";
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: resetMessage,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLastFailedMessage(null);
  };

  // Download the current chat transcript as a .txt file so customers can keep
  // their own record without waiting on an advisor.
  const handleDownloadTranscript = useCallback(() => {
    if (messages.length === 0) return;
    setStatusAnnouncement("Preparing transcript…");
    const header = `OCCTA chat transcript\nGenerated: ${new Date().toLocaleString("en-GB")}\n${user?.email ? `Account: ${user.email}\n` : ""}\n`;
    const body = messages
      .map((m) => `[${new Date(m.createdAt).toLocaleString("en-GB")}] ${m.role === "user" ? "You" : "IRA"}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `occta-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusAnnouncement(`Transcript downloaded (${messages.length} messages).`);
    toast({
      title: "Transcript downloaded",
      description: `${messages.length} message${messages.length === 1 ? "" : "s"} saved to your device.`,
    });
  }, [messages, user?.email]);

  // Build a compact conversation summary for pre-filling a support ticket.
  const buildConversationSummary = useCallback(() => {
    const recent = messages.slice(-12).filter((m) => m.id !== "welcome");
    if (recent.length === 0) return "";
    const body = recent
      .map((m) => `${m.role === "user" ? "Me" : "IRA"}: ${m.content.replace(/\s+/g, " ").trim()}`)
      .join("\n\n");
    return `Conversation summary from chat on ${new Date().toLocaleString("en-GB")}:\n\n${body}`.slice(0, 1800);
  }, [messages]);

  // Guess category + priority from the last few user messages so the ticket
  // form arrives pre-filled but still editable.
  const guessTicketPrefill = useCallback((): TicketPrefill => {
    const text = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();
    const category =
      /broadband|internet|wi-?fi|fibre|router/.test(text) ? "broadband"
        : /sim|mobile|roaming|esim/.test(text) ? "mobile"
        : /landline|home phone|voice/.test(text) ? "landline"
        : /invoice|billing|refund|charge/.test(text) ? "billing"
        : /payment|direct debit|worldpay|card/.test(text) ? "payments"
        : /account|login|password|profile/.test(text) ? "account"
        : "other";
    const priority: TicketPrefill["priority"] =
      /(urgent|emergency|asap|no internet|not working|line down|outage)/.test(text) ? "high"
        : /nuisance|slow|intermittent/.test(text) ? "normal"
        : "normal";
    const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
    const subject = firstUser.replace(/\s+/g, " ").slice(0, 80) || "Follow-up from chat with IRA";
    return {
      category,
      priority,
      subject,
      message: buildConversationSummary(),
    };
  }, [messages, buildConversationSummary]);

  const handleOpenTicket = useCallback(() => {
    setTicketPrefill(guessTicketPrefill());
    setTicketOpen(true);
    setHelpOpen(false);
  }, [guessTicketPrefill]);

  const handleEscalateToHuman = useCallback(() => {
    setHelpOpen(false);
    sendMessage("I'd like to speak to a human support advisor please.");
  }, [sendMessage]);

  // Escape closes the floating chat for keyboard accessibility.
  useEffect(() => {
    if (embedded || !isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const container = chatWindowRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [embedded, isOpen, onClose]);

  // Restore focus to the trigger button when the floating chat closes.
  useEffect(() => {
    if (embedded) return;
    if (!isOpen) triggerButtonRef.current?.focus();
  }, [embedded, isOpen]);

  // Announce loading + errors to screen readers via the live region.
  useEffect(() => {
    if (isLoading) setStatusAnnouncement("Assistant is thinking…");
  }, [isLoading]);
  useEffect(() => {
    if (lastFailedMessage) setStatusAnnouncement("The last message failed to send.");
  }, [lastFailedMessage]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const handleAttachmentsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const newAttachments = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
    event.target.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((file) => file.id !== id));
  };

  const handleSendToAdvisor = () => {
    sendMessage("Please send my attachments to an advisor/admin for further help.", pendingAttachments);
  };

  // Floating bubble version
  if (!embedded) {
    return (
      <>
        {/* Chat Bubble */}
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              ref={triggerButtonRef}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => {
                setHasUserOpened(true);
                setIsOpen(true);
              }}
              className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"
              aria-label="Open chat with IRA support assistant"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
            >
              <MessageCircle className="w-7 h-7 text-primary-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={chatWindowRef}
              role="dialog"
              aria-modal="false"
              aria-labelledby="ira-chat-heading"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                height: isMinimized ? "auto" : undefined
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed z-50 bg-card border-4 border-foreground shadow-[10px_10px_0_hsl(var(--foreground))] flex flex-col overflow-hidden inset-x-2 bottom-2 top-2 sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto sm:w-[420px] sm:h-[min(680px,calc(100dvh-3rem))] ${className}`}
            >
              {/* Live region for screen-reader status updates */}
              <div
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {statusAnnouncement}
              </div>
              {/* Header */}
              <div className="bg-primary px-4 py-3 flex items-center justify-between border-b-4 border-foreground">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 border-2 border-primary-foreground bg-background flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <span
                      id="ira-chat-heading"
                      className="block font-display text-primary-foreground uppercase text-sm leading-none"
                    >
                      {isAdmin ? "IRA Admin" : "IRA"}
                    </span>
                    <span className="block text-[10px] uppercase text-primary-foreground/80 mt-1 truncate">
                      {user ? "Secure account assistant" : "OCCTA telecom support"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearChat}
                    className="px-2 py-1 text-xs font-display uppercase text-primary-foreground/80 hover:text-primary-foreground"
                    aria-label="Start a new chat"
                  >
                    New chat
                  </button>
                  <button
                    onClick={() => setHelpOpen((v) => !v)}
                    className="p-1.5 hover:bg-primary-foreground/10 transition-colors"
                    aria-label={helpOpen ? "Close Help Centre" : "Open Help Centre search"}
                    aria-pressed={helpOpen}
                    title="Help Centre"
                  >
                    <LifeBuoy className="w-4 h-4 text-primary-foreground" />
                  </button>
                  {!isAdmin && (
                    <button
                      onClick={handleOpenTicket}
                      className="p-1.5 hover:bg-primary-foreground/10 transition-colors"
                      aria-label="Create a support ticket from this conversation"
                      title="Create a ticket"
                    >
                      <TicketPlus className="w-4 h-4 text-primary-foreground" />
                    </button>
                  )}
                  <button
                    onClick={handleDownloadTranscript}
                    disabled={messages.length === 0}
                    className="p-1.5 hover:bg-primary-foreground/10 transition-colors disabled:opacity-40"
                    aria-label="Download chat transcript"
                    title="Download transcript"
                  >
                    <Download className="w-4 h-4 text-primary-foreground" />
                  </button>
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1.5 hover:bg-primary-foreground/10 transition-colors"
                    aria-label={isMinimized ? "Maximize" : "Minimize"}
                  >
                    {isMinimized ? (
                      <Maximize2 className="w-4 h-4 text-primary-foreground" />
                    ) : (
                      <Minimize2 className="w-4 h-4 text-primary-foreground" />
                    )}
                  </button>
                  <button
                    ref={closeButtonRef}
                    onClick={() => {
                      setIsOpen(false);
                      onClose?.();
                    }}
                    className="p-1.5 hover:bg-primary-foreground/10 transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {!isMinimized && (
                helpOpen ? (
                  <ChatHelpPanel
                    messages={messages.map((m) => ({ role: m.role, content: m.content }))}
                    onClose={() => setHelpOpen(false)}
                    onEscalate={handleEscalateToHuman}
                    onCreateTicket={handleOpenTicket}
                  />
                ) : (
                <>
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-5 bg-background">
                    {isFreshChat ? (
                      <div className="space-y-4">
                        <div className="border-4 border-foreground bg-card p-4 shadow-[6px_6px_0_hsl(var(--foreground))]">
                          <div className="w-12 h-12 mb-3 border-2 border-foreground bg-primary flex items-center justify-center">
                            <Bot className="w-7 h-7 text-primary-foreground" />
                          </div>
                          <h3 className="font-display text-xl uppercase mb-1">
                            {isAdmin ? "Admin support desk" : user ? "Account desk ready" : "OCCTA support desk"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isAdmin 
                              ? "I'm IRA, ready to help with customers, services, or tickets."
                              : user ? "You're signed in, so I can check your linked orders, invoices, services and tickets without asking you to verify again."
                              : "Ask about plans, switching, setup or support. Simple telecom, clear terms — just straight answers."}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {quickActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuickAction(action.message)}
                              className="min-h-[48px] text-left px-3 py-2 text-xs font-display uppercase border-2 border-foreground bg-card hover:bg-primary hover:text-primary-foreground transition-colors shadow-[3px_3px_0_hsl(var(--foreground))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                        {!isAdmin && (
                          <div className="border-2 border-foreground/60 bg-muted/30 p-3">
                            <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                              Self-service — get answers instantly
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selfServiceLinks.map((link) => (
                                <a
                                  key={link.href}
                                  href={link.href}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-display uppercase border-2 border-foreground bg-background hover:bg-foreground hover:text-background transition-colors"
                                >
                                  <link.icon className="w-3.5 h-3.5" />
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {message.role === "assistant" && (
                              <div className="w-7 h-7 bg-primary flex items-center justify-center shrink-0 border-2 border-foreground">
                                <Bot className="w-4 h-4 text-primary-foreground" />
                              </div>
                            )}
                              <div
                              className={`max-w-[78%] break-words px-4 py-3 text-sm leading-relaxed ${
                                message.role === "user"
                                  ? "bg-accent text-accent-foreground border-2 border-foreground"
                                  : "bg-card border-2 border-foreground/60"
                              }`}
                            >
                              <AssistantMessageBody message={message} onQuickReply={sendMessage} />
                              {message.attachments?.length && (
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  <p className="font-semibold uppercase tracking-wide">Attachments</p>
                                  <ul className="space-y-1">
                                    {message.attachments.map((file) => (
                                      <li key={file.id} className="flex items-center justify-between gap-2">
                                        <span className="truncate">{file.name}</span>
                                        <span className="shrink-0">{formatAttachmentSize(file.size)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                            {message.role === "user" && (
                              <div className="w-7 h-7 bg-accent flex items-center justify-center shrink-0 border-2 border-foreground">
                                <UserIcon className="w-4 h-4 text-accent-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex gap-2 justify-start">
                            <div className="w-7 h-7 bg-primary flex items-center justify-center shrink-0 border-2 border-foreground">
                              <Bot className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="bg-card border-2 border-foreground/60 px-4 py-3">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <Shimmer>Checking your account…</Shimmer>
                              </div>
                            </div>
                          </div>
                        )}
                        {lastFailedMessage && (
                          <div className="flex justify-center">
                            <Button variant="outline" size="sm" onClick={handleRetry}>
                              Retry last message
                            </Button>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <form onSubmit={handleSubmit} className="p-4 border-t-4 border-foreground bg-card">
                    <div className="flex gap-2 items-stretch">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleAttachmentsChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 border-2 border-foreground shadow-[4px_4px_0_hsl(var(--foreground))]"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Add attachment"
                      >
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 h-11 border-2 border-foreground bg-background text-sm"
                        disabled={isLoading}
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        variant="hero"
                        disabled={(!inputValue.trim() && pendingAttachments.length === 0) || isLoading}
                        className="shrink-0 h-11 w-11 border-2 border-foreground shadow-[4px_4px_0_hsl(var(--foreground))]"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    {pendingAttachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {pendingAttachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 rounded-full border border-foreground/40 px-3 py-1 text-xs"
                            >
                              <span className="max-w-[140px] truncate">{file.name}</span>
                              <span className="text-muted-foreground">{formatAttachmentSize(file.size)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(file.id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>AI will review attachments first, then offer to involve an advisor.</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSendToAdvisor}
                          >
                            Send to advisor
                          </Button>
                        </div>
                      </div>
                    )}
                    {user && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Securely signed in as {user.email?.split("@")[0]}
                      </p>
                    )}
                  </form>
                </>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <RaiseTicketDialog
          open={ticketOpen}
          onOpenChange={setTicketOpen}
          prefill={ticketPrefill}
        />
      </>
    );
  }

  // Embedded version (for Support page)
  return (
    <div
      className={`bg-card border-4 border-foreground flex flex-col min-h-0 h-[min(520px,calc(100dvh-10rem))] max-h-[calc(100dvh-4rem)] ${className}`}
    >
      {/* Header */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between gap-2 border-b-4 border-foreground">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary-foreground" />
          <span className="font-display text-primary-foreground uppercase text-sm">
            {isAdmin ? "IRA Admin" : "IRA"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="text-xs font-display uppercase text-primary-foreground/80 hover:text-primary-foreground"
          >
            New chat
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="border-2 border-primary-foreground px-2 py-1 text-xs font-display uppercase text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Close chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isFreshChat ? (
          <div className="space-y-4">
            <div className="text-center">
              <Bot className="w-10 h-10 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                {isAdmin 
                  ? "I'm IRA, ready to help with customers, services, or tickets."
                  : "I'm IRA — ask about plans, switching, or your account. Happy to help 🙂"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.message)}
                  className="text-left px-3 py-2 text-xs border-2 border-foreground/30 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
            {!isAdmin && (
              <div className="border-2 border-foreground/30 p-3">
                <p className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Self-service
                </p>
                <div className="flex flex-wrap gap-2">
                  {selfServiceLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border-2 border-foreground/40 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <link.icon className="w-3.5 h-3.5" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-6 h-6 bg-primary flex items-center justify-center shrink-0 border-2 border-foreground">
                    <Bot className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-accent text-accent-foreground border-2 border-foreground"
                      : "bg-secondary border-2 border-foreground/50"
                  }`}
                >
                  <AssistantMessageBody message={message} onQuickReply={sendMessage} />
                  {message.attachments?.length && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="font-semibold uppercase tracking-wide">Attachments</p>
                      <ul className="space-y-1">
                        {message.attachments.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0">{formatAttachmentSize(file.size)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatTime(message.createdAt)}
                  </p>
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 bg-accent flex items-center justify-center shrink-0 border-2 border-foreground">
                    <UserIcon className="w-3 h-3 text-accent-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 bg-primary flex items-center justify-center shrink-0 border-2 border-foreground">
                  <Bot className="w-3 h-3 text-primary-foreground" />
                </div>
                <div className="bg-secondary border-2 border-foreground/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking…
                  </div>
                </div>
              </div>
            )}
            {lastFailedMessage && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Retry last message
                </Button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t-4 border-foreground bg-background">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleAttachmentsChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 border-2 border-foreground"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add attachment"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border-2 border-foreground text-sm"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            variant="hero"
            disabled={(!inputValue.trim() && pendingAttachments.length === 0) || isLoading}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {pendingAttachments.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-full border border-foreground/40 px-3 py-1 text-xs"
                >
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <span className="text-muted-foreground">{formatAttachmentSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.id)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI will review attachments first, then offer to involve an advisor.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendToAdvisor}
              >
                Send to advisor
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
});

AIChatBot.displayName = "AIChatBot";

export default AIChatBot;
