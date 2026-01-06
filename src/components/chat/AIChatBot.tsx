import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2,
  Minimize2,
  Maximize2
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface AIChatBotProps {
  embedded?: boolean;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const quickActions = [
  { label: "Compare broadband plans", message: "Help me choose a broadband plan" },
  { label: "View my orders", message: "I'd like to check my orders" },
  { label: "SIM plan options", message: "What SIM plans do you offer?" },
  { label: "Bundle discount", message: "How do bundle discounts work?" },
];

const AIChatBot = ({ embedded = false, className = "" }: AIChatBotProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(embedded);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get current user
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          userId: user?.id 
        }),
      });

      if (response.status === 429) {
        toast({
          title: "Too many requests",
          description: "Please wait a moment before sending another message.",
          variant: "destructive"
        });
        return;
      }

      if (response.status === 402) {
        toast({
          title: "Service unavailable",
          description: "Please call us at 0800 260 6627 for assistance.",
          variant: "destructive"
        });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.error) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.error 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.content 
        }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I'm having trouble right now. Please try again or call us at 0800 260 6627." 
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, user?.id, isLoading, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
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
              className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary border-4 border-foreground shadow-brutal flex items-center justify-center hover:-translate-y-1 hover:shadow-brutal-lg transition-all"
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
                height: isMinimized ? "auto" : "min(600px, 80vh)"
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] bg-card border-4 border-foreground shadow-brutal-lg flex flex-col overflow-hidden ${className}`}
            >
              {/* Header */}
              <div className="bg-primary px-4 py-3 flex items-center justify-between border-b-4 border-foreground">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                  <span className="font-display text-primary-foreground uppercase text-sm">OCCTA Assistant</span>
                </div>
                <div className="flex items-center gap-1">
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
                    {messages.length === 0 ? (
                      <div className="space-y-4">
                        <div className="text-center">
                          <Bot className="w-12 h-12 mx-auto mb-3 text-primary" />
                          <h3 className="font-display text-lg mb-1">Hi there! 👋</h3>
                          <p className="text-sm text-muted-foreground">
                            I'm OCCTA's AI assistant. How can I help you today?
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
                        {messages.map((message, i) => (
                          <div
                            key={i}
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
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <form onSubmit={handleSubmit} className="p-3 border-t-4 border-foreground bg-background">
                    <div className="flex gap-2">
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
                        disabled={!inputValue.trim() || isLoading}
                        className="shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
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
    <div className={`bg-card border-4 border-foreground flex flex-col h-[500px] ${className}`}>
      {/* Header */}
      <div className="bg-primary px-4 py-3 flex items-center gap-2 border-b-4 border-foreground">
        <Bot className="w-5 h-5 text-primary-foreground" />
        <span className="font-display text-primary-foreground uppercase text-sm">AI Assistant</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center">
              <Bot className="w-10 h-10 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                Ask me anything about our services, your account, or get help choosing a plan!
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
            {messages.map((message, i) => (
              <div
                key={i}
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t-4 border-foreground bg-background">
        <div className="flex gap-2">
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
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChatBot;
