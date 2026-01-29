import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY } from "@/lib/constants";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2,
  Minimize2,
  Maximize2,
  Paperclip
} from "lucide-react";

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
  onClose?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// Default quick actions for customers
const defaultQuickActions = [
  { label: "🔍 Compare Plans", message: "Help me compare your broadband and SIM plans" },
  { label: "📱 SIM Only", message: "What SIM-only plans do you offer?" },
  { label: "🌐 Broadband", message: "Tell me about your broadband plans" },
  { label: "👤 My OCCTA Account", message: "I'd like help with my OCCTA account" },
  { label: "🔄 Switching Help", message: "How do I switch to OCCTA from my current provider?" },
  { label: "💬 Speak to Support", message: "I need to speak to human support" },
];

// Admin quick actions
const adminQuickActions = [
  { label: "🧾 Find Customer", message: "I need to look up a customer account" },
  { label: "📦 Add Service", message: "Help me add a new service for a customer" },
  { label: "🎟 Open Ticket", message: "I need to create a support ticket" },
  { label: "⚙ System Status", message: "What's the current system status?" },
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
  ({ embedded = false, className = "", autoFocusInput = false, onClose }, ref) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(embedded);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    ? [...adminQuickActions, ...defaultQuickActions.slice(0, 2)] 
    : defaultQuickActions;

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const formatAttachmentSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatAttachmentSummary = (attachments: AttachmentMeta[]) => {
    if (!attachments.length) return "";
    return attachments
      .map((file) => `- ${file.name} (${file.type || "unknown"}, ${formatAttachmentSize(file.size)})`)
      .join("\n");
  };

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
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
  }, [messages, user?.id, isLoading, toast]);

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
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setIsOpen(true)}
              className="fixed bottom-24 right-4 z-40 w-12 h-12 bg-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"
              aria-label="Open chat"
            >
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                height: isMinimized ? "auto" : "min(500px, calc(100dvh - 10rem))"
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed bottom-20 sm:bottom-16 right-4 z-40 w-[360px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-6rem)] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden ${className}`}
            >
              {/* Header */}
              <div className="bg-primary px-4 py-3 flex items-center justify-between border-b-4 border-foreground">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                  <span className="font-display text-primary-foreground uppercase text-sm">
                    {isAdmin ? "IRA Admin" : "IRA"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearChat}
                    className="px-2 py-1 text-xs font-display uppercase text-primary-foreground/80 hover:text-primary-foreground"
                  >
                    New chat
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
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-primary-foreground/10 transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {!isMinimized && (
                <>
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {isFreshChat ? (
                      <div className="space-y-4">
                        <div className="text-center">
                          <Bot className="w-12 h-12 mx-auto mb-3 text-primary" />
                          <h3 className="font-display text-lg mb-1">
                            {isAdmin ? "🔐 Admin Mode" : "Hey there! 👋"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isAdmin 
                              ? "I'm IRA, ready to help with customers, services, or tickets."
                              : "I'm IRA — no pressure, no contracts, just honest help 🙂"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {quickActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuickAction(action.message)}
                              className="w-full text-left px-3 py-2 text-sm border-2 border-foreground/30 hover:border-primary hover:bg-primary/5 transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
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
                              className={`max-w-[85%] px-3 py-2 text-sm ${
                                message.role === "user"
                                  ? "bg-accent text-accent-foreground border-2 border-foreground"
                                  : "bg-secondary border-2 border-foreground/50"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.content}</p>
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
                            <div className="bg-secondary border-2 border-foreground/50 px-4 py-3">
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
                    {user && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Signed in as {user.email?.split("@")[0]}
                      </p>
                    )}
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
                  : "I'm IRA — ask about plans, switching, or your account. No pressure! 🙂"}
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
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
