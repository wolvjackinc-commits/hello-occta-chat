import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Loader2,
  Clock,
} from "lucide-react";

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string | null;
  created_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff_reply: boolean;
  created_at: string;
};

const statusColors: Record<string, string> = {
  open: "bg-warning text-warning-foreground",
  in_progress: "bg-accent text-accent-foreground",
  resolved: "bg-primary text-primary-foreground",
  closed: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  urgent: "bg-destructive text-destructive-foreground",
};

interface TicketDetailDialogProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetailDialog({ ticket, open, onOpenChange }: TicketDetailDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    if (ticket && open) {
      fetchMessages();
      
      // Set up realtime subscription
      const channel = supabase
        .channel(`ticket-messages-${ticket.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ticket_messages',
            filter: `ticket_id=eq.${ticket.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as TicketMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [ticket, open]);

  const fetchMessages = async () => {
    if (!ticket) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      logError("TicketDetailDialog.fetchMessages", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!ticket || !newMessage.trim()) return;
    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: newMessage.trim(),
          is_staff_reply: false,
        });

      if (insertError) throw insertError;

      toast({ title: "Message sent" });
      setNewMessage("");
      // Message will be added via realtime subscription
    } catch (error) {
      logError("TicketDetailDialog.handleSendReply", error);
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  const isTicketClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden border-4 border-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <MessageSquare className="w-6 h-6" />
            {ticket.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ticket Info */}
          <div className="flex flex-wrap items-center gap-3 p-3 border-4 border-foreground bg-secondary">
            <Badge className={`uppercase ${statusColors[ticket.status]}`}>
              {ticket.status.replace('_', ' ')}
            </Badge>
            <Badge className={`uppercase ${priorityColors[ticket.priority]}`}>
              {ticket.priority}
            </Badge>
            {ticket.category && (
              <Badge variant="outline" className="border-2 border-foreground uppercase">
                {ticket.category}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(ticket.created_at), "dd MMM yyyy")}
            </span>
          </div>

          {/* Original Description */}
          <div className="p-4 border-4 border-foreground bg-card">
            <p className="text-xs text-muted-foreground uppercase font-display mb-2">Your Issue</p>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Messages */}
          <ScrollArea className="h-[250px] border-4 border-foreground p-4 bg-secondary/50">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 border-2 border-foreground ${
                      msg.is_staff_reply
                        ? "bg-primary text-primary-foreground mr-8"
                        : "bg-card ml-8"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs mb-1 opacity-70">
                      <span className="uppercase font-display">
                        {msg.is_staff_reply ? "Support Team" : "You"}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(msg.created_at), "dd MMM HH:mm")}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No replies yet. We'll get back to you soon!</p>
              </div>
            )}
          </ScrollArea>

          {/* Reply Input */}
          {!isTicketClosed ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="border-4 border-foreground"
                  rows={3}
                />
                <Button
                  variant="hero"
                  onClick={handleSendReply}
                  disabled={isSending || !newMessage.trim()}
                  className="px-6"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 border-4 border-foreground bg-muted">
              <p className="text-sm text-muted-foreground">
                This ticket is {ticket.status}. Need more help? <a href="/support" className="text-primary underline">Create a new ticket</a>.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
